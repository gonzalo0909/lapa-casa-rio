//
// Punto de entrada del proceso de workers -- separado del servidor HTTP
// (src/server.ts). Se corre con `npm run worker` (prod) / `npm run
// worker:dev` (dev, tsx watch). Requiere REDIS_URL real: sin ella, los
// workers no tienen nada que consumir (ver queues/connection.ts).

import { Queue } from 'bullmq';
import { queuesEnabled, getQueueConnection } from '../queues/connection';
import { registerCleanupScheduler } from '../queues/cleanup.queue';
import { registerFlexibleConversionScheduler } from '../queues/flexible-conversion.queue';
import { registerOtaSyncScheduler } from '../queues/ota-sync.queue';
import { registerOwnerPayoutScheduler } from '../queues/owner-payout.queue';
import { startCleanupWorker } from './cleanup.worker';
import { startOwnerPayoutWorker } from './owner-payout.worker';
import { startFlexibleConversionWorker } from './flexible-conversion.worker';
import { startEmailNotificationsWorker } from './email-notifications.worker';
import { startSheetsExportWorker } from './sheets-export.worker';
import { startOtaSyncWorker } from './ota-sync.worker';
import { logger } from '../utils/logger';

// Colas que ya no existen (cobro automatico del saldo, reintentos del saldo y alertas
// al administrador). Se borran de Redis con sus jobs programados, para que no queden
// ocupando espacio ni disparando nada. Idempotente: si ya no existen, no hace nada.
const RETIRED_QUEUES = ['monitoring-alerts', 'remaining-payment', 'remaining-payment-retries'];

async function retireLegacyQueues(): Promise<void> {
  for (const name of RETIRED_QUEUES) {
    const queue = new Queue(name, { connection: getQueueConnection() });
    try {
      await queue.obliterate({ force: true });
      logger.info('Cola retirada eliminada de Redis', { queue: name });
    } catch (error: any) {
      logger.warn('No se pudo eliminar la cola retirada', { queue: name, message: error.message });
    } finally {
      await queue.close().catch(() => {});
    }
  }
}

async function main(): Promise<void> {
  if (!queuesEnabled) {
    logger.error('REDIS_URL no configurada -- el proceso de workers no tiene nada que hacer, saliendo.');
    process.exit(1);
  }

  const workers = [
    startCleanupWorker(),
    startOwnerPayoutWorker(),
    startFlexibleConversionWorker(),
    startEmailNotificationsWorker(),
    startSheetsExportWorker(),
    startOtaSyncWorker()
  ];

  // BullMQ emite 'error' ante cualquier fallo de conexion a Redis; sin un listener,
  // Node lo trata como excepcion no capturada y TUMBA el proceso entero (esa era
  // una causa de que el worker se detuviera solo). Se loguea y se sigue: ioredis
  // reconecta por su cuenta.
  for (const worker of workers) {
    worker.on('error', (err) => logger.warn('Worker BullMQ: error de Redis', { queue: worker.name, message: err.message }));
  }

  await retireLegacyQueues();

  // Los repeatable jobs son idempotentes (upsertJobScheduler con id fijo) --
  // seguro registrarlos en cada arranque del proceso de workers.
  await registerCleanupScheduler();
  await registerOwnerPayoutScheduler();
  await registerFlexibleConversionScheduler();
  await registerOtaSyncScheduler();

  logger.info(`Workers arriba: ${workers.length} colas activas`);

  const shutdown = async (signal: string) => {
    logger.info(`${signal} recibido, cerrando workers...`);
    await Promise.all(workers.map(w => w.close()));
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Una promesa rechazada sin capturar no debe matar a todos los workers: se loguea
// y se sigue. Una excepcion no capturada deja el proceso en estado incierto: se
// loguea y se sale para que Fly lo reinicie (fly.toml: restart policy 'always').
process.on('unhandledRejection', (reason) => {
  logger.error('Worker: promesa rechazada sin capturar', { reason: reason instanceof Error ? reason.message : String(reason) });
});
process.on('uncaughtException', (error) => {
  logger.error('Worker: excepcion no capturada, reiniciando', { error: error.message });
  process.exit(1);
});

main().catch(error => {
  logger.error('Error fatal iniciando workers', { error: error.message });
  process.exit(1);
});
