// IMPORTANTE: @/config/sentry debe ser el primer import para que Sentry
// pueda instrumentar automáticamente Express, Prisma y http antes de que
// cualquier otro módulo los cargue.
import '@/config/sentry';

import http from 'http';
import app from './app';
import { logger } from '@/utils/logger';
import { connectDatabase, disconnect } from '@/config/database';
import { environment } from '@/config/environment';
import { dynamicPricingService } from './services/dynamic-pricing-service';
import { startScheduler } from './workers/scheduler';
// El scheduling (cleanup, flexible-conversion, ota-sync, pagos) corre en este mismo
// proceso via workers/scheduler.ts (sin Redis ni colas).
// El bot de precios dinámicos usa un setTimeout nativo para no añadir
// dependencias: corre a las 02:00 UTC todos los dias.

const PORT = environment.PORT || 5000;
const NODE_ENV = environment.NODE_ENV || 'development';

const server = http.createServer(app);

async function startServer(): Promise<void> {
  try {
    logger.info('Starting Lapa Casa Backend Server...');
    logger.info(`Environment: ${NODE_ENV}`);
    logger.info(`Port: ${PORT}`);

    logger.info('Connecting to PostgreSQL database...');
    await connectDatabase();
    logger.info('PostgreSQL connected successfully');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API URL: ${environment.APP_URL}/api/${environment.API_VERSION}`);
      logger.info(`Health check: ${environment.APP_URL}/health`);

      if (NODE_ENV === 'development') {
        logger.info(`API Docs: ${environment.APP_URL}/api-docs`);
      }

      logger.info('Lapa Casa Channel Manager is ready!');

      // ── Bot de precios dinámicos: cron nativo a las 02:00 UTC ──────────────
      scheduleDynamicPricingBot();

      // ── Tareas programadas (sync iCal/OTA, pagos, emails) en este mismo proceso ──
      // Antes corrian en una maquina `worker` aparte que Fly detenia y nadie volvia a prender
      // (iCal quedo 3 dias sin sincronizar). Esta maquina nunca se detiene (auto_stop off).
      // DISABLE_SCHEDULER=true lo apaga (por si se vuelve a un worker separado).
      if (process.env.DISABLE_SCHEDULER !== 'true') {
        stopScheduler = startScheduler();
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

let stopScheduler: (() => void) | null = null;

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  stopScheduler?.();

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      logger.info('Closing database connections...');
      await disconnect();
      logger.info('Database disconnected');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown - timeout exceeded');
    process.exit(1);
  }, 30000);
}

process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);

  if (NODE_ENV === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on('listening', () => {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? `pipe ${addr}`
    : `port ${addr?.port}`;
  logger.info(`Listening on ${bind}`);
});

/** Programa el bot de precios dinámicos para correr a las 02:00 UTC cada día. */
function scheduleDynamicPricingBot(): void {
  const runBot = async () => {
    try {
      logger.info('DynamicPricingBot: ejecución nocturna iniciada');
      const result = await dynamicPricingService.run();
      logger.info('DynamicPricingBot: ejecución nocturna completada', result);
    } catch (err) {
      logger.error('DynamicPricingBot: error en ejecución nocturna', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const scheduleNext = () => {
    const now = new Date();
    // Próximas 02:00 UTC
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0, 0));
    if (next <= now) {next.setUTCDate(next.getUTCDate() + 1);}
    const msUntilNext = next.getTime() - now.getTime();
    logger.info(`DynamicPricingBot: próxima ejecución en ${Math.round(msUntilNext / 60000)} min (${next.toISOString()})`);
    setTimeout(() => {
      runBot().finally(scheduleNext);
    }, msUntilNext);
  };

  scheduleNext();
}

startServer();

export default server;
