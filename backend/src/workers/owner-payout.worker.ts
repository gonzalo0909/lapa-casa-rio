import { Worker, type Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { releaseDueOwnerPayouts } from '../services/owner-payout-service';
import { logger } from '../utils/logger';

export function startOwnerPayoutWorker(): Worker {
  const worker = new Worker(
    'owner-payout',
    async (_job: Job) => {
      const res = await releaseDueOwnerPayouts();
      logger.info('owner-payout worker completado', res);
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('owner-payout worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
