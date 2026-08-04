import { logger } from '../utils/logger';

const cache = new Map<string, { value: string; expiresAt?: number }>();

const isExpired = (key: string): boolean => {
  const entry = cache.get(key);
  if (!entry) return true;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    cache.delete(key);
    return true;
  }
  return false;
};

export const getRedisClient = async () => ({ isOpen: true });

export const testConnection = async (): Promise<boolean> => {
  logger.info('Redis stubbed — using in-memory cache');
  return true;
};

export const disconnect = async (): Promise<void> => {};

export class RedisCache {
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    cache.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttl * 1000
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (isExpired(key)) return null;
    const entry = cache.get(key);
    return entry ? (JSON.parse(entry.value) as T) : null;
  }

  async del(key: string): Promise<void> {
    cache.delete(key);
  }

  async delPattern(pattern: string): Promise<number> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let count = 0;
    for (const k of cache.keys()) {
      if (regex.test(k)) { cache.delete(k); count++; }
    }
    return count;
  }

  async exists(key: string): Promise<boolean> {
    return !isExpired(key) && cache.has(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    const entry = cache.get(key);
    if (entry) cache.set(key, { ...entry, expiresAt: Date.now() + ttl * 1000 });
  }

  async ttl(key: string): Promise<number> {
    const entry = cache.get(key);
    if (!entry || !entry.expiresAt) return -1;
    return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
  }

  async incr(key: string, amount: number = 1): Promise<number> {
    const entry = cache.get(key);
    const current = entry ? parseInt(JSON.parse(entry.value), 10) || 0 : 0;
    const next = current + amount;
    cache.set(key, { value: JSON.stringify(next), expiresAt: entry?.expiresAt });
    return next;
  }

  async decr(key: string, amount: number = 1): Promise<number> {
    return this.incr(key, -amount);
  }

  async hSet(key: string, field: string, value: any): Promise<void> {
    const existing = cache.get(key);
    const map = existing ? JSON.parse(existing.value) : {};
    map[field] = value;
    cache.set(key, { value: JSON.stringify(map), expiresAt: existing?.expiresAt });
  }

  async hGet<T>(key: string, field: string): Promise<T | null> {
    if (isExpired(key)) return null;
    const entry = cache.get(key);
    if (!entry) return null;
    const map = JSON.parse(entry.value);
    return map[field] ?? null;
  }

  async hGetAll<T>(key: string): Promise<Record<string, T>> {
    if (isExpired(key)) return {};
    const entry = cache.get(key);
    return entry ? JSON.parse(entry.value) : {};
  }

  async hDel(key: string, field: string): Promise<void> {
    const entry = cache.get(key);
    if (!entry) return;
    const map = JSON.parse(entry.value);
    delete map[field];
    cache.set(key, { value: JSON.stringify(map), expiresAt: entry.expiresAt });
  }

  async flushDb(): Promise<void> {
    cache.clear();
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

export const healthCheck = async () => ({
  status: 'healthy' as const,
  latency: 0,
  timestamp: new Date().toISOString()
});

export const gracefulShutdown = async (): Promise<void> => {};

export default redisCache;
