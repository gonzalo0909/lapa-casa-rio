// lapa-casa-hostel/backend/src/workers/ota-sync.worker.ts
// ventana5
//
// Consumidor real de la cola `ota-sync` (ver queues/ota-sync.queue.ts).
// Reemplaza el stub de Ventana 4 (que descartaba todos los jobs con un
// warning) -- ahora ejecuta la sincronizacion real de feeds iCal
// (Airbnb/Hostelworld, y respaldo de disponibilidad para Booking/Expedia)
// y despues corre la resolucion automatica de conflictos por prioridad
// de canal, para que cualquier conflicto que channel-service.ts haya
// dejado abierto durante el import no espere a que un admin lo revise
// manualmente si la prioridad ya lo resuelve.

import { Worker, Job } from 'bullmq';
import { getQueueConnection } from '../queues/connection';
import { syncICalFeeds } from '../services/ical-service';
import { conflictService } from '../services/conflict-service';
import { logger } from '../utils/logger';
import type { OtaSyncJobData } from '../queues/ota-sync.queue';

export function startOtaSyncWorker(): Worker<OtaSyncJobData> {
  const worker = new Worker<OtaSyncJobData>(
    'ota-sync',
    async (_job: Job<OtaSyncJobData>) => {
      const result = await syncICalFeeds();
      logger.info('ota-sync: sincronización completada', {
        totalFeeds: result.totalFeeds,
        successfulFeeds: result.successfulFeeds,
        failedFeeds: result.failedFeeds,
        totalImported: result.totalImported,
        totalCancelled: result.totalCancelled,
      });

      const conflicts = await conflictService.detectConflicts();
      if (conflicts.newlyDetected > 0 || conflicts.autoResolved > 0) {
        logger.info('ota-sync: conflictos procesados', conflicts);
      }

      return { sync: result, conflicts };
    },
    { connection: getQueueConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error('ota-sync worker job falló', { jobId: job?.id, error: err.message });
  });

  return worker;
}
