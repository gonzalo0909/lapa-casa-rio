// lapa-casa-hostel/backend/src/middleware/rate-limiter.ts
// M-05: rate limiters con Redis store compartido entre instancias.
// En despliegue multi-instancia (Render con >1 réplica) el contador
// en memoria es independiente por proceso — con Redis es global.

import rateLimit from 'express-rate-limit';
import { redisCache } from '@/config/redis';
import { logger } from '@/utils/logger';

/**
 * Store Redis compatible con express-rate-limit.
 * Implementa el contrato { increment, decrement, resetKey } usando
 * el RedisCache ya configurado en el proyecto.
 */
class RedisRateLimitStore {
  private prefix: string;
  private windowMs: number;

  constructor(prefix: string, windowMs: number) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}:${key}`;
    const ttlSec = Math.ceil(this.windowMs / 1000);
    try {
      const current = await redisCache.incr(redisKey, 1);
      if (current === 1) {
        await redisCache.expire(redisKey, ttlSec);
      }
      // Upstash puede devolver 0 cuando supera su límite de requests en vez de
      // lanzar una excepción — express-rate-limit exige totalHits >= 1, así que
      // en ese caso fail-open (no bloqueamos tráfico legítimo).
      const totalHits = typeof current === 'number' && current > 0 ? current : 1;
      return { totalHits, resetTime: new Date(Date.now() + ttlSec * 1000) };
    } catch (err) {
      // Si Redis falla, fail-open con hit = 1 para no bloquear tráfico legítimo
      logger.error('RedisRateLimitStore.increment error', { err });
      return { totalHits: 1, resetTime: new Date(Date.now() + ttlSec * 1000) };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await redisCache.decr(`${this.prefix}:${key}`, 1);
    } catch (err) {
      logger.error('RedisRateLimitStore.decrement error', { err });
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await redisCache.del(`${this.prefix}:${key}`);
    } catch (err) {
      logger.error('RedisRateLimitStore.resetKey error', { err });
    }
  }
}

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('rl:general', 60 * 1000) as any,
  handler: (_req: any, res: any) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
      timestamp: new Date().toISOString(),
    });
  },
});

export const rateLimiter = (options: { max: number; windowMs: number; prefix?: string }) =>
  rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore(
      `rl:${options.prefix ?? 'custom'}`,
      options.windowMs,
    ) as any,
    handler: (_req: any, res: any) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.',
        timestamp: new Date().toISOString(),
      });
    },
  });
