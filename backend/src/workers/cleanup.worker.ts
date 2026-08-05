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

export function startCleanupWorker(): Worker {
  const worker = new Worker(
    'cleanup',
    async (_job: Job) => {
      const start = Date.now();
      await query('CALL sp_cleanup_expired_pending()');
      await query('CALL sp_release_no_show()');
      await notifyPendingNoShows();
      logger.info('cleanup worker completado', { ms: Date.now() - start });
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('cleanup worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
