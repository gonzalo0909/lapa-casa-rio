// lapa-casa-hostel/backend/src/workers/sheets-export.worker.ts
// ventana4 (bloque 2 pendiente)
//
// Se levanta ya para que la cola no acumule jobs sin consumidor, pero el
// export real a Google Sheets se implementa en el Bloque 2 (requiere
// GOOGLE_SHEETS_ID + credenciales de service account, todavia no
// configuradas). Por ahora deja constancia clara en el log en vez de
// fallar silenciosamente o fingir que exportó algo.

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { logger } from '../utils/logger';
import type { SheetsExportJobData } from '../queues/sheets-export.queue';

export function startSheetsExportWorker(): Worker<SheetsExportJobData> {
  const worker = new Worker<SheetsExportJobData>(
    'sheets-export',
    async (job: Job<SheetsExportJobData>) => {
      logger.warn('sheets-export: integración no implementada todavía (Bloque 2) — job descartado', {
        reservationId: job.data.reservationId,
        action: job.data.action
      });
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('sheets-export worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
