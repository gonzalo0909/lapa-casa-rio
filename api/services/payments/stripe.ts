import Stripe from 'stripe';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { PaymentError } from '../../utils/errors';

export interface StripeSessionData {
  bookingId: string;
  amount: number;
  currency: string;
  guestEmail: string;
  description: string;
}

export class StripeService {
  private stripe: Stripe;

  constructor() {
    if (!config.stripe.secretKey) {
      throw new Error('Stripe secret key not configured');
    }
    this.stripe = new Stripe(config.stripe.secretKey);
  }

  async createCheckoutSession(data: StripeSessionData): Promise<{ sessionId: string; url: string }> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: data.guestEmail,
        line_items: [
          {
            price_data: {
              currency: data.currency.toLowerCase(),
              unit_amount: Math.round(data.amount * 100),
              product_data: {
                name: 'Reserva Lapa Casa Hostel',
                description: data.description,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${config.frontendUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/booking/cancel`,
        metadata: {
          bookingId: data.bookingId,
        },
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutos
      });

      logger.info('Stripe session created', { sessionId: session.id, bookingId: data.bookingId });

      return {
        sessionId: session.id,
        url: session.url!,
      };

    } catch (error) {
      logger.error('Stripe session creation failed:', error);
      throw new PaymentError(`Error creating payment session: ${error}`);
    }
  }

  async verifyWebhookSignature(payload: string, signature: string): Promise<Stripe.Event> {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );
    } catch (error) {
      logger.error('Stripe webhook verification failed:', error);
      throw new PaymentError('Invalid webhook signature');
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<{ bookingId?: string; status: string }> {
    logger.info('Processing Stripe webhook:', { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        return {
          bookingId: session.metadata?.bookingId,
          status: 'completed',
        };

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        return {
          bookingId: paymentIntent.metadata?.bookingId,
          status: 'succeeded',
        };

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        return {
          bookingId: failedPayment.metadata?.bookingId,
          status: 'failed',
        };

      default:
        logger.info('Unhandled Stripe webhook event:', event.type);
        return { status: 'ignored' };
    }
  }

  async getPaymentDetails(sessionId: string): Promise<{
    status: string;
    amount: number;
    currency: string;
    bookingId?: string;
  }> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      
      return {
        status: session.payment_status,
        amount: session.amount_total || 0,
        currency: session.currency || 'brl',
        bookingId: session.metadata?.bookingId,
      };

    } catch (error) {
      logger.error('Error retrieving Stripe session:', error);
      throw new PaymentError('Payment session not found');
    }
  }

  async createRefund(paymentIntentId: string, amount?: number): Promise<{ refundId: string; status: string }> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      logger.info('Stripe refund created', { refundId: refund.id, amount: refund.amount });

      return {
        refundId: refund.id,
        status: refund.status,
      };

    } catch (error) {
      logger.error('Stripe refund failed:', error);
      throw new PaymentError('Refund processing failed');
    }
  }
}
