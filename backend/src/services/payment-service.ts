// lapa-casa-hostel/backend/src/services/payment-service.ts
// ventana3

import Stripe from 'stripe';
import { PaymentRepository } from '../database/repositories/payment-repository';
import { BookingRepository } from '../database/repositories/booking-repository';
import { StripeHandler } from '../lib/payments/stripe-handler';
import { MercadoPagoHandler } from '../lib/payments/mercado-pago-handler';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import type { Payment, PaymentProvider } from '../types/database';

interface CreatePaymentIntentDTO {
  reservation_id: string;
  guest_id?: string;
  amount: number;
  currency?: string;
  guest_email: string;
  payment_type: 'deposit' | 'remaining';
  provider?: PaymentProvider;
  payment_method?: 'card' | 'pix';
  installments?: number;
}

interface PaymentIntentResponse {
  payment_id: string;
  client_secret?: string;
  provider_payment_id?: string;
  amount: number;
  currency: string;
  url?: string;
  qr_code?: string;
  qr_code_base64?: string;
  expires_at?: Date;
}

interface RefundDTO {
  reservation_id: string;
  amount: number;
  reason: string;
}

export class PaymentService {
  private paymentRepo: PaymentRepository;
  private bookingRepo: BookingRepository;
  private stripeHandler: StripeHandler;
  private mpHandler: InstanceType<typeof MercadoPagoHandler>;

  constructor() {
    this.paymentRepo = new PaymentRepository();
    this.bookingRepo = new BookingRepository();
    this.stripeHandler = new StripeHandler();
    this.mpHandler = new MercadoPagoHandler();
  }

  async createPaymentIntent(data: CreatePaymentIntentDTO): Promise<PaymentIntentResponse> {
    const reservation = await this.bookingRepo.findById(data.reservation_id);
    if (!reservation) throw new AppError('Reserva no encontrada', 404);

    const currency = data.currency || 'BRL';
    const provider: PaymentProvider = data.provider ||
      (this.isInternationalEmail(data.guest_email) ? 'stripe' : 'mercadopago');
    const preferredMethod = data.payment_method || (provider === 'mercadopago' ? 'pix' : 'card');

    let providerPaymentId: string;
    let pixDetails: { qr_code?: string; qr_code_base64?: string; expires_at?: Date } = {};
    let stripeClientSecret: string | undefined;
    let url: string | undefined;

    if (provider === 'mercadopago') {
      const result = await this.mpHandler.createPaymentIntent({
        amount: data.amount,
        currency,
        description: `${data.payment_type === 'deposit' ? 'Depósito' : 'Saldo'} - Reserva ${reservation.reservation_number}`,
        payerEmail: data.guest_email,
        paymentMethod: preferredMethod,
        installments: data.installments,
        metadata: { reservation_id: data.reservation_id, payment_type: data.payment_type },
      });
      providerPaymentId = result.paymentIntentId;
      pixDetails = { qr_code: result.qrCode, qr_code_base64: result.qrCodeBase64, expires_at: result.expiresAt };
      url = result.url;
    } else {
      const result = await this.stripeHandler.createPaymentIntent({
        amount: data.amount,
        currency,
        customerEmail: data.guest_email,
        description: `${data.payment_type === 'deposit' ? 'Deposit' : 'Remaining'} - Booking ${reservation.reservation_number}`,
        metadata: { reservation_id: data.reservation_id, payment_type: data.payment_type },
      });
      providerPaymentId = result.paymentIntentId;
      stripeClientSecret = result.clientSecret;
    }

    const payment = await this.paymentRepo.create({
      reservation_id: data.reservation_id,
      guest_id: data.guest_id ?? null,
      provider,
      payment_type: data.payment_type,
      amount: data.amount,
      currency,
      provider_payment_id: providerPaymentId,
      metadata: { installments: data.installments, client_secret: stripeClientSecret },
    });

    return {
      payment_id: payment.id,
      provider_payment_id: providerPaymentId,
      client_secret: stripeClientSecret,
      amount: payment.amount,
      currency: payment.currency,
      url,
      qr_code: pixDetails.qr_code,
      qr_code_base64: pixDetails.qr_code_base64,
      expires_at: pixDetails.expires_at,
    };
  }

  async confirmPayment(providerPaymentId: string): Promise<Payment> {
    const payment = await this.paymentRepo.findByProviderPaymentId(providerPaymentId);
    if (!payment) throw new AppError('Pago no encontrado', 404);
    if (payment.status === 'succeeded') throw new AppError('El pago ya fue confirmado', 400);

    let verified = false;
    if (payment.provider === 'stripe') {
      verified = await this.stripeHandler.verifyPayment(providerPaymentId);
    } else if (payment.provider === 'mercadopago') {
      verified = await this.mpHandler.verifyPayment(providerPaymentId);
    }
    if (!verified) throw new AppError('No se pudo verificar el pago', 400);

    const confirmedPayment = await this.paymentRepo.markCompleted(payment.id);
    if (payment.payment_type === 'deposit') {
      await this.bookingRepo.updateStatus(payment.reservation_id, 'confirmed');
    }
    return confirmedPayment;
  }

  async confirmPaymentById(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) throw new AppError('Pago no encontrado', 404);
    if (payment.status === 'succeeded') throw new AppError('El pago ya fue confirmado', 400);

    let verified = false;
    if (payment.provider === 'stripe' && payment.provider_payment_id) {
      verified = await this.stripeHandler.verifyPayment(payment.provider_payment_id);
    } else if (payment.provider === 'mercadopago' && payment.provider_payment_id) {
      verified = await this.mpHandler.verifyPayment(payment.provider_payment_id);
    }
    if (!verified) throw new AppError('No se pudo verificar el pago con el proveedor', 400);

    const confirmed = await this.paymentRepo.markCompleted(paymentId);
    if (payment.payment_type === 'deposit') {
      await this.bookingRepo.updateStatus(payment.reservation_id, 'confirmed');
    }
    return confirmed;
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    return this.paymentRepo.findById(id);
  }

  async processRefund(data: RefundDTO): Promise<Payment> {
    const payments = await this.paymentRepo.findByReservation(data.reservation_id);
    const successfulPayment = payments.find(p => p.status === 'succeeded');
    if (!successfulPayment) throw new AppError('No hay pago completado para reembolsar', 400);

    if (successfulPayment.provider === 'stripe' && successfulPayment.provider_payment_id) {
      await this.stripeHandler.createRefund({
        paymentIntentId: successfulPayment.provider_payment_id,
        amount: data.amount,
        reason: data.reason,
      });
    } else if (successfulPayment.provider === 'mercadopago' && successfulPayment.provider_payment_id) {
      await this.mpHandler.createRefund({
        paymentId: successfulPayment.provider_payment_id,
        amount: data.amount,
      });
    }
    return this.paymentRepo.processRefund(successfulPayment.id, data.amount);
  }

  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.confirmPayment(pi.id).catch(err => {
          logger.warn('confirmPayment en webhook ignorado', { id: pi.id, err: err.message });
        });
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const payment = await this.paymentRepo.findByProviderPaymentId(pi.id);
        if (payment) {
          await this.paymentRepo.markFailed(payment.id, pi.last_payment_error?.message);
        }
        break;
      }
    }
  }

  async handleMercadoPagoWebhook(data: any): Promise<void> {
    if (data.type === 'payment' && data.data?.id) {
      const mpPayment = await this.mpHandler.getPayment(data.data.id.toString());
      if (mpPayment.status === 'approved') {
        await this.confirmPayment(mpPayment.id).catch(err => {
          logger.warn('confirmPayment MP webhook ignorado', { id: mpPayment.id, err: err.message });
        });
      }
    }
  }

  async getPaymentsByReservation(reservationId: string): Promise<Payment[]> {
    return this.paymentRepo.findByReservation(reservationId);
  }

  async getStatistics(): Promise<any> {
    return this.paymentRepo.getStatistics();
  }

  private isInternationalEmail(email: string): boolean {
    return !['br', 'uol.com', 'bol.com.br', 'terra.com.br'].some(d => email.includes(d));
  }
}

export const paymentService = new PaymentService();
