// lapa-casa-hostel/backend/src/lib/payments/stripe-handler.ts

import Stripe from 'stripe';
import { prisma } from '../../config/database';

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true
});

export class StripePaymentHandler {
  private readonly SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'BRL'];
  private readonly DEFAULT_CURRENCY = 'BRL';
  private readonly DEPOSIT_PERCENTAGE_STANDARD = 0.30;
  private readonly DEPOSIT_PERCENTAGE_LARGE_GROUP = 0.50;
  private readonly AUTO_CHARGE_DAYS_BEFORE = 7;

  async createPaymentIntent(data: PaymentIntentData): Promise<PaymentResult> {
    try {
      const currency = this.validateCurrency(data.currency);
      const amountInCents = Math.round(data.amount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        customer_email: data.customerEmail,
        description: data.description,
        metadata: {
          bookingId: data.bookingId,
          customerName: data.customerName,
          ...data.metadata
        },
        automatic_payment_methods: {
          enabled: true
        },
        receipt_email: data.customerEmail
      });

      await this.savePaymentIntent(data.bookingId, paymentIntent);

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: data.amount,
        currency,
        status: paymentIntent.status
      };
    } catch (error) {
      console.error('Stripe payment intent creation error:', error);
      return {
        success: false,
        paymentIntentId: '',
        clientSecret: '',
        amount: 0,
        currency: data.currency,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createDepositPayment(data: DepositPaymentData): Promise<PaymentResult> {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: data.bookingId },
        include: { room: true }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      const depositPercentage = booking.bedsCount >= 15 
        ? this.DEPOSIT_PERCENTAGE_LARGE_GROUP 
        : this.DEPOSIT_PERCENTAGE_STANDARD;

      const depositAmount = data.totalAmount * depositPercentage;
      const remainingAmount = data.totalAmount - depositAmount;

      const paymentIntent = await this.createPaymentIntent({
        bookingId: data.bookingId,
        amount: depositAmount,
        currency: this.DEFAULT_CURRENCY,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        description: `Deposit for booking ${data.bookingId} - ${booking.room.name}`,
        metadata: {
          paymentType: 'deposit',
          depositPercentage: depositPercentage.toString(),
          remainingAmount: remainingAmount.toString(),
          totalAmount: data.totalAmount.toString()
        }
      });

      return paymentIntent;
    } catch (error) {
      console.error('Deposit payment creation error:', error);
      return {
        success: false,
        paymentIntentId: '',
        clientSecret: '',
        amount: 0,
        currency: this.DEFAULT_CURRENCY,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createRemainingPayment(bookingId: string): Promise<PaymentResult> {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { 
          payments: true,
          room: true,
          guest: true
        }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      const depositPayment = booking.payments.find(p => p.paymentType === 'deposit' && p.status === 'succeeded');

      if (!depositPayment) {
        throw new Error('Deposit payment not found');
      }

      const totalAmount = booking.totalPrice;
      const depositAmount = depositPayment.amount;
      const remainingAmount = totalAmount - depositAmount;

      if (remainingAmount <= 0) {
        throw new Error('No remaining amount to charge');
      }

      const paymentIntent = await this.createPaymentIntent({
        bookingId,
        amount: remainingAmount,
        currency: this.DEFAULT_CURRENCY,
        customerEmail: booking.guest.email,
        customerName: booking.guest.fullName,
        description: `Remaining payment for booking ${bookingId} - ${booking.room.name}`,
        metadata: {
          paymentType: 'remaining',
          depositAmount: depositAmount.toString(),
          totalAmount: totalAmount.toString()
        }
      });

      return paymentIntent;
    } catch (error) {
      console.error('Remaining payment creation error:', error);
      return {
        success: false,
        paymentIntentId: '',
        clientSecret: '',
        amount: 0,
        currency: this.DEFAULT_CURRENCY,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        success: paymentIntent.status === 'succeeded',
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        status: paymentIntent.status
      };
    } catch (error) {
      console.error('Payment confirmation error:', error);
      return {
        success: false,
        paymentIntentId,
        clientSecret: '',
        amount: 0,
        currency: this.DEFAULT_CURRENCY,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number, reason?: string): Promise<RefundResult> {
    try {
      const refundData: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      if (reason) {
        refundData.reason = reason as Stripe.RefundCreateParams.Reason;
      }

      const refund = await stripe.refunds.create(refundData);

      await this.saveRefund(paymentIntentId, refund);

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      };
    } catch (error) {
      console.error('Refund error:', error);
      return {
        success: false,
        refundId: '',
        amount: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async handleWebhook(payload: string | Buffer, signature: string): Promise<WebhookEvent | null> {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      await this.processWebhookEvent(event);

      return {
        id: event.id,
        type: event.type,
        data: event.data,
        created: event.created
      };
    } catch (error) {
      console.error('Webhook handling error:', error);
      return null;
    }
  }

  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'charge.dispute.created':
        await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const bookingId = paymentIntent.metadata.bookingId;

    await prisma.payment.updateMany({
      where: { 
        stripePaymentIntentId: paymentIntent.id 
      },
      data: {
        status: 'succeeded',
        paidAt: new Date()
      }
    });

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

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await prisma.payment.updateMany({
      where: { 
        stripePaymentIntentId: paymentIntent.id 
      },
      data: {
        status: 'failed',
        failureReason: paymentIntent.last_payment_error?.message
      }
    });
  }

  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await prisma.payment.updateMany({
      where: { 
        stripePaymentIntentId: paymentIntent.id 
      },
      data: {
        status: 'canceled'
      }
    });
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const paymentIntentId = charge.payment_intent as string;

    await prisma.payment.updateMany({
      where: { 
        stripePaymentIntentId: paymentIntentId 
      },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundAmount: charge.amount_refunded / 100
      }
    });
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    const chargeId = dispute.charge as string;
    console.error('Dispute created for charge:', chargeId, dispute);
  }

  private async savePaymentIntent(bookingId: string, paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await prisma.payment.create({
      data: {
        bookingId,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        status: paymentIntent.status,
        paymentMethod: 'stripe',
        stripePaymentIntentId: paymentIntent.id,
        paymentType: paymentIntent.metadata.paymentType || 'full'
      }
    });
  }

  private async saveRefund(paymentIntentId: string, refund: Stripe.Refund): Promise<void> {
    await prisma.payment.updateMany({
      where: { 
        stripePaymentIntentId: paymentIntentId 
      },
      data: {
        status: 'refunded',
        refundedAt: new Date(),
        refundAmount: refund.amount / 100,
        stripeRefundId: refund.id
      }
    });
  }

  private validateCurrency(currency: string): string {
    const upperCurrency = currency.toUpperCase();
    if (!this.SUPPORTED_CURRENCIES.includes(upperCurrency)) {
      throw new Error(`Currency ${currency} not supported`);
    }
    return upperCurrency;
  }

  async getPaymentStatus(paymentIntentId: string): Promise<string> {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent.status;
    } catch (error) {
      console.error('Get payment status error:', error);
      return 'unknown';
    }
  }

  static getSupportedCurrencies(): string[] {
    return ['USD', 'EUR', 'GBP', 'BRL'];
  }

  static getDefaultCurrency(): string {
    return 'BRL';
  }
}

export const stripeHandler = new StripePaymentHandler();
