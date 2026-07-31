// lapa-casa-hostel/backend/src/services/payment-service.ts

import { PrismaClient, PaymentStatus, PaymentMethod } from '@prisma/client';
import { addDays, differenceInDays } from 'date-fns';
import Stripe from 'stripe';
import { PaymentRepository } from '../database/repositories/payment-repository';
import { BookingRepository } from '../database/repositories/booking-repository';
import { StripeHandler } from '../lib/payments/stripe-handler';
import { MercadoPagoHandler } from '../lib/payments/mercado-pago-handler';
import { logger } from '../utils/logger';
import { AppError } from '../utils/responses';

interface CreatePaymentIntentDTO {
  bookingId: number;
  amount: number;
  currency: string;
  guestEmail: string;
  paymentMethod?: 'card' | 'pix';
  installments?: number;
}

interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  url?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  expiresAt?: Date;
}

interface ConfirmPaymentDTO {
  paymentIntentId: string;
  bookingId: number;
}

interface RefundDTO {
  bookingId: number;
  amount: number;
  reason: string;
}

interface ScheduledPaymentDTO {
  bookingId: number;
  amount: number;
  scheduledDate: Date;
}

export class PaymentService {
  private paymentRepo: PaymentRepository;
  private bookingRepo: BookingRepository;
  private stripeHandler: StripeHandler;
  private mpHandler: MercadoPagoHandler;
  private readonly STRIPE_RETRY_ATTEMPTS = 3;

  constructor(prisma: PrismaClient) {
    this.paymentRepo = new PaymentRepository(prisma);
    this.bookingRepo = new BookingRepository(prisma);
    this.stripeHandler = new StripeHandler();
    this.mpHandler = new MercadoPagoHandler();
  }

  async createDepositPaymentIntent(data: CreatePaymentIntentDTO): Promise<PaymentIntentResponse> {
    try {
      logger.info('Creando payment intent para depósito', { bookingId: data.bookingId, amount: data.amount });

      const booking = await this.bookingRepo.findById(data.bookingId);
      if (!booking) throw new AppError('Reserva no encontrada', 404);
      if (booking.depositPaid) throw new AppError('El depósito ya ha sido pagado', 400);

      const isInternational = await this.isInternationalBooking(data.guestEmail);
      const preferredMethod = data.paymentMethod || (isInternational ? 'card' : 'pix');

      let paymentIntent: PaymentIntentResponse;

      if (preferredMethod === 'pix' || data.currency === 'BRL') {
        paymentIntent = await this.mpHandler.createPaymentIntent({
          amount: data.amount,
          currency: data.currency,
          description: `Depósito - Reserva ${booking.bookingId}`,
          payerEmail: data.guestEmail,
          paymentMethod: preferredMethod,
          installments: data.installments,
          metadata: { bookingId: booking.bookingId, paymentType: 'deposit' }
        });
      } else {
        paymentIntent = await this.stripeHandler.createPaymentIntent({
          amount: data.amount,
          currency: data.currency,
          customerEmail: data.guestEmail,
          description: `Deposit - Booking ${booking.bookingId}`,
          metadata: { bookingId: booking.bookingId, paymentType: 'deposit' }
        });
      }

      await this.paymentRepo.create({
        bookingId: data.bookingId,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: data.amount,
        currency: data.currency,
        status: 'PENDING',
        paymentMethod: preferredMethod.toUpperCase() as PaymentMethod,
        processor: preferredMethod === 'pix' ? 'MERCADO_PAGO' : 'STRIPE',
        metadata: { type: 'deposit', installments: data.installments }
      });

      const expiresAt = addDays(new Date(), 1);
      await this.bookingRepo.update(data.bookingId, { paymentExpiresAt: expiresAt });

      logger.info('Payment intent creado exitosamente', { paymentIntentId: paymentIntent.paymentIntentId });

      return { ...paymentIntent, expiresAt };
    } catch (error) {
      logger.error('Error creando payment intent', error);
      throw error;
    }
  }

  async confirmPayment(data: ConfirmPaymentDTO): Promise<any> {
    try {
      logger.info('Confirmando pago', { paymentIntentId: data.paymentIntentId });

      const payment = await this.paymentRepo.findByPaymentIntentId(data.paymentIntentId);
      if (!payment) throw new AppError('Pago no encontrado', 404);
      if (payment.status === 'COMPLETED') throw new AppError('El pago ya fue confirmado', 400);

      let verified = false;
      if (payment.processor === 'STRIPE') {
        verified = await this.stripeHandler.verifyPayment(data.paymentIntentId);
      } else if (payment.processor === 'MERCADO_PAGO') {
        verified = await this.mpHandler.verifyPayment(data.paymentIntentId);
      }

      if (!verified) throw new AppError('No se pudo verificar el pago', 400);

      const confirmedPayment = await this.paymentRepo.update(payment.id, {
        status: 'COMPLETED',
        paidAt: new Date()
      });

      const booking = await this.bookingRepo.findById(payment.bookingId);

      if (payment.metadata?.type === 'deposit') {
        await this.bookingRepo.update(payment.bookingId, {
          depositPaid: true,
          depositPaidAt: new Date(),
          status: 'CONFIRMED'
        });
      } else if (payment.metadata?.type === 'remaining') {
        await this.bookingRepo.update(payment.bookingId, {
          remainingPaid: true,
          remainingPaidAt: new Date(),
          fullyPaid: true
        });
      }

      logger.info('Pago confirmado exitosamente', { paymentId: payment.id, bookingId: booking.bookingId });

      return confirmedPayment;
    } catch (error) {
      logger.error('Error confirmando pago', error);
      throw error;
    }
  }

  async processDeposit(data: CreatePaymentIntentDTO): Promise<PaymentIntentResponse> {
    return this.createDepositPaymentIntent(data);
  }

  async scheduleRemainingPayment(data: ScheduledPaymentDTO): Promise<any> {
    try {
      logger.info('Programando cobro de saldo restante', { bookingId: data.bookingId, scheduledDate: data.scheduledDate });

      const booking = await this.bookingRepo.findById(data.bookingId);
      if (!booking) throw new AppError('Reserva no encontrada', 404);
      if (!booking.depositPaid) throw new AppError('El depósito debe estar pagado primero', 400);
      if (booking.remainingPaid) throw new AppError('El saldo restante ya fue pagado', 400);

      const scheduledPayment = await this.paymentRepo.create({
        bookingId: data.bookingId,
        amount: data.amount,
        currency: 'BRL',
        status: 'SCHEDULED',
        paymentMethod: 'CARD',
        processor: 'STRIPE',
        scheduledDate: data.scheduledDate,
        metadata: { type: 'remaining', autoCharge: true }
      });

      logger.info('Cobro programado exitosamente', { paymentId: scheduledPayment.id, scheduledDate: data.scheduledDate });

      return scheduledPayment;
    } catch (error) {
      logger.error('Error programando cobro', error);
      throw error;
    }
  }

  async processScheduledPayments(): Promise<any[]> {
    try {
      const today = new Date();
      const scheduledPayments = await this.paymentRepo.findScheduledPayments(today);
      const results = [];

      for (const payment of scheduledPayments) {
        try {
          const booking = await this.bookingRepo.findById(payment.bookingId);

          if (!booking || booking.status === 'CANCELLED') {
            await this.paymentRepo.update(payment.id, { status: 'CANCELLED' });
            continue;
          }

          const result = await this.stripeHandler.chargeCustomer({
            customerId: booking.guest.stripeCustomerId,
            amount: payment.amount,
            currency: payment.currency,
            description: `Saldo restante - Reserva ${booking.bookingId}`,
            metadata: { bookingId: booking.bookingId, paymentId: payment.id }
          });

          if (result.success) {
            await this.paymentRepo.update(payment.id, {
              status: 'COMPLETED',
              paidAt: new Date(),
              paymentIntentId: result.chargeId
            });

            await this.bookingRepo.update(payment.bookingId, {
              remainingPaid: true,
              remainingPaidAt: new Date(),
              fullyPaid: true
            });

            results.push({ success: true, paymentId: payment.id });
          } else {
            const retryCount = (payment.metadata?.retryCount || 0) + 1;

            if (retryCount < this.STRIPE_RETRY_ATTEMPTS) {
              await this.paymentRepo.update(payment.id, {
                status: 'PENDING_RETRY',
                metadata: { ...payment.metadata, retryCount, lastRetryAt: new Date() }
              });
            } else {
              await this.paymentRepo.update(payment.id, {
                status: 'FAILED',
                metadata: { ...payment.metadata, failureReason: result.error }
              });
            }

            results.push({ success: false, paymentId: payment.id, error: result.error });
          }
        } catch (error) {
          logger.error('Error procesando cobro programado', { paymentId: payment.id, error });
          results.push({ success: false, paymentId: payment.id, error });
        }
      }

      logger.info('Cobros programados procesados', { total: results.length, successful: results.filter(r => r.success).length });

      return results;
    } catch (error) {
      logger.error('Error procesando cobros programados', error);
      throw error;
    }
  }

  async processRefund(data: RefundDTO): Promise<any> {
    try {
      logger.info('Procesando reembolso', { bookingId: data.bookingId, amount: data.amount });

      const booking = await this.bookingRepo.findById(data.bookingId);
      if (!booking) throw new AppError('Reserva no encontrada', 404);

      const originalPayment = await this.paymentRepo.findByBookingId(data.bookingId);
      if (!originalPayment || originalPayment.status !== 'COMPLETED') {
        throw new AppError('No hay pago completado para reembolsar', 400);
      }

      let refundResult;
      if (originalPayment.processor === 'STRIPE') {
        refundResult = await this.stripeHandler.createRefund({
          paymentIntentId: originalPayment.paymentIntentId,
          amount: data.amount,
          reason: data.reason
        });
      } else if (originalPayment.processor === 'MERCADO_PAGO') {
        refundResult = await this.mpHandler.createRefund({
          paymentId: originalPayment.paymentIntentId,
          amount: data.amount
        });
      }

      const refund = await this.paymentRepo.create({
        bookingId: data.bookingId,
        amount: -data.amount,
        currency: originalPayment.currency,
        status: 'COMPLETED',
        paymentMethod: originalPayment.paymentMethod,
        processor: originalPayment.processor,
        paidAt: new Date(),
        metadata: {
          type: 'refund',
          originalPaymentId: originalPayment.id,
          reason: data.reason,
          refundId: refundResult.refundId
        }
      });

      logger.info('Reembolso procesado exitosamente', { refundId: refund.id, amount: data.amount });

      return refund;
    } catch (error) {
      logger.error('Error procesando reembolso', error);
      throw error;
    }
  }

  async handleStripeWebhook(event: Stripe.Event): Promise<any> {
    try {
      logger.info('Procesando webhook de Stripe', { type: event.type });

      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        case 'charge.refunded':
          return await this.handleRefundCompleted(event.data.object as Stripe.Charge);
        default:
          logger.debug('Evento de webhook no manejado', { type: event.type });
      }
    } catch (error) {
      logger.error('Error procesando webhook de Stripe', error);
      throw error;
    }
  }

  async handleMercadoPagoWebhook(data: any): Promise<any> {
    try {
      logger.info('Procesando webhook de Mercado Pago', { type: data.type });

      if (data.type === 'payment') {
        const payment = await this.mpHandler.getPayment(data.data.id);
        if (payment.status === 'approved') {
          return await this.confirmPayment({
            paymentIntentId: payment.id.toString(),
            bookingId: parseInt(payment.metadata.booking_id)
          });
        }
      }
    } catch (error) {
      logger.error('Error procesando webhook de Mercado Pago', error);
      throw error;
    }
  }

  async getPaymentHistory(bookingId: number): Promise<any[]> {
    return this.paymentRepo.findByBookingId(bookingId);
  }

  async getPaymentStats(from: Date, to: Date): Promise<any> {
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

    payments.forEach(payment => {
      if (payment.status === 'COMPLETED') {
        if (payment.amount > 0) {
          stats.totalRevenue += payment.amount;
          stats.successfulPayments++;
        } else {
          stats.totalRefunds += Math.abs(payment.amount);
        }
      } else if (payment.status === 'FAILED') {
        stats.failedPayments++;
      } else if (payment.status === 'PENDING') {
        stats.pendingPayments++;
      }

      if (payment.paymentMethod === 'CARD') stats.paymentMethodBreakdown.card++;
      if (payment.paymentMethod === 'PIX') stats.paymentMethodBreakdown.pix++;
      if (payment.processor === 'STRIPE') stats.processorBreakdown.stripe++;
      if (payment.processor === 'MERCADO_PAGO') stats.processorBreakdown.mercadoPago++;
    });

    stats.averagePaymentValue = stats.totalRevenue / (stats.successfulPayments || 1);

    return stats;
  }

  private async isInternationalBooking(email: string): Promise<boolean> {
    const brazilianDomains = ['.br', 'uol.com', 'bol.com.br', 'terra.com.br'];
    return !brazilianDomains.some(domain => email.includes(domain));
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const bookingId = paymentIntent.metadata.bookingId;
    if (bookingId) {
      await this.confirmPayment({
        paymentIntentId: paymentIntent.id,
        bookingId: parseInt(bookingId)
      });
    }
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepo.findByPaymentIntentId(paymentIntent.id);
    if (payment) {
      await this.paymentRepo.update(payment.id, {
        status: 'FAILED',
        metadata: { ...payment.metadata, failureReason: paymentIntent.last_payment_error?.message }
      });
    }
  }

  private async handleRefundCompleted(charge: Stripe.Charge): Promise<void> {
    logger.info('Reembolso completado', { chargeId: charge.id });
  }
}
