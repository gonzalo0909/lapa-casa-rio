// lapa-casa-hostel/backend/src/lib/payments/mercado-pago-handler.ts

import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { prisma } from '../../config/database';

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
    identification?: {
      type: string;
      number: string;
    };
  };
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
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

interface MPPixPaymentData {
  bookingId: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  customerDocument: string;
  description: string;
  expirationMinutes?: number;
}

interface MPWebhookNotification {
  id: string;
  action: string;
  type: string;
  data: {
    id: string;
  };
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: {
    timeout: 5000
  }
});

const paymentClient = new Payment(client);
const preferenceClient = new Preference(client);

export class MercadoPagoPaymentHandler {
  private readonly DEFAULT_CURRENCY = 'BRL';
  private readonly PIX_EXPIRATION_MINUTES = 30;
  private readonly MAX_INSTALLMENTS = 12;
  private readonly MIN_INSTALLMENT_AMOUNT = 50.00;

  async createPixPayment(data: MPPixPaymentData): Promise<MPPaymentResult> {
    try {
      const expirationDate = new Date();
      expirationDate.setMinutes(
        expirationDate.getMinutes() + (data.expirationMinutes || this.PIX_EXPIRATION_MINUTES)
      );

      const paymentData = {
        transaction_amount: data.amount,
        description: data.description,
        payment_method_id: 'pix',
        payer: {
          email: data.customerEmail,
          first_name: data.customerName.split(' ')[0],
          last_name: data.customerName.split(' ').slice(1).join(' ') || data.customerName,
          identification: {
            type: 'CPF',
            number: data.customerDocument
          }
        },
        date_of_expiration: expirationDate.toISOString(),
        metadata: {
          booking_id: data.bookingId
        }
      };

      const payment = await paymentClient.create({ body: paymentData });

      await this.saveMPPayment(data.bookingId, payment, 'pix');

      return {
        success: true,
        paymentId: payment.id!.toString(),
        status: payment.status!,
        statusDetail: payment.status_detail!,
        amount: data.amount,
        qrCode: payment.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64,
        ticketUrl: payment.point_of_interaction?.transaction_data?.ticket_url
      };
    } catch (error) {
      console.error('PIX payment creation error:', error);
      return {
        success: false,
        paymentId: '',
        status: 'failed',
        statusDetail: 'error',
        amount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createCreditCardPayment(data: MPPaymentData): Promise<MPPaymentResult> {
    try {
      const installments = this.calculateInstallments(data.amount, data.installments);

      const paymentData = {
        transaction_amount: data.amount,
        description: data.description,
        payment_method_id: data.paymentMethod || 'credit_card',
        installments,
        payer: {
          email: data.customerEmail,
          first_name: data.customerName.split(' ')[0],
          last_name: data.customerName.split(' ').slice(1).join(' ') || data.customerName,
          identification: {
            type: 'CPF',
            number: data.customerDocument
          }
        },
        metadata: {
          booking_id: data.bookingId
        }
      };

      const payment = await paymentClient.create({ body: paymentData });

      await this.saveMPPayment(data.bookingId, payment, 'credit_card');

      return {
        success: true,
        paymentId: payment.id!.toString(),
        status: payment.status!,
        statusDetail: payment.status_detail!,
        amount: data.amount
      };
    } catch (error) {
      console.error('Credit card payment creation error:', error);
      return {
        success: false,
        paymentId: '',
        status: 'failed',
        statusDetail: 'error',
        amount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createPreference(data: MPPreferenceData): Promise<{
    success: boolean;
    preferenceId: string;
    initPoint: string;
    sandboxInitPoint: string;
    error?: string;
  }> {
    try {
      const preferenceData = {
        items: data.items.map(item => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency_id: this.DEFAULT_CURRENCY
        })),
        payer: {
          name: data.payer.name,
          email: data.payer.email,
          identification: data.payer.identification
        },
        back_urls: data.backUrls,
        auto_return: 'approved' as const,
        external_reference: data.bookingId,
        notification_url: `${process.env.API_URL}/webhooks/mercadopago`,
        metadata: {
          booking_id: data.bookingId
        }
      };

      const preference = await preferenceClient.create({ body: preferenceData });

      return {
        success: true,
        preferenceId: preference.id!,
        initPoint: preference.init_point!,
        sandboxInitPoint: preference.sandbox_init_point!
      };
    } catch (error) {
      console.error('Preference creation error:', error);
      return {
        success: false,
        preferenceId: '',
        initPoint: '',
        sandboxInitPoint: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    statusDetail: string;
    amount: number;
  }> {
    try {
      const payment = await paymentClient.get({ id: paymentId });

      return {
        status: payment.status!,
        statusDetail: payment.status_detail!,
        amount: payment.transaction_amount!
      };
    } catch (error) {
      console.error('Get payment status error:', error);
      return {
        status: 'unknown',
        statusDetail: 'error',
        amount: 0
      };
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<{
    success: boolean;
    refundId: string;
    status: string;
    error?: string;
  }> {
    try {
      const refundData: any = {};
      
      if (amount) {
        refundData.amount = amount;
      }

      const refund = await paymentClient.refund({
        id: paymentId,
        body: refundData
      });

      await this.saveMPRefund(paymentId, refund);

      return {
        success: true,
        refundId: refund.id!.toString(),
        status: refund.status!
      };
    } catch (error) {
      console.error('Refund error:', error);
      return {
        success: false,
        refundId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async handleWebhook(notification: MPWebhookNotification): Promise<void> {
    try {
      if (notification.type === 'payment') {
        const payment = await paymentClient.get({ id: notification.data.id });
        await this.processPaymentWebhook(payment);
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
    }
  }

  private async processPaymentWebhook(payment: any): Promise<void> {
    const bookingId = payment.metadata?.booking_id;

    if (!bookingId) {
      console.error('No booking ID in payment metadata');
      return;
    }

    const statusMap: Record<string, string> = {
      'approved': 'succeeded',
      'pending': 'pending',
      'in_process': 'processing',
      'rejected': 'failed',
      'cancelled': 'canceled',
      'refunded': 'refunded'
    };

    const mappedStatus = statusMap[payment.status] || 'pending';

    await prisma.payment.updateMany({
      where: { 
        mercadoPagoPaymentId: payment.id.toString()
      },
      data: {
        status: mappedStatus,
        paidAt: payment.status === 'approved' ? new Date() : null,
        failureReason: payment.status === 'rejected' ? payment.status_detail : null
      }
    });

    if (payment.status === 'approved') {
      const payments = await prisma.payment.findMany({
        where: { bookingId }
      });

      const allPaid = payments.every(p => p.status === 'succeeded');

      if (allPaid) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { 
            status: 'CONFIRMED',
            paymentStatus: 'PAID'
          }
        });
      }
    }
  }

  private calculateInstallments(amount: number, requestedInstallments?: number): number {
    if (!requestedInstallments || requestedInstallments < 1) {
      return 1;
    }

    const installmentAmount = amount / requestedInstallments;

    if (installmentAmount < this.MIN_INSTALLMENT_AMOUNT) {
      return Math.max(1, Math.floor(amount / this.MIN_INSTALLMENT_AMOUNT));
    }

    return Math.min(requestedInstallments, this.MAX_INSTALLMENTS);
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
    const validInstallments = this.calculateInstallments(amount, installments);
    
    const interestRates: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0.0299,
      5: 0.0299,
      6: 0.0299,
      7: 0.0399,
      8: 0.0399,
      9: 0.0399,
      10: 0.0499,
      11: 0.0499,
      12: 0.0499
    };

    const interestRate = interestRates[validInstallments] || 0;
    const totalAmount = amount * (1 + interestRate);
    const installmentAmount = totalAmount / validInstallments;

    return {
      installmentAmount,
      totalAmount,
      interestRate
    };
  }

  private async saveMPPayment(
    bookingId: string, 
    payment: any, 
    paymentMethod: string
  ): Promise<void> {
    await prisma.payment.create({
      data: {
        bookingId,
        amount: payment.transaction_amount,
        currency: this.DEFAULT_CURRENCY,
        status: this.mapMPStatus(payment.status),
        paymentMethod: 'mercadopago',
        mercadoPagoPaymentId: payment.id.toString(),
        paymentType: paymentMethod,
        metadata: {
          payment_method_id: payment.payment_method_id,
          status_detail: payment.status_detail
        }
      }
    });
  }

  private async saveMPRefund(paymentId: string, refund: any): Promise<void> {
    await prisma.payment.updateMany({
      where: { 
        mercadoPagoPaymentId: paymentId
      },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundAmount: refund.amount,
        mercadoPagoRefundId: refund.id.toString()
      }
    });
  }

  private mapMPStatus(mpStatus: string): string {
    const statusMap: Record<string, string> = {
      'approved': 'succeeded',
      'pending': 'pending',
      'in_process': 'processing',
      'rejected': 'failed',
      'cancelled': 'canceled',
      'refunded': 'refunded'
    };

    return statusMap[mpStatus] || 'pending';
  }

  validateCPF(cpf: string): boolean {
    const cleanCPF = cpf.replace(/[^\d]/g, '');

    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleanCPF)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  }

  static getDefaultCurrency(): string {
    return 'BRL';
  }

  static getMaxInstallments(): number {
    return 12;
  }

  static getMinInstallmentAmount(): number {
    return 50.00;
  }
}

export const mercadoPagoHandler = new MercadoPagoPaymentHandler();
