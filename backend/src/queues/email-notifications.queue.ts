// lapa-casa-hostel/backend/src/queues/email-notifications.queue.ts
// ventana4
//
// Cola para el envio asincrono de emails. `notification-service.ts` la
// usa para programar notificaciones (ej. recordatorio de pago, mensaje
// de bienvenida 1 dia antes) sin bloquear el request HTTP que las
// dispara. El worker (workers/email-notifications.worker.ts) es quien
// realmente llama a emailService.

import { createSafeQueue } from './safe-queue';

export interface EmailNotificationJobData {
  notificationId: string;
  reservationId: string;
  type: string;
}

export const emailNotificationsQueue = createSafeQueue<EmailNotificationJobData>('email-notifications', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 }
});
