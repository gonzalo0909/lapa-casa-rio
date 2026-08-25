// lapa-casa-hostel/backend/src/lib/payments/stripe-handler.ts
// ventana3

import Stripe from 'stripe';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';

interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  customerEmail: string;
  description: string;
  metadata?: Record<string, string>;
}

interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  url?: string;
}

interface RefundInput {
  paymentIntentId: string;
  amount: number;
  reason?: string;
}

export class StripeHandler {
  private stripe: Stripe | null = null;
  private webhookSecret: string | null = null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? null;
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2023-10-16' });
    } else {
      logger.warn('STRIPE_SECRET_KEY no configurada — pagos Stripe deshabilitados');
    }
  }

  async createPaymentIntent(data: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    if (!this.stripe) {
      // En producción sin STRIPE_SECRET_KEY, esto antes devolvía un
      // clientSecret falso (pi_test_..._secret_test): el checkout parecía
      // funcionar pero Stripe Elements nunca podía montar con un secret
      // inventado -- el huésped veía el botón de tarjeta "trabado" sin
      // ningún mensaje de error. En producción es mejor fallar acá con un
      // mensaje claro. Fuera de producción (tests, dev local sin keys)
      // se mantiene el stub para no requerir credenciales reales.
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Pago con tarjeta no disponible en este momento', 503);
      }
      return { paymentIntentId: `pi_test_${Date.now()}`, clientSecret: `pi_test_${Date.now()}_secret_test` };
    }
    const amountCents = Math.round(data.amount * 100);
    const intent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: data.currency.toLowerCase(),
      receipt_email: data.customerEmail,
      description: data.description,
      metadata: data.metadata ?? {},
    });
    return { paymentIntentId: intent.id, clientSecret: intent.client_secret! };
  }

  async createRefund(data: RefundInput): Promise<void> {
    if (!this.stripe) {
      logger.warn('Stripe não configurado — reembolso simulado', { paymentIntentId: data.paymentIntentId });
      return;
    }
    const amountCents = Math.round(data.amount * 100);
    await this.stripe.refunds.create({
      payment_intent: data.paymentIntentId,
      amount: amountCents,
      reason: 'requested_by_customer',
    });
  }

  // Verifica que el PaymentIntent exista y esté completado en Stripe
  async verifyPayment(paymentIntentId: string): Promise<boolean> {
    if (!this.stripe) return true; // modo test: acepta todo
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return intent.status === 'succeeded';
    } catch {
      return false;
    }
  }

  /** Crea una Checkout Session de Stripe (página de pago hosteada por Stripe).
   *  Devuelve la URL a la que se redirige/abre el huésped para pagar con tarjeta. */
  async createCheckoutSession(data: {
    amount: number;           // en BRL
    description: string;
    customerEmail: string;
    reservationId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<{ sessionId: string; url: string }> {
    if (!this.stripe) {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Pago con tarjeta no disponible en este momento', 503);
      }
      return { sessionId: `cs_test_${Date.now()}`, url: data.successUrl };
    }
    const amountCents = Math.round(data.amount * 100);
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: data.description },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      customer_email: data.customerEmail,
      metadata: { reservationId: data.reservationId, ...(data.metadata ?? {}) },
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
    });
    return { sessionId: session.id, url: session.url! };
  }

  constructWebhookEvent(payload: Buffer | string, signature: string): Stripe.Event {
    if (!this.stripe || !this.webhookSecret) {
      throw new Error('Stripe webhook no configurado');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }
}

export const stripeHandler = new StripeHandler();
