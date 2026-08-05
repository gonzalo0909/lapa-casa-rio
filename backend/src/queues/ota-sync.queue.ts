// lapa-casa-hostel/backend/src/queues/ota-sync.queue.ts
// ventana5
//
// Repeatable job cada 5 minutos (ICAL_IMPORT_INTERVAL_MINUTES,
// config/channels.ts): invoca icalService.syncICalFeeds() completo
// (Airbnb/Hostelworld + respaldo Booking/Expedia) y despues
// conflictService.detectConflicts() para auto-resolver por prioridad de
// canal lo que haya quedado abierto (ver workers/ota-sync.worker.ts).
// Reemplaza a src/crons/sync-ota-calendars.ts (node-cron, retirado en
// esta ventana) -- consolida TODO el scheduling en BullMQ, igual que ya
// se hizo con cleanup/flexible-conversion en Ventana 4.

import { createSafeQueue } from './safe-queue';

export interface OtaSyncJobData {
  triggeredBy?: 'scheduler' | 'manual';
}

export const otaSyncQueue = createSafeQueue<OtaSyncJobData>('ota-sync', { attempts: 3 });

const SCHEDULER_ID = 'ota-sync-every-5-min';

export async function registerOtaSyncScheduler(): Promise<void> {
  await otaSyncQueue.upsertScheduler(
    SCHEDULER_ID,
    { pattern: '*/5 * * * *' },
    { name: 'run-ota-sync', data: { triggeredBy: 'scheduler' } }
  );
}
