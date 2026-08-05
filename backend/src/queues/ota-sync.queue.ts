// lapa-casa-hostel/backend/src/queues/ota-sync.queue.ts
// ventana4 (estructura base -- activacion real en Ventana 5)
//
// Estructura de la cola de sincronizacion con OTAs. La sincronizacion
// real (iCal, webhooks) ya corre hoy via src/crons/sync-ota-calendars.ts
// (node-cron, Ventana 5). Esta cola queda declarada para cuando esa
// logica se migre a un worker de BullMQ en Ventana 5 -- no se conecta
// nada mas en Ventana 4 para no duplicar la sincronizacion que ya
// funciona.

import { createSafeQueue } from './safe-queue';

export interface OtaSyncJobData {
  channelCode: string;
}

export const otaSyncQueue = createSafeQueue<OtaSyncJobData>('ota-sync', {
  attempts: 3
});
