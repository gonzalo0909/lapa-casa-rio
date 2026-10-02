//
// Punto de entrada del proceso de workers -- separado del servidor HTTP
// (src/server.ts). Se corre con `npm run worker` (prod) / `npm run worker:dev` (dev).
// Corre el planificador de tareas programadas (workers/scheduler.ts); no usa Redis ni colas.

import { startScheduler } from './scheduler';
import { logger } from '../utils/logger';

// Una promesa rechazada sin capturar no debe matar el proceso: se loguea y se sigue.
// Una excepcion no capturada deja el proceso en estado incierto: se loguea y se sale
// para que Fly lo reinicie (fly.toml: restart policy 'always').
process.on('unhandledRejection', (reason) => {
  logger.error('Worker: promesa rechazada sin capturar', { reason: reason instanceof Error ? reason.message : String(reason) });
});
process.on('uncaughtException', (error) => {
  logger.error('Worker: excepcion no capturada, reiniciando', { error: error.message });
  process.exit(1);
});

const stop = startScheduler();

const shutdown = (signal: string) => {
  logger.info(`${signal} recibido, cerrando el planificador...`);
  stop();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
