// lapa-casa-hostel/backend/src/config/redis.ts

import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { logger } from '../utils/logger';

/**
 * Redis Configuration
 * Cache and session management for Lapa Casa Hostel
 * 
 * Features:
 * - Connection pooling
 * - Auto-reconnection
 * - Error handling
 * - TTL management
 * - Pub/Sub support
 * - Cache strategies
 */

interface RedisConfig {
  url: string;
  password?: string;
  database: number;
  maxRetries: number;
  retryDelay: number;
  connectTimeout: number;
  commandTimeout: number;
  enableOfflineQueue: boolean;
}

/**
 * Get Redis configuration from environment
 */
const getRedisConfig = (): RedisConfig => {
  return {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    database: parseInt(process.env.REDIS_DATABASE || '0', 10),
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '3000', 10),
    enableOfflineQueue: process.env.REDIS_OFFLINE_QUEUE !== 'false'
  };
};

const config = getRedisConfig();

/**
 * Redis client singleton
 */
let redisClient: RedisClientType | null = null;

/**
 * Create Redis client with configuration
 */
const createRedisClient = (): RedisClientType => {
  const options: RedisClientOptions = {
    url: config.url,
    password: config.password,
    database: config.database,
    socket: {
      connectTimeout: config.connectTimeout,
      reconnectStrategy: (retries: number) => {
        if (retries >= config.maxRetries) {
          logger.error('Redis max retries reached', { retries });
          return new Error('Max retries reached');
        }
        const delay = Math.min(retries * config.retryDelay, 3000);
        logger.warn('Redis reconnecting', { retries, delay });
        return delay;
      }
    }
  };

  const client = createClient(options) as RedisClientType;

  // Event handlers
  client.on('connect', () => {
    logger.info('Redis client connecting');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('error', (error) => {
    logger.error('Redis client error', { error: error.message });
  });

  client.on('reconnecting', () => {
    logger.warn('Redis client reconnecting');
  });

  client.on('end', () => {
    logger.info('Redis client connection ended');
  });

  return client;
};

/**
 * Get Redis client instance
 * Creates connection if not exists
 */
export const getRedisClient = async (): Promise<RedisClientType> => {
  if (!redisClient) {
    redisClient = createRedisClient();
    await redisClient.connect();
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
};

/**
 * Test Redis connection
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await getRedisClient();
    await client.ping();
    logger.info('Redis connection successful');
    return true;
  } catch (error) {
    logger.error('Redis connection failed', { error });
    return false;
  }
};

/**
 * Disconnect Redis client
 */
export const disconnect = async (): Promise<void> => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis disconnected successfully');
    }
  } catch (error) {
    logger.error('Error disconnecting Redis', { error });
    throw error;
  }
};

/**
 * Cache operations with TTL
 */
export class RedisCache {
  private client: RedisClientType | null = null;

  private async getClient(): Promise<RedisClientType> {
    if (!this.client) {
      this.client = await getRedisClient();
    }
    return this.client;
  }

  /**
   * Set cache value with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      const client = await this.getClient();
      const serialized = JSON.stringify(value);
      await client.setEx(key, ttl, serialized);
    } catch (error) {
      logger.error('Redis set error', { key, error });
      throw error;
    }
  }

  /**
   * Get cache value
   * @param key - Cache key
   * @returns Parsed value or null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      const value = await client.get(key);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis get error', { key, error });
      return null;
    }
  }

  /**
   * Delete cache key
   * @param key - Cache key
   */
  async del(key: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(key);
    } catch (error) {
      logger.error('Redis del error', { key, error });
      throw error;
    }
  }

  /**
   * Delete keys by pattern
   * @param pattern - Key pattern (e.g., "availability:*")
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const client = await this.getClient();
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      await client.del(keys);
      return keys.length;
    } catch (error) {
      logger.error('Redis delPattern error', { pattern, error });
      throw error;
    }
  }

  /**
   * Check if key exists
   * @param key - Cache key
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', { key, error });
      return false;
    }
  }

  /**
   * Set expiration on existing key
   * @param key - Cache key
   * @param ttl - Time to live in seconds
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      const client = await this.getClient();
      await client.expire(key, ttl);
    } catch (error) {
      logger.error('Redis expire error', { key, ttl, error });
      throw error;
    }
  }

  /**
   * Get remaining TTL
   * @param key - Cache key
   * @returns TTL in seconds or -1 if no expiry
   */
  async ttl(key: string): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.ttl(key);
    } catch (error) {
      logger.error('Redis ttl error', { key, error });
      return -1;
    }
  }

  /**
   * Increment numeric value
   * @param key - Cache key
   * @param amount - Amount to increment
   */
  async incr(key: string, amount: number = 1): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.incrBy(key, amount);
    } catch (error) {
      logger.error('Redis incr error', { key, amount, error });
      throw error;
    }
  }

  /**
   * Decrement numeric value
   * @param key - Cache key
   * @param amount - Amount to decrement
   */
  async decr(key: string, amount: number = 1): Promise<number> {
    try {
      const client = await this.getClient();
      return await client.decrBy(key, amount);
    } catch (error) {
      logger.error('Redis decr error', { key, amount, error });
      throw error;
    }
  }

  /**
   * Store hash field
   * @param key - Hash key
   * @param field - Field name
   * @param value - Field value
   */
  async hSet(key: string, field: string, value: any): Promise<void> {
    try {
      const client = await this.getClient();
      const serialized = JSON.stringify(value);
      await client.hSet(key, field, serialized);
    } catch (error) {
      logger.error('Redis hSet error', { key, field, error });
      throw error;
    }
  }

  /**
   * Get hash field
   * @param key - Hash key
   * @param field - Field name
   */
  async hGet<T>(key: string, field: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      const value = await client.hGet(key, field);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis hGet error', { key, field, error });
      return null;
    }
  }

  /**
   * Get all hash fields
   * @param key - Hash key
   */
  async hGetAll<T>(key: string): Promise<Record<string, T>> {
    try {
      const client = await this.getClient();
      const values = await client.hGetAll(key);
      
      const parsed: Record<string, T> = {};
      for (const [field, value] of Object.entries(values)) {
        parsed[field] = JSON.parse(value) as T;
      }

      return parsed;
    } catch (error) {
      logger.error('Redis hGetAll error', { key, error });
      return {};
    }
  }

  /**
   * Delete hash field
   * @param key - Hash key
   * @param field - Field name
   */
  async hDel(key: string, field: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.hDel(key, field);
    } catch (error) {
      logger.error('Redis hDel error', { key, field, error });
      throw error;
    }
  }

  /**
   * Flush all cache data
   * WARNING: Deletes all keys in current database
   */
  async flushDb(): Promise<void> {
    try {
      const client = await this.getClient();
      await client.flushDb();
      logger.warn('Redis database flushed');
    } catch (error) {
      logger.error('Redis flushDb error', { error });
      throw error;
    }
  }
}

/**
 * Export singleton cache instance
 */
export const cache = new RedisCache();

/**
 * Cache key builders for consistency
 */
export const CacheKeys = {
  availability: (checkIn: string, checkOut: string) => 
    `availability:${checkIn}:${checkOut}`,
  
  roomAvailability: (roomId: string, checkIn: string, checkOut: string) =>
    `room:${roomId}:${checkIn}:${checkOut}`,
  
  booking: (bookingId: string) => 
    `booking:${bookingId}`,
  
  pricing: (roomId: string, checkIn: string, nights: number) =>
    `pricing:${roomId}:${checkIn}:${nights}`,
  
  session: (sessionId: string) =>
    `session:${sessionId}`,
  
  rateLimit: (ip: string, endpoint: string) =>
    `ratelimit:${ip}:${endpoint}`,
  
  lockAvailability: (roomId: string, date: string) =>
    `lock:availability:${roomId}:${date}`
};

/**
 * Health check for Redis
 */
export const healthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency: number;
  timestamp: string;
}> => {
  const start = Date.now();
  
  try {
    const client = await getRedisClient();
    await client.ping();
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
 * Graceful shutdown handler
 */
export const gracefulShutdown = async (): Promise<void> => {
  logger.info('Initiating graceful Redis shutdown');
  
  try {
    await disconnect();
    logger.info('Redis shutdown complete');
  } catch (error) {
    logger.error('Error during Redis shutdown', { error });
    process.exit(1);
  }
};

// Handle process termination signals
if (process.env.NODE_ENV === 'production') {
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

export default cache;
