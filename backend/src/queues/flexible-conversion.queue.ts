// lapa-casa-hostel/backend/src/queues/flexible-conversion.queue.ts
// ventana4
//
// Repeatable job cada hora: invoca sp_process_flexible_conversion()
// (0007_procedures.sql, REQUISITO CRITICO #2). Reemplaza el scheduling
// que hasta ahora vivia en src/crons/index.ts via node-cron -- ver nota
// de consolidacion en cleanup.queue.ts.

import { createSafeQueue } from './safe-queue';

export const flexibleConversionQueue = createSafeQueue('flexible-conversion');

const SCHEDULER_ID = 'flexible-conversion-hourly';

export async function registerFlexibleConversionScheduler(): Promise<void> {
  await flexibleConversionQueue.upsertScheduler(SCHEDULER_ID, { pattern: '0 * * * *' }, { name: 'run-flexible-conversion' });
}
