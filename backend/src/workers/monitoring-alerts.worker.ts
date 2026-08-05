// lapa-casa-hostel/backend/src/workers/monitoring-alerts.worker.ts
// ventana6

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { runScheduledAlertChecks } from '../monitoring/alerts';
import { logger } from '../utils/logger';

export function startMonitoringAlertsWorker(): Worker {
  const worker = new Worker(
    'monitoring-alerts',
    async (_job: Job) => {
      const start = Date.now();
      await runScheduledAlertChecks();
      logger.info('monitoring-alerts worker completado', { ms: Date.now() - start });
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('monitoring-alerts worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
