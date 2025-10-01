// lapa-casa-hostel/backend/src/config/security.ts

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { env, isProduction } from './environment';
import { logger } from '../utils/logger';
import { cache } from './redis';

/**
 * Security Configuration
 * Comprehensive security setup for Lapa Casa Hostel API
 * 
 * Features:
 * - Helmet security headers
 * - Rate limiting (Redis-backed)
 * - Request sanitization
 * - IP tracking and blocking
 * - Security event logging
 * - Brute force protection
 */

/**
 * Helmet configuration
 * Sets various HTTP headers for security
 */
export const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  
  // Cross-Origin policies
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  
  // DNS prefetch control
  dnsPrefetchControl: { allow: false },
  
  // Frameguard
  frameguard: { action: 'deny' },
  
  // Hide powered by Express
  hidePoweredBy: true,
  
  // HSTS
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  
  // IE No Open
  ieNoOpen: true,
  
  // No Sniff
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  
  // XSS Filter
  xssFilter: true
});

/**
 * Rate limiter store using Redis
 */
class RedisRateLimitStore {
  private prefix = 'ratelimit';

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}:${key}`;
    const ttl = Math.floor(env.RATE_LIMIT_WINDOW_MS / 1000);

    try {
      const current = await cache.incr(redisKey, 1);
      
      // Set expiry on first request
      if (current === 1) {
        await cache.expire(redisKey, ttl);
      }

      const resetTime = new Date(Date.now() + ttl * 1000);

      return {
        totalHits: current,
        resetTime
      };
    } catch (error) {
      logger.error('Rate limit store error', { error });
      throw error;
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    try {
      await cache.decr(redisKey, 1);
    } catch (error) {
      logger.error('Rate limit decrement error', { error });
    }
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`;
    try {
      await cache.del(redisKey);
    } catch (error) {
      logger.error('Rate limit reset error', { error });
    }
  }
}

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  // Key generator: IP + User Agent hash
  keyGenerator: (req: Request): string => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${ip}`;
  },
  
  // Handler for rate limit exceeded
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']
    });

    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000)
    });
  },
  
  skip: (req: Request): boolean => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    error: 'Too many authentication attempts',
    message: 'Account temporarily locked. Please try again in 15 minutes.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: Request): string => {
    const ip = req.ip || 'unknown';
    const email = req.body?.email || 'no-email';
    return `auth:${ip}:${email}`;
  },
  
  handler: (req: Request, res: Response) => {
    logger.error('Authentication rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      path: req.path
    });

    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Account temporarily locked. Please try again in 15 minutes.'
    });
  }
});

/**
 * Payment endpoint rate limiter
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment attempts per hour
  message: {
    error: 'Payment limit exceeded',
    message: 'Too many payment attempts. Please contact support.',
    retryAfter: 3600
  },
  
  keyGenerator: (req: Request): string => {
    const ip = req.ip || 'unknown';
    return `payment:${ip}`;
  },
  
  handler: (req: Request, res: Response) => {
    logger.error('Payment rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      bookingId: req.body?.bookingId
    });

    res.status(429).json({
      error: 'Payment limit exceeded',
      message: 'Too many payment attempts. Please contact support.'
    });
  }
});

/**
 * Booking creation rate limiter
 */
export const bookingRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 3, // 3 bookings per 30 minutes
  message: {
    error: 'Booking limit exceeded',
    message: 'Maximum bookings reached. Please try again later.',
    retryAfter: 1800
  },
  
  keyGenerator: (req: Request): string => {
    const ip = req.ip || 'unknown';
    return `booking:${ip}`;
  },
  
  handler: (req: Request, res: Response) => {
    logger.warn('Booking rate limit exceeded', {
      ip: req.ip,
      guestEmail: req.body?.guestEmail
    });

    res.status(429).json({
      error: 'Booking limit exceeded',
      message: 'Maximum bookings reached. Please try again later.'
    });
  }
});

/**
 * IP blacklist management
 */
class IPBlacklist {
  private prefix = 'blacklist:ip';

  async add(ip: string, reason: string, durationMinutes: number = 60): Promise<void> {
    const key = `${this.prefix}:${ip}`;
    const ttl = durationMinutes * 60;

    try {
      await cache.set(key, { reason, blockedAt: new Date().toISOString() }, ttl);
      logger.warn('IP blacklisted', { ip, reason, duration: `${durationMinutes}m` });
    } catch (error) {
      logger.error('IP blacklist add error', { error });
    }
  }

  async remove(ip: string): Promise<void> {
    const key = `${this.prefix}:${ip}`;
    try {
      await cache.del(key);
      logger.info('IP removed from blacklist', { ip });
    } catch (error) {
      logger.error('IP blacklist remove error', { error });
    }
  }

  async isBlacklisted(ip: string): Promise<boolean> {
    const key = `${this.prefix}:${ip}`;
    try {
      return await cache.exists(key);
    } catch (error) {
      logger.error('IP blacklist check error', { error });
      return false;
    }
  }

  async getInfo(ip: string): Promise<{ reason: string; blockedAt: string } | null> {
    const key = `${this.prefix}:${ip}`;
    try {
      return await cache.get(key);
    } catch (error) {
      logger.error('IP blacklist info error', { error });
      return null;
    }
  }
}

export const ipBlacklist = new IPBlacklist();

/**
 * IP blacklist middleware
 */
export const ipBlacklistMiddleware = async (
  req: Request,
  res: Response,
  next: any
): Promise<void> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const isBlocked = await ipBlacklist.isBlacklisted(ip);

    if (isBlocked) {
      const info = await ipBlacklist.getInfo(ip);
      logger.warn('Blocked IP attempted access', {
        ip,
        path: req.path,
        reason: info?.reason
      });

      res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address has been temporarily blocked.'
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('IP blacklist middleware error', { error });
    next();
  }
};

/**
 * Request sanitization middleware
 * Prevents XSS and injection attacks
 */
export const sanitizeRequestMiddleware = (
  req: Request,
  res: Response,
  next: any
): void => {
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

/**
 * Sanitize object recursively
 */
const sanitizeObject = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
};

/**
 * Sanitize string values
 */
const sanitizeString = (value: any): any => {
  if (typeof value !== 'string') {
    return value;
  }

  // Remove script tags
  let sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove data: protocol (except for images)
  sanitized = sanitized.replace(/data:(?!image)/gi, '');

  return sanitized;
};

/**
 * Security event logger
 */
export const logSecurityEvent = (
  event: string,
  req: Request,
  details?: Record<string, any>
): void => {
  logger.warn('Security event', {
    event,
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * Suspicious activity detector
 */
export const detectSuspiciousActivity = async (
  req: Request
): Promise<boolean> => {
  const ip = req.ip || 'unknown';
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempt
    /union.*select/i, // SQL injection
    /exec\s*\(/i, // Code execution
    /system\s*\(/i, // System command
    /\${.*}/, // Template injection
    /\beval\b/i // Eval injection
  ];

  const url = req.originalUrl || req.url;
  const bodyStr = JSON.stringify(req.body || {});

  // Check URL and body for suspicious patterns
  const isSuspicious = suspiciousPatterns.some(
    pattern => pattern.test(url) || pattern.test(bodyStr)
  );

  if (isSuspicious) {
    logSecurityEvent('suspicious_activity_detected', req, {
      url,
      body: req.body
    });

    // Blacklist IP for 60 minutes
    await ipBlacklist.add(ip, 'Suspicious activity detected', 60);
    
    return true;
  }

  return false;
};

/**
 * Suspicious activity middleware
 */
export const suspiciousActivityMiddleware = async (
  req: Request,
  res: Response,
  next: any
): Promise<void> => {
  try {
    const isSuspicious = await detectSuspiciousActivity(req);

    if (isSuspicious) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Suspicious activity detected.'
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Suspicious activity middleware error', { error });
    next();
  }
};

/**
 * Request size limiter
 */
export const requestSizeLimiter = {
  limit: env.MAX_REQUEST_SIZE,
  message: 'Request payload too large'
};

/**
 * Secure headers for API responses
 */
export const secureResponseHeaders = (
  req: Request,
  res: Response,
  next: any
): void => {
  // Add request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-Id', requestId);

  // Cache control
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
};

/**
 * Initialize security configuration
 */
export const initializeSecurity = (): void => {
  logger.info('Security configuration initialized', {
    environment: env.NODE_ENV,
    rateLimiting: {
      window: `${env.RATE_LIMIT_WINDOW_MS}ms`,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS
    },
    helmet: 'enabled',
    sanitization: 'enabled',
    ipBlacklist: 'enabled'
  });

  if (!isProduction()) {
    logger.warn('Running in non-production mode - some security features relaxed');
  }
};

// Initialize on module load
initializeSecurity();

export default {
  helmet: helmetConfig,
  rateLimit: apiRateLimiter,
  authRateLimit: authRateLimiter,
  paymentRateLimit: paymentRateLimiter,
  bookingRateLimit: bookingRateLimiter,
  ipBlacklist: ipBlacklistMiddleware,
  sanitize: sanitizeRequestMiddleware,
  detectSuspicious: suspiciousActivityMiddleware,
  secureHeaders: secureResponseHeaders
};
