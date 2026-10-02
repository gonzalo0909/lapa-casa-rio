//
// Repeatable job: invoca sp_cleanup_expired_pending() y sp_release_no_show()
// (0007_procedures.sql) y los avisos al huesped (recordatorio unico, despedida).
// Reemplaza el scheduling que vivia en src/crons/index.ts via node-cron -- se
// consolida en BullMQ para que TODO el scheduling pase por un solo sistema.
//
// Frecuencia: cada 2 horas fuera de temporada alta (abr-nov) y cada 5 minutos en
// temporada alta (dic-mar), cuando liberar rapido las fechas de un pago abandonado
// importa mas. Menos corridas tambien = menos comandos de Redis (plan Upstash).
//
// El intervalo es cada 1 min (no 5) porque el hold de reservas pendientes
// es de 5 min (booking-service.ts) -- con el cleanup corriendo cada 5 min
// una cama podia quedar "ocupada" hasta 5 min extra despues de vencido el
// hold, casi duplicando la espera real.

import { createSafeQueue } from './safe-queue';

export const cleanupQueue = createSafeQueue('cleanup');

const LOW_SEASON_ID = 'cleanup-every-2-hours-low-season';
const HIGH_SEASON_ID = 'cleanup-every-5-min-high-season';
const LEGACY_SCHEDULER_ID = 'cleanup-every-1-min';

export async function registerCleanupScheduler(): Promise<void> {
  await cleanupQueue.upsertScheduler(LOW_SEASON_ID, { pattern: '0 */2 * 4-11 *' }, { name: 'run-cleanup' });
  await cleanupQueue.upsertScheduler(HIGH_SEASON_ID, { pattern: '*/5 * * 12,1-3 *' }, { name: 'run-cleanup' });
  await cleanupQueue.removeScheduler(LEGACY_SCHEDULER_ID);
}
