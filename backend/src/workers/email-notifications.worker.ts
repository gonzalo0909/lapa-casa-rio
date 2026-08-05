// lapa-casa-hostel/backend/src/workers/email-notifications.worker.ts
// ventana4

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { notificationService } from '../services/notification-service';
import { logger } from '../utils/logger';
import type { EmailNotificationJobData } from '../queues/email-notifications.queue';
import type { NotificationType } from '../services/notification-service';

export function startEmailNotificationsWorker(): Worker<EmailNotificationJobData> {
  const worker = new Worker<EmailNotificationJobData>(
    'email-notifications',
    async (job: Job<EmailNotificationJobData>) => {
      const { notificationId, reservationId, type } = job.data;
      await notificationService.processScheduled(notificationId, reservationId, type as NotificationType);
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('email-notifications worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
