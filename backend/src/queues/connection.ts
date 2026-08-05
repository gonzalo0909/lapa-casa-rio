// lapa-casa-hostel/backend/src/queues/connection.ts
// ventana4
//
// Conexion Redis dedicada para BullMQ. BullMQ exige su propia conexion
// ioredis con opciones distintas a un cliente de cache generico
// (maxRetriesPerRequest: null es obligatorio -- si no, BullMQ tira
// "MaxRetriesPerRequestError" en cualquier bloqueo de BRPOPLPUSH). No
// reutiliza src/cache/redis-client.ts por eso mismo.
//
// Si REDIS_URL no esta configurada, las colas quedan deshabilitadas: el
// servidor HTTP sigue arriba (una reserva se sigue pudiendo crear), pero
// nada se encola -- se loguea un warning una sola vez. Esto es una
// degradacion deliberada, igual que el fallback de cache en memoria,
// pero acotada: sin Redis real no hay reintentos de pago ni emails
// asincronos, asi que en produccion REDIS_URL es obligatoria (ver
// render.yaml).

import IORedis from 'ioredis';
import { env } from '../config/environment';
import { logger } from '../utils/logger';

export const queuesEnabled = Boolean(env.REDIS_URL);

let connection: IORedis | null = null;
let warnedOnce = false;

export function getQueueConnection(): IORedis {
  if (!env.REDIS_URL) {
    if (!warnedOnce) {
      logger.warn('REDIS_URL no configurada -- colas BullMQ deshabilitadas, ver src/queues/connection.ts');
      warnedOnce = true;
    }
    throw new Error('REDIS_URL not configured -- queues disabled');
  }
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true
    });
    connection.on('error', (err) => {
      logger.warn('BullMQ Redis connection error', { message: err.message });
    });
  }
  return connection;
}

export async function closeQueueConnection(): Promise<void> {
  if (connection) {
    await connection.quit().catch(() => connection?.disconnect());
    connection = null;
  }
}
