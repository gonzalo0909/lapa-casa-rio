// lapa-casa-hostel/backend/src/services/payment-service.ts

import { PaymentRepository } from '../database/repositories/payment-repository';
import { BookingRepository } from '../database/repositories/booking-repository';
import { stripeHandler } from '../lib/payments/stripe-handler';
import { mercadoPagoHandler } from '../lib/payments/mercado-pago-handler';
import { logger } from '../utils/logger';
import { query } from '../config/database';

interface CreatePaymentDTO {
  reservationId: string;
  guestId?: string;
  amount: number;
  currency?: string;
  paymentMethod?: 'card' | 'pix';
  paymentType?: 'deposit' | 'remaining';
  guestEmail?: string;
  guestName?: string;
  guestDocument?: string;
  description?: string;
  installments?: number;
}

interface PaymentIntentResponse {
  paymentId: string;
  clientSecret?: string;
  url?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  amount: number;
  currency: string;
  status: string;
  expiresAt?: Date;
}

interface RefundDTO {
  reservationId: string;
  amount: number;
  reason?: string;
}

export class PaymentService {
  private paymentRepo: PaymentRepository;
  private bookingRepo: BookingRepository;

  constructor() {
    this.paymentRepo = new PaymentRepository();
    this.bookingRepo = new BookingRepository();
  }

  async createPixPayment(data: CreatePaymentDTO): Promise<PaymentIntentResponse> {
    try {
      const result = await mercadoPagoHandler.createPixPayment({
        bookingId: data.reservationId,
        amount: data.amount,
        customerEmail: data.guestEmail || '',
        customerName: data.guestName || 'Guest',
        customerDocument: data.guestDocument || '',
        description: data.description || `Reserva ${data.reservationId}`,
        expirationMinutes: 30
      });

      if (!result.success) throw new Error(result.error || 'Error al crear pago PIX');

      await this.paymentRepo.create({
        reservation_id: data.reservationId,
        guest_id: data.guestId,
        amount: data.amount,
        currency: data.currency || 'BRL',
        payment_method: 'pix',
        payment_type: data.paymentType || 'deposit',
        status: 'pending',
        mp_payment_id: result.paymentId
      });

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      return {
        paymentId: result.paymentId,
        qrCode: result.qrCode,
        qrCodeBase64: result.qrCodeBase64,
        ticketUrl: result.ticketUrl,
        amount: data.amount,
        currency: data.currency || 'BRL',
        status: result.status,
        expiresAt
      };
    } catch (error) {
      logger.error('Error creando pago PIX', error);
      throw error;
    }
  }

  async createStripePayment(data: CreatePaymentDTO): Promise<PaymentIntentResponse> {
    try {
      const result = await stripeHandler.createPaymentIntent({
        bookingId: data.reservationId,
        amount: data.amount,
        currency: data.currency || 'BRL',
        customerEmail: data.guestEmail || '',
        customerName: data.guestName || 'Guest',
        description: data.description || `Reserva ${data.reservationId}`,
        metadata: {
          paymentType: data.paymentType || 'deposit',
          reservationId: data.reservationId
        }
      });

      if (!result.success) throw new Error(result.error || 'Error al crear pago Stripe');

      await this.paymentRepo.create({
        reservation_id: data.reservationId,
        guest_id: data.guestId,
        amount: data.amount,
        currency: data.currency || 'BRL',
        payment_method: 'card',
        payment_type: data.paymentType || 'deposit',
        status: 'pending',
        stripe_payment_intent_id: result.paymentIntentId
      });

      return {
        paymentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        amount: data.amount,
        currency: result.currency,
        status: result.status
      };
    } catch (error) {
      logger.error('Error creando pago Stripe', error);
      throw error;
    }
  }

  async createPayment(data: CreatePaymentDTO): Promise<PaymentIntentResponse> {
    const usePixOrBRL = data.paymentMethod === 'pix' || (data.currency || 'BRL') === 'BRL';
    if (usePixOrBRL && data.paymentMethod !== 'card') {
      return this.createPixPayment(data);
    }
    return this.createStripePayment(data);
  }

  async confirmPayment(providerPaymentId: string, provider: 'stripe' | 'mercadopago'): Promise<void> {
    try {
      let payment;
      if (provider === 'stripe') {
        payment = await this.paymentRepo.findByStripeIntent(providerPaymentId);
      } else {
        payment = await this.paymentRepo.findByMPId(providerPaymentId);
      }

      if (!payment) throw new Error('Pago no encontrado');
      if (payment.status === 'completed') return;

      await this.paymentRepo.markCompleted(payment.id);

      await query(
        `UPDATE reservations SET
           status = CASE WHEN payment_type = 'deposit' THEN 'confirmed' ELSE status END,
           updated_at = NOW()
         WHERE id = $1`,
        [payment.reservation_id]
      );

      logger.info('Pago confirmado', { paymentId: payment.id, reservationId: payment.reservation_id });
    } catch (error) {
      logger.error('Error confirmando pago', error);
      throw error;
    }
  }

  async processRefund(data: RefundDTO): Promise<void> {
    try {
      const payments = await this.paymentRepo.findByReservation(data.reservationId);
      const completed = payments.find(p => p.status === 'completed');

      if (!completed) throw new Error('No hay pago completado para reembolsar');

      if (completed.provider === 'stripe' && completed.provider_payment_id) {
        await stripeHandler.refundPayment(completed.provider_payment_id, data.amount, data.reason);
      } else if (completed.provider === 'mercadopago' && completed.provider_payment_id) {
        await mercadoPagoHandler.refundPayment(completed.provider_payment_id, data.amount);
      }

      await this.paymentRepo.processRefund(completed.id, data.amount);

      logger.info('Reembolso procesado', { reservationId: data.reservationId, amount: data.amount });
    } catch (error) {
      logger.error('Error procesando reembolso', error);
      throw error;
    }
  }

  async handleStripeWebhook(payload: string | Buffer, signature: string): Promise<void> {
    try {
      const event = await stripeHandler.handleWebhook(payload, signature);
      if (!event) return;

      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object as any;
        await this.confirmPayment(pi.id, 'stripe');
      } else if (event.type === 'payment_intent.payment_failed') {
        const pi = event.data.object as any;
        const payment = await this.paymentRepo.findByStripeIntent(pi.id);
        if (payment) {
          await this.paymentRepo.markFailed(payment.id, pi.last_payment_error?.message);
        }
      }
    } catch (error) {
      logger.error('Error procesando webhook Stripe', error);
      throw error;
    }
  }

  async handleMercadoPagoWebhook(notification: { id: string; action: string; type: string; data: { id: string } }): Promise<void> {
    try {
      await mercadoPagoHandler.handleWebhook(notification);

      if (notification.type === 'payment') {
        const status = await mercadoPagoHandler.getPaymentStatus(notification.data.id);
        if (status.status === 'approved') {
          await this.confirmPayment(notification.data.id, 'mercadopago');
        } else if (status.status === 'rejected' || status.status === 'cancelled') {
          const payment = await this.paymentRepo.findByMPId(notification.data.id);
          if (payment) {
            await this.paymentRepo.markFailed(payment.id, status.statusDetail);
          }
        }
      }
    } catch (error) {
      logger.error('Error procesando webhook MercadoPago', error);
      throw error;
    }
  }

  async getPaymentsByReservation(reservationId: string) {
    return this.paymentRepo.findByReservation(reservationId);
  }

  async getPaymentStats(from: Date, to: Date) {
    const payments = await this.paymentRepo.findByDateRange(from, to);

    const stats = {
      totalRevenue: 0,
      totalRefunds: 0,
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      averagePaymentValue: 0,
      paymentMethodBreakdown: { card: 0, pix: 0 },
      processorBreakdown: { stripe: 0, mercadoPago: 0 }
    };

    for (const p of payments) {
      if (p.status === 'completed') {
        stats.totalRevenue += p.amount;
        stats.successfulPayments++;
      } else if (p.status === 'failed') {
        stats.failedPayments++;
      } else if (p.status === 'pending') {
        stats.pendingPayments++;
      } else if (p.status === 'refunded') {
        stats.totalRefunds += p.refund_amount ?? p.amount;
      }

      if (p.provider === 'stripe') stats.processorBreakdown.stripe++;
      else stats.processorBreakdown.mercadoPago++;
    }

    stats.averagePaymentValue = stats.totalRevenue / (stats.successfulPayments || 1);
    return stats;
  }

  async getPendingPayments() {
    return this.paymentRepo.findPending();
  }
}

export const paymentService = new PaymentService();
