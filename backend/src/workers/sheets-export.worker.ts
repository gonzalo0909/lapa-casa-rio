// lapa-casa-hostel/backend/src/workers/sheets-export.worker.ts
// ventana4 (bloque 2)
//
// Procesa el espejo DB -> Sheets. Si Google Sheets no está configurado
// (ver sheets-client.ts), upsertBookingInSheet/deleteBookingFromSheet
// son no-ops que solo loguean -- el job se marca completado igual, no
// tiene sentido reintentarlo hasta que alguien cargue las credenciales.

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { upsertBookingInSheet, deleteBookingFromSheet } from '../integrations/google-sheets/booking-export';
import { logger } from '../utils/logger';
import type { SheetsExportJobData } from '../queues/sheets-export.queue';

export function startSheetsExportWorker(): Worker<SheetsExportJobData> {
  const worker = new Worker<SheetsExportJobData>(
    'sheets-export',
    async (job: Job<SheetsExportJobData>) => {
      const { reservationId, action } = job.data;
      if (action === 'delete') {
        await deleteBookingFromSheet(reservationId);
      } else {
        await upsertBookingInSheet(reservationId);
      }
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('sheets-export worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
