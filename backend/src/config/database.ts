// lapa-casa-hostel/backend/src/config/database.ts

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Database Configuration
 * PostgreSQL connection management with Prisma ORM
 * 
 * Features:
 * - Connection pooling
 * - Query logging in development
 * - Error handling and retry logic
 * - Graceful shutdown
 * - Performance monitoring
 */

interface DatabaseConfig {
  url: string;
  maxConnections: number;
  connectionTimeout: number;
  poolTimeout: number;
  logQueries: boolean;
}

/**
 * Get database configuration from environment
 */
const getDatabaseConfig = (): DatabaseConfig => {
  const config: DatabaseConfig = {
    url: process.env.DATABASE_URL || '',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
    poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT || '10000', 10),
    logQueries: process.env.NODE_ENV === 'development'
  };

  if (!config.url) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return config;
};

const config = getDatabaseConfig();

/**
 * Prisma Client singleton instance
 * Prevents multiple instances in development with hot reload
 */
declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Create Prisma client with optimized configuration
 */
const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    datasources: {
      db: {
        url: config.url
      }
    },
    log: config.logQueries
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' }
        ]
      : ['error'],
    errorFormat: 'pretty'
  });
};

/**
 * Prisma client instance with connection pooling
 */
export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Set up query logging in development
 */
if (config.logQueries) {
  prisma.$on('query' as never, (e: any) => {
    logger.debug('Query executed', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
      timestamp: new Date().toISOString()
    });
  });

  prisma.$on('error' as never, (e: any) => {
    logger.error('Database error', {
      message: e.message,
      target: e.target,
      timestamp: new Date().toISOString()
    });
  });

  prisma.$on('warn' as never, (e: any) => {
    logger.warn('Database warning', {
      message: e.message,
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Test database connection
 * @returns Promise<boolean> - Connection status
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error });
    return false;
  }
};

/**
 * Disconnect from database
 * Used for graceful shutdown
 */
export const disconnect = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database', { error });
    throw error;
  }
};

/**
 * Execute query with retry logic
 * @param operation - Database operation to execute
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise<T> - Operation result
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        logger.error('Max retries reached', {
          attempts: attempt,
          error: lastError.message
        });
        break;
      }

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      logger.warn(`Retry attempt ${attempt}/${maxRetries}`, {
        delay: `${delay}ms`,
        error: lastError.message
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Transaction wrapper with automatic rollback
 * @param operations - Array of database operations
 * @returns Promise<T> - Transaction result
 */
export const transaction = async <T>(
  operations: (tx: PrismaClient) => Promise<T>
): Promise<T> => {
  try {
    return await prisma.$transaction(async (tx) => {
      return await operations(tx as PrismaClient);
    });
  } catch (error) {
    logger.error('Transaction failed', { error });
    throw error;
  }
};

/**
 * Health check for database
 * @returns Promise<object> - Health status
 */
export const healthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  timestamp: string;
}> => {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return {
      status: 'healthy',
      latency,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get connection pool statistics
 * @returns Promise<object> - Pool statistics
 */
export const getPoolStats = async (): Promise<{
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
}> => {
  // Note: Prisma doesn't expose pool stats directly
  // This is a placeholder for monitoring integration
  return {
    activeConnections: 0,
    idleConnections: 0,
    maxConnections: config.maxConnections
  };
};

/**
 * Clean up expired data
 * Run periodically to maintain database health
 */
export const cleanupExpiredData = async (): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete cancelled bookings older than 30 days
    const deletedBookings = await prisma.booking.deleteMany({
      where: {
        status: 'CANCELLED',
        updatedAt: {
          lt: thirtyDaysAgo
        }
      }
    });

    // Delete failed payment attempts older than 30 days
    const deletedPayments = await prisma.payment.deleteMany({
      where: {
        status: 'FAILED',
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    });

    logger.info('Cleanup completed', {
      deletedBookings: deletedBookings.count,
      deletedPayments: deletedPayments.count
    });
  } catch (error) {
    logger.error('Cleanup failed', { error });
    throw error;
  }
};

/**
 * Graceful shutdown handler
 * Ensures all connections are closed properly
 */
export const gracefulShutdown = async (): Promise<void> => {
  logger.info('Initiating graceful database shutdown');
  
  try {
    await disconnect();
    logger.info('Database shutdown complete');
  } catch (error) {
    logger.error('Error during database shutdown', { error });
    process.exit(1);
  }
};

// Handle process termination signals
if (process.env.NODE_ENV === 'production') {
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

export default prisma;
