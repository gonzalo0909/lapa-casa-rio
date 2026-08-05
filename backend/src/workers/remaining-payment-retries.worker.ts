// lapa-casa-hostel/backend/src/workers/remaining-payment-retries.worker.ts
// ventana4
//
// Verifica si el saldo restante ya se pago; si no, registra el intento
// en `payment_retries` (tabla real), reenvia el recordatorio y
// reprograma el siguiente intento. Al agotar los 3 intentos, escala a
// resolucion manual con un admin-alert (ver nota de limitacion real en
// queues/remaining-payment-retries.queue.ts: no hay cobro automatico
// off-session todavia, asi que "reintento" es reenviar el link de pago).

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { query } from '../config/database';
import bookingRepo from '../database/repositories/booking-repository';
import { paymentService } from '../services/payment-service';
import { notificationService } from '../services/notification-service';
import { emailService } from '../services/email-service';
import { scheduleNextRetry } from '../queues/remaining-payment-retries.queue';
import { logger } from '../utils/logger';
import type { RemainingPaymentRetryJobData } from '../queues/remaining-payment-retries.queue';
import type { BookingWithGuest } from '../services/email-service';

export function startRemainingPaymentRetriesWorker(): Worker<RemainingPaymentRetryJobData> {
  const worker = new Worker<RemainingPaymentRetryJobData>(
    'remaining-payment-retries',
    async (job: Job<RemainingPaymentRetryJobData>) => {
      const { reservationId, attemptNumber } = job.data;

      const booking = await bookingRepo.findById(reservationId);
      if (!booking || !booking.guest) {
        logger.warn('remaining-payment-retries: reserva o guest no encontrado, se omite', { reservationId });
        return;
      }
      if (booking.status !== 'confirmed') {
        logger.info('remaining-payment-retries: reserva ya no está confirmed, se detiene la cadena de reintentos', { reservationId, status: booking.status });
        return;
      }

      const payments = await paymentService.getPaymentsByReservation(reservationId);
      const remainingPayment = payments.find(p => p.payment_type === 'remaining');
      if (!remainingPayment) {
        logger.warn('remaining-payment-retries: no hay payment intent de saldo, se omite', { reservationId });
        return;
      }
      if (remainingPayment.status === 'succeeded') {
        logger.info('remaining-payment-retries: saldo ya pagado, cadena de reintentos termina', { reservationId, attemptNumber });
        return;
      }

      const isLastAttempt = attemptNumber >= 3;
      await query(
        `INSERT INTO payment_retries (payment_id, attempt_number, provider, status, next_retry_at, failure_reason)
         VALUES ($1, $2, $3, 'failed', $4, $5)`,
        [
          remainingPayment.id,
          attemptNumber,
          remainingPayment.provider,
          isLastAttempt ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
          'remaining_balance_unpaid_at_retry_check'
        ]
      );

      if (isLastAttempt) {
        await emailService.sendAdminAlert('PAYMENT_RETRIES_EXHAUSTED', {
          reservationNumber: booking.reservation_number,
          guestEmail: booking.guest.email,
          remainingAmount: booking.remaining_amount,
          provider: remainingPayment.provider
        });
        logger.warn('remaining-payment-retries: 3 intentos agotados, escalado a admin-alert', { reservationId });
        return;
      }

      await notificationService.notify('payment_reminder', booking as BookingWithGuest);
      await scheduleNextRetry(reservationId, (attemptNumber + 1) as 2 | 3);
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('remaining-payment-retries worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
