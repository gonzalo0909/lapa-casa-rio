// lapa-casa-hostel/backend/src/workers/ota-sync.worker.ts
// ventana4 (estructura base -- activación real en Ventana 5)
//
// La sincronización real con OTAs ya corre hoy vía
// src/crons/sync-ota-calendars.ts (node-cron). Este worker solo existe
// para que la cola declarada en ota-sync.queue.ts tenga un consumidor;
// no duplica esa sincronización.

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { logger } from '../utils/logger';
import type { OtaSyncJobData } from '../queues/ota-sync.queue';

export function startOtaSyncWorker(): Worker<OtaSyncJobData> {
  const worker = new Worker<OtaSyncJobData>(
    'ota-sync',
    async (job: Job<OtaSyncJobData>) => {
      logger.warn('ota-sync: no activado en Ventana 4 (ver src/crons/sync-ota-calendars.ts) — job descartado', {
        channelCode: job.data.channelCode
      });
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('ota-sync worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
