// lapa-casa-hostel/backend/src/queues/sheets-export.queue.ts
// ventana4 (bloque 2 pendiente)
//
// Estructura de la cola nada mas -- el worker real que exporta a Google
// Sheets se implementa en el Bloque 2 de esta ventana, cuando la
// integracion real (service account, GOOGLE_SHEETS_ID) este configurada.
// Encolar aca ya es seguro: con safe-queue, sin worker consumidor los
// jobs simplemente esperan en la cola sin efecto hasta que el Bloque 2
// levante sheets-export.worker.ts.

import { createSafeQueue } from './safe-queue';

export interface SheetsExportJobData {
  reservationId: string;
  action: 'upsert' | 'delete';
}

export const sheetsExportQueue = createSafeQueue<SheetsExportJobData>('sheets-export', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 }
});
