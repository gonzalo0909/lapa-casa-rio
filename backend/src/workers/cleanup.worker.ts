// lapa-casa-hostel/backend/src/workers/cleanup.worker.ts

import { type Job, Worker } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { query } from '../config/database';
import bookingRepo from '../database/repositories/booking-repository';
import { notificationService } from '../services/notification-service';
import { groupPaymentService } from '../services/group-payment-service';
import { logger } from '../utils/logger';
import type { BookingWithGuest } from '../services/email-service';

async function notifyPendingNoShows(): Promise<void> {
  // Idempotente: solo reservas no_show que todavia no tienen una notificacion
  // 'sent' con template no_show -- no depende de una ventana de tiempo, asi
  // que corridas superpuestas del job nunca duplican el envio.
  const { rows } = await query<{ id: string }>(
    `SELECT r.id FROM reservations r
     WHERE r.status = 'no_show'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reservation_id = r.id AND n.template = 'no_show' AND n.status = 'sent'
       )`
  );

  for (const row of rows) {
    const booking = await bookingRepo.findById(row.id);
    if (!booking?.guest) {
      logger.warn('Reserva no_show sin guest cargado, se omite notificación', { reservationId: row.id });
      continue;
    }
    try {
      await notificationService.notify('no_show', booking as BookingWithGuest);
    } catch (error: any) {
      logger.error('Error notificando no-show', { reservationId: row.id, error: error.message });
    }
  }
}

async function notifyExpiredPending(): Promise<void> {
  // Mismo patron idempotente que notifyPendingNoShows(): no depende de una
  // ventana de tiempo, asi que corridas superpuestas del job nunca
  // duplican el envio. cancellation_reason='auto_timeout_pending_expired'
  // es el valor que pone sp_cleanup_expired_pending() (0013_fix_pending_timeout_label.sql)
  // -- distingue esta cancelacion automatica por hold vencido de una
  // cancelacion pedida por el huesped, que ya tiene su propio email.
  const { rows } = await query<{ id: string }>(
    `SELECT r.id FROM reservations r
     WHERE r.status = 'cancelled'
       AND r.cancellation_reason = 'auto_timeout_pending_expired'
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reservation_id = r.id AND n.template = 'booking_expired' AND n.status = 'sent'
       )`
  );

  for (const row of rows) {
    const booking = await bookingRepo.findById(row.id);
    if (!booking?.guest) {
      logger.warn('Reserva expirada sin guest cargado, se omite notificación', { reservationId: row.id });
      continue;
    }
    try {
      await notificationService.notify('booking_expired', booking as BookingWithGuest);
    } catch (error: any) {
      logger.error('Error notificando reserva expirada', { reservationId: row.id, error: error.message });
    }
  }
}

/**
 * Recordatorio de check-in: reservas confirmadas con check-in entre 46h y 50h desde ahora.
 * La ventana de 4h (no 1h exacta) absorbe corridas desfasadas del cron sin
 * enviar duplicados -- el NOT EXISTS en la tabla notifications hace el trabajo real.
 */
async function notifyCheckinReminders(): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT r.id FROM reservations r
     WHERE r.status = 'confirmed'
       AND r.check_in_date::date = (NOW() AT TIME ZONE 'America/Sao_Paulo' + INTERVAL '2 days')::date
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reservation_id = r.id AND n.template = 'checkin_reminder' AND n.status = 'sent'
       )`
  );

  for (const row of rows) {
    const booking = await bookingRepo.findById(row.id);
    if (!booking?.guest) {
      logger.warn('Reserva sin guest para recordatorio de check-in', { reservationId: row.id });
      continue;
    }
    try {
      await notificationService.notify('checkin_reminder', booking as BookingWithGuest);
    } catch (error: any) {
      logger.error('Error enviando recordatorio de check-in', { reservationId: row.id, error: error.message });
    }
  }
}

/**
 * Solicitud de reseña post-checkout: reservas completadas cuyo check-out fue ayer o avant-hier.
 * Se espera ~24h para dar tiempo al huesped de llegar a destino antes de pedirle la reseña.
 */
async function notifyPostCheckoutReviews(): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT r.id FROM reservations r
     WHERE r.status = 'completed'
       AND r.check_out_date::date = (NOW() AT TIME ZONE 'America/Sao_Paulo' - INTERVAL '1 day')::date
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.reservation_id = r.id AND n.template = 'review_request' AND n.status = 'sent'
       )`
  );

  for (const row of rows) {
    const booking = await bookingRepo.findById(row.id);
    if (!booking?.guest) {
      logger.warn('Reserva sin guest para solicitud de reseña', { reservationId: row.id });
      continue;
    }
    try {
      await notificationService.notify('review_request', booking as BookingWithGuest);
    } catch (error: any) {
      logger.error('Error enviando solicitud de reseña', { reservationId: row.id, error: error.message });
    }
  }
}

export function startCleanupWorker(): Worker {
  const worker = new Worker(
    'cleanup',
    async (_job: Job) => {
      const start = Date.now();
      await query('CALL sp_cleanup_expired_pending()');
      await query('CALL sp_release_no_show()');
      await notifyPendingNoShows();
      await notifyExpiredPending();
      await notifyCheckinReminders();
      await notifyPostCheckoutReviews();
      // Feature 2: cancelar sesiones de pago grupal expiradas (timer 30 min)
      const cancelled = await groupPaymentService.cancelExpiredSessions();
      if (cancelled > 0) {logger.info('Sesiones grupales expiradas canceladas', { count: cancelled });}
      logger.info('cleanup worker completado', { ms: Date.now() - start });
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('cleanup worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
