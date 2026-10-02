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
    try {
      // Solo el host (nunca usuario/clave): permite identificar el proveedor de Redis en los logs.
      logger.info('BullMQ Redis: conectando', { host: new URL(env.REDIS_URL).hostname });
    } catch {
      /* REDIS_URL con formato no estandar: no se loguea nada */
    }
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

/**
 * Opciones comunes de todos los Worker. Un worker inactivo consulta Redis en bucle
 * (drainDelay, en segundos) y revisa jobs trabados (stalledInterval, en ms); con 8
 * workers eso son miles de comandos por dia, que en planes de Redis facturados por
 * comando (Upstash) pesa. Los jobs nuevos despiertan al worker al instante igual
 * (marker), asi que subir estos valores no demora ningun envio.
 *
 * Limite de BullMQ sobre Redis: si la cola tiene jobs con delay pendientes (los
 * repetibles, como la sync cada 5 min, siempre tienen uno), el worker nunca espera
 * mas de 10 s por corrida, sin importar drainDelay.
 */
export function getWorkerOptions() {
  return { connection: getQueueConnection(), drainDelay: 3600, stalledInterval: 3_600_000 };
}
