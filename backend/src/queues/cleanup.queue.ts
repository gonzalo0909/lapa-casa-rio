// lapa-casa-hostel/backend/src/queues/cleanup.queue.ts
// ventana4
//
// Repeatable job cada 1 minuto: invoca sp_cleanup_expired_pending() y
// sp_release_no_show() (0007_procedures.sql). Reemplaza el scheduling
// que hasta ahora vivia en src/crons/index.ts via node-cron -- se
// consolida en BullMQ para que TODO el scheduling de procesos
// programados pase por un solo sistema (el que pide esta ventana),
// no dos en paralelo. node-cron se mantiene en el repo solo para
// src/crons/sync-ota-calendars.ts (Ventana 5, sin relacion).
//
// El intervalo es cada 1 min (no 5) porque el hold de reservas pendientes
// es de 5 min (booking-service.ts) -- con el cleanup corriendo cada 5 min
// una cama podia quedar "ocupada" hasta 5 min extra despues de vencido el
// hold, casi duplicando la espera real.

import { createSafeQueue } from './safe-queue';

export const cleanupQueue = createSafeQueue('cleanup');

const SCHEDULER_ID = 'cleanup-every-1-min';

export async function registerCleanupScheduler(): Promise<void> {
  await cleanupQueue.upsertScheduler(SCHEDULER_ID, { pattern: '*/1 * * * *' }, { name: 'run-cleanup' });
}
