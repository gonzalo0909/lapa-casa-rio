// lapa-casa-hostel/backend/src/workers/index.ts
//
// Punto de entrada del proceso de workers -- separado del servidor HTTP
// (src/server.ts). Se corre con `npm run worker` (prod) / `npm run
// worker:dev` (dev, tsx watch). Requiere REDIS_URL real: sin ella, los
// workers no tienen nada que consumir (ver queues/connection.ts).

import { queuesEnabled } from '../queues/connection';
import { registerCleanupScheduler } from '../queues/cleanup.queue';
import { registerFlexibleConversionScheduler } from '../queues/flexible-conversion.queue';
import { registerOtaSyncScheduler } from '../queues/ota-sync.queue';
import { registerMonitoringAlertsScheduler } from '../queues/monitoring-alerts.queue';
import { startCleanupWorker } from './cleanup.worker';
import { startFlexibleConversionWorker } from './flexible-conversion.worker';
import { startRemainingPaymentWorker } from './remaining-payment.worker';
import { startRemainingPaymentRetriesWorker } from './remaining-payment-retries.worker';
import { startEmailNotificationsWorker } from './email-notifications.worker';
import { startSheetsExportWorker } from './sheets-export.worker';
import { startOtaSyncWorker } from './ota-sync.worker';
import { startMonitoringAlertsWorker } from './monitoring-alerts.worker';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  if (!queuesEnabled) {
    logger.error('REDIS_URL no configurada -- el proceso de workers no tiene nada que hacer, saliendo.');
    process.exit(1);
  }

  const workers = [
    startCleanupWorker(),
    startFlexibleConversionWorker(),
    startRemainingPaymentWorker(),
    startRemainingPaymentRetriesWorker(),
    startEmailNotificationsWorker(),
    startSheetsExportWorker(),
    startOtaSyncWorker(),
    startMonitoringAlertsWorker()
  ];

  // Los repeatable jobs son idempotentes (upsertJobScheduler con id fijo) --
  // seguro registrarlos en cada arranque del proceso de workers.
  await registerCleanupScheduler();
  await registerFlexibleConversionScheduler();
  await registerOtaSyncScheduler();
  await registerMonitoringAlertsScheduler();

  logger.info(`Workers arriba: ${workers.length} colas activas`);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} recibido, cerrando workers...`);
    await Promise.all(workers.map(w => w.close()));
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(error => {
  logger.error('Error fatal iniciando workers', { error: error.message });
  process.exit(1);
});
