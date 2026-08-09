// lapa-casa-hostel/backend/src/lib/payments/mercado-pago-handler.ts
// ventana3

import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';

interface MPCreatePaymentInput {
  amount: number;
  currency: string;
  description: string;
  payerEmail: string;
  paymentMethod?: 'pix' | 'card' | string;
  installments?: number;
  metadata?: Record<string, any>;
}

interface MPPaymentResult {
  paymentIntentId: string;
  id?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  expiresAt?: Date;
  url?: string;
}

interface MPRefundInput {
  paymentId: string;
  amount: number;
}

interface MPPaymentStatus {
  id: string;
  status: string;
}

export class MercadoPagoPaymentHandler {
  private accessToken: string | null = null;
  private readonly PIX_EXPIRATION_MINUTES = 30;
  private readonly MAX_INSTALLMENTS = 12;
  private readonly MIN_INSTALLMENT_AMOUNT = 50;

  constructor() {
    this.accessToken = process.env.MP_ACCESS_TOKEN ?? null;
    if (!this.accessToken) {
      logger.warn('MP_ACCESS_TOKEN no configurado — pagos MercadoPago deshabilitados');
    }
  }

  async createPaymentIntent(data: MPCreatePaymentInput): Promise<MPPaymentResult> {
    if (!this.accessToken) {
      // En producción sin MP_ACCESS_TOKEN, esto antes devolvía un QR
      // falso (qr_test_code / qr_test_base64): la imagen del QR salía
      // rota (base64 inválido) y el código PIX no servía para nada -- el
      // huésped veía el botón de PIX "trabado" sin ningún mensaje de
      // error. En producción es mejor fallar acá con un mensaje claro.
      // Fuera de producción (tests, dev local sin keys) se mantiene el
      // stub para no requerir credenciales reales.
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Pago con PIX no disponible en este momento', 503);
      }
      const fakeId = `mp_test_${Date.now()}`;
      return {
        paymentIntentId: fakeId,
        id: fakeId,
        qrCode: 'qr_test_code',
        qrCodeBase64: 'qr_test_base64',
        expiresAt: new Date(Date.now() + this.PIX_EXPIRATION_MINUTES * 60 * 1000),
      };
    }

    const body: Record<string, any> = {
      transaction_amount: data.amount,
      description: data.description,
      payment_method_id: data.paymentMethod === 'pix' ? 'pix' : 'credit_card',
      payer: { email: data.payerEmail },
      metadata: data.metadata ?? {},
    };
    if (data.installments && data.paymentMethod !== 'pix') {
      body.installments = data.installments;
    }
    if (data.paymentMethod === 'pix') {
      body.date_of_expiration = new Date(Date.now() + this.PIX_EXPIRATION_MINUTES * 60 * 1000).toISOString();
    }

    const resp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `lch-${Date.now()}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`MercadoPago error: ${resp.status} ${err}`);
    }
    const payment: any = await resp.json();
    return {
      paymentIntentId: payment.id.toString(),
      id: payment.id.toString(),
      qrCode: payment.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64,
      expiresAt: payment.date_of_expiration ? new Date(payment.date_of_expiration) : undefined,
    };
  }

  async createRefund(data: MPRefundInput): Promise<void> {
    if (!this.accessToken) {
      logger.warn('MercadoPago no configurado — reembolso simulado', { paymentId: data.paymentId });
      return;
    }
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${data.paymentId}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: data.amount }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`MercadoPago refund error: ${resp.status} ${err}`);
    }
  }

  async getPayment(paymentId: string): Promise<MPPaymentStatus> {
    if (!this.accessToken) {
      return { id: paymentId, status: 'approved' };
    }
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!resp.ok) throw new Error(`MercadoPago getPayment error: ${resp.status}`);
    const data: any = await resp.json();
    return { id: data.id.toString(), status: data.status };
  }

  async verifyPayment(paymentId: string): Promise<boolean> {
    if (!this.accessToken) return true;
    try {
      const payment = await this.getPayment(paymentId);
      return payment.status === 'approved';
    } catch {
      return false;
    }
  }

  getMaxInstallments(amount: number): number {
    return Math.min(Math.floor(amount / this.MIN_INSTALLMENT_AMOUNT), this.MAX_INSTALLMENTS);
  }

  calculateInstallmentAmount(amount: number, installments: number): {
    installmentAmount: number;
    totalAmount: number;
    interestRate: number;
  } {
    const rates: Record<number, number> = {
      1: 0, 2: 0, 3: 0,
      4: 0.0299, 5: 0.0299, 6: 0.0299,
      7: 0.0399, 8: 0.0399, 9: 0.0399,
      10: 0.0499, 11: 0.0499, 12: 0.0499,
    };
    const n = Math.min(Math.max(1, installments), this.MAX_INSTALLMENTS);
    const interestRate = rates[n] ?? 0;
    const totalAmount = amount * (1 + interestRate);
    return { installmentAmount: totalAmount / n, totalAmount, interestRate };
  }

  validateCPF(cpf: string): boolean {
    const clean = cpf.replace(/[^\d]/g, '');
    if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
    let d = 11 - (sum % 11);
    if (d >= 10) d = 0;
    if (d !== parseInt(clean[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
    d = 11 - (sum % 11);
    if (d >= 10) d = 0;
    return d === parseInt(clean[10]);
  }
}

export const MercadoPagoHandler = MercadoPagoPaymentHandler;
export const mercadoPagoHandler = new MercadoPagoPaymentHandler();
