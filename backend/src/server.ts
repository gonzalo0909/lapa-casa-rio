// lapa-casa-hostel/backend/src/server.ts

import http from 'http';
import app from './app';
import { logger } from '@/utils/logger';
import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';
import { environment } from '@/config/environment';

/**
 * Server entry point for Lapa Casa Hostel Channel Manager
 * Handles graceful startup, shutdown, and error management
 */

const PORT = environment.port || 5000;
const NODE_ENV = environment.nodeEnv || 'development';

/**
 * Create HTTP server instance
 */
const server = http.createServer(app);

/**
 * Initialize all required connections and start server
 */
async function startServer(): Promise<void> {
  try {
    logger.info('🚀 Starting Lapa Casa Hostel Backend Server...');
    logger.info(`📍 Environment: ${NODE_ENV}`);
    logger.info(`🔧 Port: ${PORT}`);

    // Connect to PostgreSQL database
    logger.info('🔌 Connecting to PostgreSQL database...');
    await connectDatabase();
    logger.info('✅ PostgreSQL connected successfully');

    // Connect to Redis cache
    logger.info('🔌 Connecting to Redis cache...');
    await connectRedis();
    logger.info('✅ Redis connected successfully');

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`🌐 API URL: ${environment.appUrl}/api/${environment.apiVersion}`);
      logger.info(`📚 Health check: ${environment.appUrl}/health`);
      
      if (NODE_ENV === 'development') {
        logger.info(`📖 API Docs: ${environment.appUrl}/api-docs`);
      }

      logger.info('🏨 Lapa Casa Hostel Channel Manager is ready!');
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 * Closes all connections properly before exiting
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('🔒 HTTP server closed');

    try {
      // Close database connections
      logger.info('🔌 Closing database connections...');
      const { prisma } = await import('@/config/database');
      await prisma.$disconnect();
      logger.info('✅ Database disconnected');

      // Close Redis connection
      logger.info('🔌 Closing Redis connection...');
      const { redis } = await import('@/config/redis');
      await redis.quit();
      logger.info('✅ Redis disconnected');

      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('⚠️  Forced shutdown - timeout exceeded');
    process.exit(1);
  }, 30000); // 30 seconds timeout
}

/**
 * Unhandled rejection handler
 */
process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
  logger.error('🚨 Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
  
  // Don't exit in development to allow debugging
  if (NODE_ENV === 'production') {
    gracefulShutdown('UNHANDLED_REJECTION');
  }
});

/**
 * Uncaught exception handler
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('🚨 Uncaught Exception:', error);
  
  // Always exit on uncaught exceptions
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

/**
 * SIGTERM signal handler (Docker/Kubernetes)
 */
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

/**
 * SIGINT signal handler (Ctrl+C)
 */
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

/**
 * Handle server errors
 */
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

  switch (error.code) {
    case 'EACCES':
      logger.error(`❌ ${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`❌ ${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

/**
 * Server listening event
 */
server.on('listening', () => {
  const addr = server.address();
  const bind = typeof addr === 'string' 
    ? `pipe ${addr}` 
    : `port ${addr?.port}`;
  logger.info(`🎧 Listening on ${bind}`);
});

/**
 * Start the server
 */
startServer();

export default server;
