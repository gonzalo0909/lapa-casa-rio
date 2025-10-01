// lapa-casa-hostel/backend/src/middleware/rate-limiter.ts

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Redis } from 'ioredis';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Redis Client for Rate Limiting
 */
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_RATE_LIMIT_DB || '1')
});

redisClient.on('error', (err) => {
  logger.error('Redis rate limiter error:', err);
});

/**
 * Rate Limit Handler
 * Custom handler for when rate limit is exceeded
 */
const rateLimitHandler = (req: Request, res: Response): void => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    userAgent: req.get('user-agent')
  });

  res.status(429).json({
    success: false,
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: res.getHeader('Retry-After')
  });
};

/**
 * Skip Rate Limiting Function
 * Skip rate limiting for certain conditions
 */
const skipRateLimit = (req: Request): boolean => {
  // Skip for health checks
  if (req.path === '/health' || req.path === '/ping') {
    return true;
  }

  // Skip for whitelisted IPs
  const whitelistedIPs = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
  if (whitelistedIPs.includes(req.ip || '')) {
    return true;
  }

  return false;
};

/**
 * General API Rate Limiter
 * 100 requests per 15 minutes per IP
 * 
 * @description
 * - Applied to all API routes
 * - Protects against general abuse
 * - Uses Redis for distributed rate limiting
 */
export const generalRateLimiter: RateLimitRequestHandler = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:general:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

/**
 * Booking Creation Rate Limiter
 * 5 booking attempts per hour per IP
 * 
 * @description
 * - Prevents booking spam
 * - Stricter limits for resource-intensive operations
 */
export const bookingRateLimiter: RateLimitRequestHandler = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:booking:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 booking attempts per hour
  message: 'Too many booking attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  keyGenerator: (req: Request): string => {
    // Rate limit by IP + email combination for bookings
    const email = req.body?.guestEmail || '';
    return `${req.ip}-${email}`;
  }
});

/**
 * Payment Rate Limiter
 * 10 payment attempts per hour per IP
 * 
 * @description
 * - Protects payment processing endpoints
 * - Prevents payment fraud attempts
 */
export const paymentRateLimiter: RateLimitRequestHandler = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:payment:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: 'Too many payment attempts, please contact support',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

/**
 * Authentication Rate Limiter
 * 5 login attempts per 15 minutes per IP
 * 
 * @description
 * - Prevents brute force attacks
 * - Strict limits on authentication endpoints
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, account temporarily locked',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true // Only count failed attempts
});

/**
 * Availability Check Rate Limiter
 * 30 checks per minute per IP
 * 
 * @description
 * - Prevents availability API abuse
 * - More lenient for better UX during browsing
 */
export const availabilityRateLimiter: RateLimitRequestHandler = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:availability:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many availability checks, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit
});

/**
 * Webhook Rate Limiter
 * 100 requests per minute per endpoint
 * 
 * @description
 * - Protects webhook endpoints
 * - Higher limits for legitimate webhook traffic
 * - Uses API key instead of IP for identification
 */
export const webhookRateLimiter: RateLimitRequestHandler = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:webhook:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhooks per minute
  message: 'Webhook rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    // Rate limit by API key or signature
    const apiKey = req.headers['x-api-key'] as string;
    const signature = req.headers['x-webhook-signature'] as string;
    return apiKey || signature || req.ip || 'unknown';
  }
});

/**
 * Admin Panel Rate Limiter
 * 200 requests per 15 minutes per user
 * 
 * @description
 * - More lenient for authenticated admin users
 * - Prevents admin panel abuse
 */
export const adminRateLimiter: RateLimitRequestHandler = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:admin:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes
  message: 'Too many admin requests',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    // Rate limit by user ID for authenticated users
    const userId = (req as any).user?.userId;
    return userId || req.ip || 'unknown';
  }
});

/**
 * Email Sending Rate Limiter
 * 3 emails per hour per user
 * 
 * @description
 * - Prevents email spam
 * - Protects email service quotas
 */
export const emailRateLimiter: RateLimitRequestHandler = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:email:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 emails per hour
  message: 'Too many emails sent, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    const email = req.body?.email || req.body?.to || '';
    return `${req.ip}-${email}`;
  }
});

/**
 * Custom Rate Limiter Factory
 * Creates a custom rate limiter with specific configuration
 * 
 * @param options - Rate limiter options
 * @returns Configured rate limiter middleware
 * 
 * @example
 * const customLimiter = createRateLimiter({
 *   windowMs: 60000,
 *   max: 10,
 *   prefix: 'custom'
 * });
 */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  prefix: string;
  message?: string;
  keyGenerator?: (req: Request) => string;
}): RateLimitRequestHandler => {
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: `rl:${options.prefix}:`
    }),
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: skipRateLimit,
    keyGenerator: options.keyGenerator
  });
};

/**
 * Rate Limit Reset Function
 * Manually reset rate limit for a specific key
 * 
 * @param prefix - Rate limiter prefix
 * @param key - Key to reset
 */
export const resetRateLimit = async (prefix: string, key: string): Promise<void> => {
  try {
    await redisClient.del(`rl:${prefix}:${key}`);
    logger.info(`Rate limit reset for ${prefix}:${key}`);
  } catch (error) {
    logger.error('Error resetting rate limit:', error);
    throw error;
  }
};

/**
 * Get Rate Limit Info
 * Retrieve current rate limit status for a key
 * 
 * @param prefix - Rate limiter prefix
 * @param key - Key to check
 * @returns Rate limit info or null
 */
export const getRateLimitInfo = async (
  prefix: string,
  key: string
): Promise<{ hits: number; resetTime: Date } | null> => {
  try {
    const redisKey = `rl:${prefix}:${key}`;
    const hits = await redisClient.get(redisKey);
    const ttl = await redisClient.ttl(redisKey);

    if (!hits) return null;

    return {
      hits: parseInt(hits),
      resetTime: new Date(Date.now() + ttl * 1000)
    };
  } catch (error) {
    logger.error('Error getting rate limit info:', error);
    return null;
  }
};
