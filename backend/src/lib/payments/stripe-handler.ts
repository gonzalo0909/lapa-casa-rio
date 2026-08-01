// backend/src/lib/payments/stripe-handler.ts

import { query } from '../../config/database';

interface PaymentIntentData {
  bookingId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  description: string;
  metadata?: Record<string, string>;
}

interface DepositPaymentData {
  bookingId: string;
  totalAmount: number;
  depositPercentage: number;
  customerEmail: string;
  customerName: string;
  checkInDate: Date;
}

interface PaymentResult {
  success: boolean;
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  error?: string;
}

interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  status: string;
  error?: string;
}

interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
}

export class StripePaymentHandler {
  private readonly SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'BRL'];
  private readonly DEFAULT_CURRENCY = 'BRL';
  private readonly DEPOSIT_PERCENTAGE_STANDARD = 0.30;
  private readonly DEPOSIT_PERCENTAGE_LARGE_GROUP = 0.50;
  private readonly AUTO_CHARGE_DAYS_BEFORE = 7;

  async createPaymentIntent(data: PaymentIntentData): Promise<PaymentResult> {
    console.log('Stripe not configured - createPaymentIntent stub', { bookingId: data.bookingId });
    return {
      success: false,
      paymentIntentId: '',
      clientSecret: '',
      amount: 0,
      currency: data.currency,
      status: 'failed',
      error: 'Stripe not configured'
    };
  }

  async createDepositPayment(data: DepositPaymentData): Promise<PaymentResult> {
    console.log('Stripe not configured - createDepositPayment stub', { bookingId: data.bookingId });
    return {
      success: false,
      paymentIntentId: '',
      clientSecret: '',
      amount: 0,
      currency: this.DEFAULT_CURRENCY,
      status: 'failed',
      error: 'Stripe not configured'
    };
  }

  async createRemainingPayment(bookingId: string): Promise<PaymentResult> {
    console.log('Stripe not configured - createRemainingPayment stub', { bookingId });
    return {
      success: false,
      paymentIntentId: '',
      clientSecret: '',
      amount: 0,
      currency: this.DEFAULT_CURRENCY,
      status: 'failed',
      error: 'Stripe not configured'
    };
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
    console.log('Stripe not configured - confirmPayment stub', { paymentIntentId });
    return {
      success: false,
      paymentIntentId,
      clientSecret: '',
      amount: 0,
      currency: this.DEFAULT_CURRENCY,
      status: 'failed',
      error: 'Stripe not configured'
    };
  }

  async refundPayment(paymentIntentId: string, amount?: number, reason?: string): Promise<RefundResult> {
    console.log('Stripe not configured - refundPayment stub', { paymentIntentId });
    return {
      success: false,
      refundId: '',
      amount: 0,
      status: 'failed',
      error: 'Stripe not configured'
    };
  }

  async handleWebhook(payload: string | Buffer, signature: string): Promise<WebhookEvent | null> {
    console.log('Stripe not configured - handleWebhook stub');
    return null;
  }

  async getPaymentStatus(paymentIntentId: string): Promise<string> {
    return 'unknown';
  }

  static getSupportedCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'BRL'];
  }

  static getDefaultCurrency(): string {
    return 'BRL';
  }
}

export const StripeHandler = StripePaymentHandler;
export const stripeHandler = new StripePaymentHandler();
