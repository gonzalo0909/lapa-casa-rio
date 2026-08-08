// lapa-casa-hostel/backend/src/workers/cleanup.worker.ts
// ventana4

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { query } from '../config/database';
import bookingRepo from '../database/repositories/booking-repository';
import { notificationService } from '../services/notification-service';
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
  // duplican el envio. cancellation_reason='auto_timeout_15min' es el
  // valor que pone sp_cleanup_expired_pending() (0007_procedures.sql) --
  // distingue esta cancelacion automatica por hold vencido de una
  // cancelacion pedida por el huesped, que ya tiene su propio email.
  const { rows } = await query<{ id: string }>(
    `SELECT r.id FROM reservations r
     WHERE r.status = 'cancelled'
       AND r.cancellation_reason = 'auto_timeout_15min'
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

export function startCleanupWorker(): Worker {
  const worker = new Worker(
    'cleanup',
    async (_job: Job) => {
      const start = Date.now();
      await query('CALL sp_cleanup_expired_pending()');
      await query('CALL sp_release_no_show()');
      await notifyPendingNoShows();
      await notifyExpiredPending();
      logger.info('cleanup worker completado', { ms: Date.now() - start });
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('cleanup worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
