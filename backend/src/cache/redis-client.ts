import Redis from 'ioredis';
import { env } from '../config/environment';
import { logger } from '../utils/logger';

export interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
  delPattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  expire(key: string, seconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  increment(key: string, amount?: number): Promise<number>;
  decrement(key: string, amount?: number): Promise<number>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hset(key: string, field: string, value: any): Promise<boolean>;
  hgetall<T>(key: string): Promise<Record<string, T> | null>;
  hdel(key: string, field: string): Promise<boolean>;
  sadd(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;
  srem(key: string, ...members: string[]): Promise<number>;
  lpush(key: string, ...values: string[]): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<boolean>;
  flushdb(): Promise<boolean>;
  ping(): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  isClientConnected(): boolean;
  disconnect(): Promise<void>;
  invalidateAvailability(roomId: string): Promise<void>;
  cacheWithFallback<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T>;
  invalidateCache(pattern: string): Promise<number>;
}

/**
 * Fallback en memoria -- se usa si REDIS_URL no esta configurada o si
 * la conexion a Redis nunca llega a establecerse. No comparte estado
 * entre instancias del proceso, solo sirve para desarrollo/tests o
 * como red de seguridad si Redis cae.
 */
class InMemoryCacheClient implements CacheClient {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  private alive(key: string): boolean {
    const e = this.store.get(key);
    if (!e) return false;
    if (e.expiresAt && Date.now() > e.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.alive(key)) return null;
    const e = this.store.get(key);
    return e ? (JSON.parse(e.value) as T) : null;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    });
    return true;
  }

  async del(key: string): Promise<boolean> {
    this.store.delete(key);
    return true;
  }

  async delPattern(pattern: string): Promise<number> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let n = 0;
    for (const k of this.store.keys()) {
      if (regex.test(k)) {
        this.store.delete(k);
        n++;
      }
    }
    return n;
  }

  async exists(key: string): Promise<boolean> {
    return this.alive(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const e = this.store.get(key);
    if (e) this.store.set(key, { ...e, expiresAt: Date.now() + seconds * 1000 });
    return true;
  }

  async ttl(key: string): Promise<number> {
    const e = this.store.get(key);
    if (!e?.expiresAt) return -1;
    return Math.max(0, Math.floor((e.expiresAt - Date.now()) / 1000));
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const e = this.store.get(key);
    const n = (e ? parseInt(JSON.parse(e.value), 10) : 0) + amount;
    this.store.set(key, { value: JSON.stringify(n), expiresAt: e?.expiresAt });
    return n;
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.increment(key, -amount);
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!this.alive(key)) return null;
    const e = this.store.get(key);
    return e ? (JSON.parse(e.value)[field] ?? null) : null;
  }

  async hset(key: string, field: string, value: any): Promise<boolean> {
    const e = this.store.get(key);
    const map = e ? JSON.parse(e.value) : {};
    map[field] = JSON.stringify(value);
    this.store.set(key, { value: JSON.stringify(map), expiresAt: e?.expiresAt });
    return true;
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    if (!this.alive(key)) return null;
    const e = this.store.get(key);
    if (!e) return null;
    const raw = JSON.parse(e.value);
    const result: Record<string, T> = {};
    for (const [k, v] of Object.entries(raw)) result[k] = JSON.parse(v as string) as T;
    return result;
  }

  async hdel(key: string, field: string): Promise<boolean> {
    const e = this.store.get(key);
    if (!e) return true;
    const map = JSON.parse(e.value);
    delete map[field];
    this.store.set(key, { value: JSON.stringify(map), expiresAt: e.expiresAt });
    return true;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const e = this.store.get(key);
    const set: Set<string> = e ? new Set(JSON.parse(e.value)) : new Set();
    members.forEach((m) => set.add(m));
    this.store.set(key, { value: JSON.stringify([...set]), expiresAt: e?.expiresAt });
    return members.length;
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.alive(key)) return [];
    const e = this.store.get(key);
    return e ? JSON.parse(e.value) : [];
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.smembers(key)).includes(member);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const e = this.store.get(key);
    if (!e) return 0;
    const set: Set<string> = new Set(JSON.parse(e.value));
    members.forEach((m) => set.delete(m));
    this.store.set(key, { value: JSON.stringify([...set]), expiresAt: e.expiresAt });
    return members.length;
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    const e = this.store.get(key);
    const arr: string[] = e ? JSON.parse(e.value) : [];
    arr.unshift(...values);
    this.store.set(key, { value: JSON.stringify(arr), expiresAt: e?.expiresAt });
    return arr.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    const e = this.store.get(key);
    const arr: string[] = e ? JSON.parse(e.value) : [];
    arr.push(...values);
    this.store.set(key, { value: JSON.stringify(arr), expiresAt: e?.expiresAt });
    return arr.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.alive(key)) return [];
    const e = this.store.get(key);
    const arr: string[] = e ? JSON.parse(e.value) : [];
    return arr.slice(start, stop === -1 ? undefined : stop + 1);
  }

  async ltrim(key: string, start: number, stop: number): Promise<boolean> {
    const e = this.store.get(key);
    if (!e) return true;
    const arr: string[] = JSON.parse(e.value);
    this.store.set(key, { value: JSON.stringify(arr.slice(start, stop + 1)), expiresAt: e.expiresAt });
    return true;
  }

  async flushdb(): Promise<boolean> {
    this.store.clear();
    return true;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...this.store.keys()].filter((k) => regex.test(k));
  }

  isClientConnected(): boolean {
    return true;
  }

  async disconnect(): Promise<void> {}

  async invalidateAvailability(roomId: string): Promise<void> {
    await this.delPattern(`room:${roomId}:availability:*`);
  }

  async cacheWithFallback<T>(key: string, fetchFn: () => Promise<T>, ttl: number = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetchFn();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  async invalidateCache(pattern: string): Promise<number> {
    return this.delPattern(pattern);
  }
}

/**
 * Cliente Redis real (ioredis). Cada metodo publico atrapa sus propios
 * errores -- si Redis se cae a mitad de operacion, esto nunca tira una
 * excepcion hacia arriba: loguea y devuelve un resultado de "miss"
 * (null/false/0/[]), exactamente lo que un caller que ya trata la cache
 * como best-effort espera. El sistema sigue funcionando consultando
 * Postgres directo -- la cache nunca es la fuente de verdad.
 */
class RedisBackedCacheClient implements CacheClient {
  private client: Redis;
  private connected = false;

  constructor(url: string) {
    this.client = new Redis(url, {
      lazyConnect: false,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 500, 5000),
      reconnectOnError: () => true
    });

    this.client.on('ready', () => {
      this.connected = true;
      logger.info('Redis connected');
    });
    this.client.on('error', (err) => {
      this.connected = false;
      logger.warn('Redis error', { message: err.message });
    });
    this.client.on('close', () => {
      this.connected = false;
    });
  }

  /**
   * Cota dura de latencia por operacion (independiente de los retries
   * internos de ioredis, que en la practica pueden tardar mucho mas de
   * lo aceptable en devolver el control cuando Redis esta caido). Si
   * Redis no responde a tiempo, se trata como cache-miss y se sigue.
   */
  private static readonly OP_TIMEOUT_MS = 1200;

  private safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    const op = fn().catch((err) => {
      throw err;
    });
    op.catch(() => undefined); // evita unhandled rejection si gana el timeout
    try {
      return await Promise.race([
        op,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('redis op timeout')), RedisBackedCacheClient.OP_TIMEOUT_MS)
        )
      ]);
    } catch (err: any) {
      logger.warn('Redis operation failed, falling back', { message: err?.message });
      return fallback;
    }
  };

  async get<T>(key: string): Promise<T | null> {
    return this.safe(async () => {
      const v = await this.client.get(key);
      return v === null ? null : (JSON.parse(v) as T);
    }, null);
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    return this.safe(async () => {
      const payload = JSON.stringify(value);
      if (ttlSeconds) await this.client.set(key, payload, 'EX', ttlSeconds);
      else await this.client.set(key, payload);
      return true;
    }, false);
  }

  async del(key: string): Promise<boolean> {
    return this.safe(async () => {
      await this.client.del(key);
      return true;
    }, false);
  }

  async delPattern(pattern: string): Promise<number> {
    return this.safe(async () => {
      let cursor = '0';
      let deleted = 0;
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length) deleted += await this.client.del(...keys);
      } while (cursor !== '0');
      return deleted;
    }, 0);
  }

  async exists(key: string): Promise<boolean> {
    return this.safe(async () => (await this.client.exists(key)) === 1, false);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return this.safe(async () => (await this.client.expire(key, seconds)) === 1, false);
  }

  async ttl(key: string): Promise<number> {
    return this.safe(() => this.client.ttl(key), -1);
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    return this.safe(() => this.client.incrby(key, amount), 0);
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.safe(() => this.client.decrby(key, amount), 0);
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    return this.safe(async () => {
      const v = await this.client.hget(key, field);
      return v === null ? null : (JSON.parse(v) as T);
    }, null);
  }

  async hset(key: string, field: string, value: any): Promise<boolean> {
    return this.safe(async () => {
      await this.client.hset(key, field, JSON.stringify(value));
      return true;
    }, false);
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    return this.safe(async () => {
      const raw = await this.client.hgetall(key);
      if (!raw || Object.keys(raw).length === 0) return null;
      const result: Record<string, T> = {};
      for (const [k, v] of Object.entries(raw)) result[k] = JSON.parse(v) as T;
      return result;
    }, null);
  }

  async hdel(key: string, field: string): Promise<boolean> {
    return this.safe(async () => {
      await this.client.hdel(key, field);
      return true;
    }, false);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.safe(() => this.client.sadd(key, ...members), 0);
  }

  async smembers(key: string): Promise<string[]> {
    return this.safe(() => this.client.smembers(key), []);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return this.safe(async () => (await this.client.sismember(key, member)) === 1, false);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.safe(() => this.client.srem(key, ...members), 0);
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.safe(() => this.client.lpush(key, ...values), 0);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.safe(() => this.client.rpush(key, ...values), 0);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.safe(() => this.client.lrange(key, start, stop), []);
  }

  async ltrim(key: string, start: number, stop: number): Promise<boolean> {
    return this.safe(async () => {
      await this.client.ltrim(key, start, stop);
      return true;
    }, false);
  }

  async flushdb(): Promise<boolean> {
    return this.safe(async () => {
      await this.client.flushdb();
      return true;
    }, false);
  }

  async ping(): Promise<boolean> {
    return this.safe(async () => (await this.client.ping()) === 'PONG', false);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.safe(async () => {
      let cursor = '0';
      const found: string[] = [];
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        found.push(...keys);
      } while (cursor !== '0');
      return found;
    }, []);
  }

  isClientConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    await this.client.quit().catch(() => this.client.disconnect());
  }

  async invalidateAvailability(roomId: string): Promise<void> {
    await this.delPattern(`room:${roomId}:availability:*`);
  }

  async cacheWithFallback<T>(key: string, fetchFn: () => Promise<T>, ttl: number = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fetchFn();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  async invalidateCache(pattern: string): Promise<number> {
    return this.delPattern(pattern);
  }
}

const client: CacheClient = env.REDIS_URL
  ? new RedisBackedCacheClient(env.REDIS_URL)
  : new InMemoryCacheClient();

if (!env.REDIS_URL) {
  logger.warn('REDIS_URL not set -- using in-memory cache fallback (no state shared across instances)');
}

export default client;
