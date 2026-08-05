// lapa-casa-hostel/backend/src/workers/flexible-conversion.worker.ts
// ventana4

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { query } from '../config/database';
import { logger } from '../utils/logger';

export function startFlexibleConversionWorker(): Worker {
  const worker = new Worker(
    'flexible-conversion',
    async (_job: Job) => {
      const start = Date.now();
      await query('CALL sp_process_flexible_conversion()');
      logger.info('flexible-conversion worker completado', { ms: Date.now() - start });
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('flexible-conversion worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
