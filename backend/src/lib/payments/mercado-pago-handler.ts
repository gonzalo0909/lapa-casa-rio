// backend/src/lib/payments/mercado-pago-handler.ts

import { query } from '../../config/database';

interface MPPixPaymentData {
  bookingId: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  customerDocument: string;
  description: string;
  expirationMinutes?: number;
}

interface MPPaymentData {
  bookingId: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  customerDocument: string;
  description: string;
  paymentMethod?: 'pix' | 'credit_card' | 'debit_card';
  installments?: number;
}

interface MPPreferenceData {
  bookingId: string;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
  }>;
  payer: {
    name: string;
    email: string;
    identification?: { type: string; number: string };
  };
  backUrls: { success: string; failure: string; pending: string };
}

interface MPPaymentResult {
  success: boolean;
  paymentId: string;
  status: string;
  statusDetail: string;
  amount: number;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  error?: string;
}

interface MPWebhookNotification {
  id: string;
  action: string;
  type: string;
  data: { id: string };
}

export class MercadoPagoPaymentHandler {
  private readonly DEFAULT_CURRENCY = 'BRL';
  private readonly PIX_EXPIRATION_MINUTES = 30;
  private readonly MAX_INSTALLMENTS = 12;
  private readonly MIN_INSTALLMENT_AMOUNT = 50.00;

  async createPixPayment(data: MPPixPaymentData): Promise<MPPaymentResult> {
    console.log('MercadoPago not configured - createPixPayment stub', { bookingId: data.bookingId });
    return {
      success: false,
      paymentId: '',
      status: 'failed',
      statusDetail: 'error',
      amount: 0,
      error: 'MercadoPago not configured'
    };
  }

  async createCreditCardPayment(data: MPPaymentData): Promise<MPPaymentResult> {
    console.log('MercadoPago not configured - createCreditCardPayment stub', { bookingId: data.bookingId });
    return {
      success: false,
      paymentId: '',
      status: 'failed',
      statusDetail: 'error',
      amount: 0,
      error: 'MercadoPago not configured'
    };
  }

  async createPreference(data: MPPreferenceData): Promise<{
    success: boolean;
    preferenceId: string;
    initPoint: string;
    sandboxInitPoint: string;
    error?: string;
  }> {
    console.log('MercadoPago not configured - createPreference stub', { bookingId: data.bookingId });
    return {
      success: false,
      preferenceId: '',
      initPoint: '',
      sandboxInitPoint: '',
      error: 'MercadoPago not configured'
    };
  }

  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    statusDetail: string;
    amount: number;
  }> {
    return { status: 'unknown', statusDetail: 'error', amount: 0 };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<{
    success: boolean;
    refundId: string;
    status: string;
    error?: string;
  }> {
    console.log('MercadoPago not configured - refundPayment stub', { paymentId });
    return {
      success: false,
      refundId: '',
      status: 'failed',
      error: 'MercadoPago not configured'
    };
  }

  async handleWebhook(notification: MPWebhookNotification): Promise<void> {
    console.log('MercadoPago not configured - handleWebhook stub');
  }

  getMaxInstallments(amount: number): number {
    const maxBasedOnAmount = Math.floor(amount / this.MIN_INSTALLMENT_AMOUNT);
    return Math.min(maxBasedOnAmount, this.MAX_INSTALLMENTS);
  }

  calculateInstallmentAmount(amount: number, installments: number): {
    installmentAmount: number;
    totalAmount: number;
    interestRate: number;
  } {
    const interestRates: Record<number, number> = {
      1: 0, 2: 0, 3: 0,
      4: 0.0299, 5: 0.0299, 6: 0.0299,
      7: 0.0399, 8: 0.0399, 9: 0.0399,
      10: 0.0499, 11: 0.0499, 12: 0.0499
    };
    const valid = Math.min(Math.max(1, installments), this.MAX_INSTALLMENTS);
    const interestRate = interestRates[valid] || 0;
    const totalAmount = amount * (1 + interestRate);
    return { installmentAmount: totalAmount / valid, totalAmount, interestRate };
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

  static getDefaultCurrency(): string { return 'BRL'; }
  static getMaxInstallments(): number { return 12; }
  static getMinInstallmentAmount(): number { return 50.00; }
}

export const MercadoPagoHandler = MercadoPagoPaymentHandler;
export const mercadoPagoHandler = new MercadoPagoPaymentHandler();
