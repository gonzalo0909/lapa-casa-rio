// lapa-casa-hostel/backend/src/queues/cleanup.queue.ts
// ventana4
//
// Repeatable job cada 5 minutos: invoca sp_cleanup_expired_pending() y
// sp_release_no_show() (0007_procedures.sql). Reemplaza el scheduling
// que hasta ahora vivia en src/crons/index.ts via node-cron -- se
// consolida en BullMQ para que TODO el scheduling de procesos
// programados pase por un solo sistema (el que pide esta ventana),
// no dos en paralelo. node-cron se mantiene en el repo solo para
// src/crons/sync-ota-calendars.ts (Ventana 5, sin relacion).

import { createSafeQueue } from './safe-queue';

export const cleanupQueue = createSafeQueue('cleanup');

const SCHEDULER_ID = 'cleanup-every-5-min';

export async function registerCleanupScheduler(): Promise<void> {
  await cleanupQueue.upsertScheduler(SCHEDULER_ID, { pattern: '*/5 * * * *' }, { name: 'run-cleanup' });
}
