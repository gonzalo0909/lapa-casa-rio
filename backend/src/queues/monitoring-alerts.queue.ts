// lapa-casa-hostel/backend/src/queues/monitoring-alerts.queue.ts
// ventana6
//
// Repeatable job diario (09:00 America/Sao_Paulo aproximado -- BullMQ
// corre en UTC, ver nota abajo): corre runScheduledAlertChecks()
// (monitoring/alerts.ts) -- fechas de Carnaval del año siguiente
// faltantes y servicios criticos caidos. Mismo patron que
// cleanup.queue.ts: todo el scheduling pasa por BullMQ, no node-cron.

import { createSafeQueue } from './safe-queue';

export const monitoringAlertsQueue = createSafeQueue('monitoring-alerts');

const SCHEDULER_ID = 'monitoring-alerts-daily';

// '0 12 * * *' UTC = 09:00 en America/Sao_Paulo (UTC-3, sin horario de
// verano desde 2019). Un job diario no necesita mas precision que esta.
export async function registerMonitoringAlertsScheduler(): Promise<void> {
  await monitoringAlertsQueue.upsertScheduler(SCHEDULER_ID, { pattern: '0 12 * * *' }, { name: 'run-alert-checks' });
}
