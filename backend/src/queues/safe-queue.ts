// lapa-casa-hostel/backend/src/queues/safe-queue.ts
// ventana4
//
// Wrapper delgado sobre bullmq.Queue que degrada con gracia si
// REDIS_URL no esta configurada (ver connection.ts): en vez de tirar
// una excepcion que tumbe el request HTTP que intenta encolar un email
// o un cobro de saldo, loguea un warning y sigue. El worker (proceso
// separado, src/workers/index.ts) si requiere Redis real para existir.

import { Queue, JobsOptions, RepeatOptions } from 'bullmq';
import { queuesEnabled, getQueueConnection } from './connection';
import { logger } from '../utils/logger';

export function createSafeQueue<DataType = any>(name: string, defaultJobOptions?: JobsOptions) {
  let queue: Queue<DataType> | null = null;

  function getQueue(): Queue<DataType> | null {
    if (!queuesEnabled) return null;
    if (!queue) {
      queue = new Queue<DataType>(name, {
        connection: getQueueConnection(),
        defaultJobOptions: {
          removeOnComplete: 500,
          removeOnFail: 1000,
          ...defaultJobOptions
        }
      });
    }
    return queue;
  }

  return {
    name,

    async add(jobName: string, data: DataType, opts?: JobsOptions) {
      const q = getQueue();
      if (!q) {
        logger.warn(`Cola "${name}" deshabilitada (sin REDIS_URL) -- job "${jobName}" no encolado`, { jobName });
        return null;
      }
      // BullMQ deriva el tipo del nombre/datos del job via conditional types
      // (ExtractNameType/ExtractDataType) que no se resuelven sobre el
      // DataType generico y abstracto de esta funcion -- se castea la
      // instancia de Queue en este unico punto de uso; add() sigue
      // exponiendo `data: DataType` en la firma publica de arriba.
      return (q as Queue<any, any, string>).add(jobName, data, opts);
    },

    /** Registra (o actualiza) un job repetible con id fijo -- idempotente entre reinicios del proceso. */
    async upsertScheduler(
      schedulerId: string,
      repeatOpts: Omit<RepeatOptions, 'key'>,
      jobTemplate?: { name?: string; data?: DataType; opts?: JobsOptions }
    ) {
      const q = getQueue();
      if (!q) {
        logger.warn(`Cola "${name}" deshabilitada (sin REDIS_URL) -- scheduler "${schedulerId}" no registrado`);
        return null;
      }
      return (q as Queue<any, any, string>).upsertJobScheduler(schedulerId, repeatOpts, jobTemplate);
    },

    raw(): Queue<DataType> | null {
      return getQueue();
    }
  };
}

export type SafeQueue<DataType = any> = ReturnType<typeof createSafeQueue<DataType>>;
