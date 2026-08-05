// lapa-casa-hostel/backend/src/workers/remaining-payment.worker.ts
// ventana4
//
// Corre 7 dias antes del check-in (encolado por confirm-payment.ts via
// scheduleRemainingPayment). Crea el payment intent del saldo restante,
// con el MISMO proveedor que el deposito (POLITICAS OPERATIVAS del
// Maestro -- sin fallback cross-provider), y dispara el primer
// recordatorio. Los reintentos posteriores los maneja
// remaining-payment-retries.worker.ts.

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import bookingRepo from '../database/repositories/booking-repository';
import { paymentService } from '../services/payment-service';
import { notificationService } from '../services/notification-service';
import { scheduleNextRetry } from '../queues/remaining-payment-retries.queue';
import { logger } from '../utils/logger';
import type { RemainingPaymentJobData } from '../queues/remaining-payment.queue';
import type { BookingWithGuest } from '../services/email-service';

export function startRemainingPaymentWorker(): Worker<RemainingPaymentJobData> {
  const worker = new Worker<RemainingPaymentJobData>(
    'remaining-payment',
    async (job: Job<RemainingPaymentJobData>) => {
      const { reservationId } = job.data;
      const booking = await bookingRepo.findById(reservationId);

      if (!booking || !booking.guest) {
        logger.warn('remaining-payment: reserva o guest no encontrado, se omite', { reservationId });
        return;
      }
      if (booking.status !== 'confirmed') {
        logger.info('remaining-payment: reserva ya no está confirmed, se omite', { reservationId, status: booking.status });
        return;
      }
      if (Number(booking.remaining_amount) <= 0) {
        logger.info('remaining-payment: sin saldo pendiente, se omite', { reservationId });
        return;
      }

      const existingPayments = await paymentService.getPaymentsByReservation(reservationId);
      const alreadySucceeded = existingPayments.some(p => p.payment_type === 'remaining' && p.status === 'succeeded');
      if (alreadySucceeded) {
        logger.info('remaining-payment: saldo ya pagado, se omite', { reservationId });
        return;
      }

      const depositPayment = existingPayments.find(p => p.payment_type === 'deposit' && p.status === 'succeeded');
      const provider = depositPayment?.provider ?? 'stripe';

      await paymentService.createPaymentIntent({
        reservation_id: reservationId,
        guest_id: booking.guest.id,
        amount: Number(booking.remaining_amount),
        guest_email: booking.guest.email,
        payment_type: 'remaining',
        provider
      });

      await notificationService.notify('payment_reminder', booking as BookingWithGuest);
      await scheduleNextRetry(reservationId, 1);

      logger.info('remaining-payment: payment intent creado y recordatorio enviado', { reservationId, provider });
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('remaining-payment worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
