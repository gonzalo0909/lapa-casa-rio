//
// Repeatable job cada 30 minutos: corre runScheduledAlertChecks()
// (monitoring/alerts.ts) -- servicios criticos caidos y sincronizacion
// iCal/OTA detenida. Cada alerta se deduplica por transicion, asi que correr
// seguido no repite emails. Mismo patron que
// cleanup.queue.ts: todo el scheduling pasa por BullMQ, no node-cron.

import { createSafeQueue } from './safe-queue';

export const monitoringAlertsQueue = createSafeQueue('monitoring-alerts');

const SCHEDULER_ID = 'monitoring-alerts-every-30-min';

export async function registerMonitoringAlertsScheduler(): Promise<void> {
  await monitoringAlertsQueue.upsertScheduler(SCHEDULER_ID, { pattern: '*/30 * * * *' }, { name: 'run-alert-checks' });
}
