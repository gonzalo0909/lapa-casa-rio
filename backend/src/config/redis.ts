import redisClient from '../cache/redis-client';
import { logger } from '../utils/logger';

export const getRedisClient = async () => ({ isOpen: redisClient.isClientConnected() });

export const testConnection = async (): Promise<boolean> => redisClient.ping();

export const disconnect = async (): Promise<void> => {
  await redisClient.disconnect();
};

export class RedisCache {
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await redisClient.set(key, value, ttl);
  }

  async get<T>(key: string): Promise<T | null> {
    return redisClient.get<T>(key);
  }

  async del(key: string): Promise<void> {
    await redisClient.del(key);
  }

  async delPattern(pattern: string): Promise<number> {
    return redisClient.delPattern(pattern);
  }

  async exists(key: string): Promise<boolean> {
    return redisClient.exists(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await redisClient.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return redisClient.ttl(key);
  }

  async incr(key: string, amount: number = 1): Promise<number> {
    return redisClient.increment(key, amount);
  }

  async decr(key: string, amount: number = 1): Promise<number> {
    return redisClient.decrement(key, amount);
  }

  async hSet(key: string, field: string, value: any): Promise<void> {
    await redisClient.hset(key, field, value);
  }

  async hGet<T>(key: string, field: string): Promise<T | null> {
    return redisClient.hget<T>(key, field);
  }

  async hGetAll<T>(key: string): Promise<Record<string, T>> {
    return (await redisClient.hgetall<T>(key)) ?? {};
  }

  async hDel(key: string, field: string): Promise<void> {
    await redisClient.hdel(key, field);
  }

  async flushDb(): Promise<void> {
    await redisClient.flushdb();
    logger.warn('redisCache.flushDb() invocado');
  }
}

export const redisCache = new RedisCache();

export const CacheKeys = {
  availability: (checkIn: string, checkOut: string) => `availability:${checkIn}:${checkOut}`,
  roomAvailability: (roomId: string, checkIn: string, checkOut: string) => `room:${roomId}:${checkIn}:${checkOut}`,
  booking: (bookingId: string) => `booking:${bookingId}`,
  pricing: (roomId: string, checkIn: string, nights: number) => `pricing:${roomId}:${checkIn}:${nights}`,
  session: (sessionId: string) => `session:${sessionId}`,
  rateLimit: (ip: string, endpoint: string) => `ratelimit:${ip}:${endpoint}`,
  lockAvailability: (roomId: string, date: string) => `lock:availability:${roomId}:${date}`
};

export const healthCheck = async () => {
  const start = Date.now();
  const ok = await redisClient.ping();
  return {
    status: (ok ? 'healthy' : 'down') as 'healthy' | 'down',
    latency: Date.now() - start,
    timestamp: new Date().toISOString()
  };
};

export const gracefulShutdown = async (): Promise<void> => {
  await redisClient.disconnect();
};

export default redisCache;
