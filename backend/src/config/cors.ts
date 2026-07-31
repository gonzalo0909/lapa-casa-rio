// lapa-casa-hostel/backend/src/config/cors.ts

import cors, { CorsOptions } from 'cors';
import { Request } from 'express';
import { env, isProduction } from './environment';
import { logger } from '../utils/logger';

/**
 * CORS Configuration
 * Cross-Origin Resource Sharing setup for Lapa Casa Hostel API
 * 
 * Features:
 * - Environment-based origin whitelisting
 * - Credentials support
 * - Preflight caching
 * - Custom headers support
 * - Dynamic origin validation
 */

/**
 * Allowed origins based on environment
 */
const getAllowedOrigins = (): string[] => {
  if (!isProduction()) {
    // Development: Allow localhost and common dev ports
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://localhost:5173', // Vite default
      'http://localhost:4173'  // Vite preview
    ];
  }

  // Production: Parse from environment variable
  const origins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  
  return [
    'https://lapacasahostel.com',
    'https://www.lapacasahostel.com',
    'https://booking.lapacasahostel.com',
    ...origins
  ].filter(origin => origin !== '*');
};

const allowedOrigins = getAllowedOrigins();

/**
 * Dynamic origin validation
 * @param origin - Request origin
 * @param callback - CORS callback function
 */
const originValidator = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void => {
  // Allow requests with no origin (mobile apps, Postman, curl)
  if (!origin) {
    logger.debug('CORS: Request with no origin allowed');
    return callback(null, true);
  }

  // Allow all origins in development
  if (!isProduction()) {
    logger.debug('CORS: Development mode - origin allowed', { origin });
    return callback(null, true);
  }

  // Check if origin is in whitelist
  if (allowedOrigins.includes(origin)) {
    logger.debug('CORS: Origin allowed', { origin });
    return callback(null, true);
  }

  // Check wildcard patterns
  const isAllowed = allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
      const pattern = new RegExp(
        '^' + allowedOrigin.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$'
      );
      return pattern.test(origin);
    }
    return false;
  });

  if (isAllowed) {
    logger.debug('CORS: Origin matched wildcard pattern', { origin });
    return callback(null, true);
  }

  // Origin not allowed
  logger.warn('CORS: Origin blocked', { origin, allowedOrigins });
  callback(new Error(`Origin ${origin} not allowed by CORS policy`));
};

/**
 * CORS options configuration
 */
export const corsOptions: CorsOptions = {
  origin: originValidator,
  
  // Allow credentials (cookies, authorization headers)
  credentials: env.CORS_CREDENTIALS,
  
  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  
  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'Accept',
    'Accept-Language',
    'Cache-Control',
    'Pragma'
  ],
  
  // Exposed headers (accessible to client)
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'X-Request-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  
  // Preflight cache duration (24 hours)
  maxAge: 86400,
  
  // Pass CORS preflight response to next handler
  preflightContinue: false,
  
  // Provide successful OPTIONS status
  optionsSuccessStatus: 204
};

/**
 * Strict CORS options for sensitive endpoints
 * Used for payment and admin routes
 */
export const strictCorsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Only allow exact matches for sensitive routes
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS: Strict mode - origin blocked', { origin });
      callback(new Error('Strict CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600 // 1 hour cache
};

/**
 * Public CORS options for health checks and public endpoints
 */
export const publicCorsOptions: CorsOptions = {
  origin: '*',
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  maxAge: 86400
};

/**
 * CORS middleware factory
 * Creates CORS middleware with custom options
 * @param options - Custom CORS options
 */
export const createCorsMiddleware = (options?: CorsOptions) => {
  return cors(options || corsOptions);
};

/**
 * Validate CORS configuration on startup
 */
export const validateCorsConfig = (): void => {
  logger.info('CORS Configuration', {
    environment: env.NODE_ENV,
    allowedOrigins: isProduction() ? allowedOrigins : ['*'],
    credentials: env.CORS_CREDENTIALS,
    methods: corsOptions.methods,
    strictMode: isProduction()
  });

  // Warn if using wildcard in production
  if (isProduction() && env.CORS_ORIGIN === '*') {
    logger.warn('SECURITY WARNING: CORS wildcard (*) enabled in production');
  }

  // Validate origin format
  allowedOrigins.forEach(origin => {
    try {
      if (origin !== '*' && !origin.includes('*')) {
        new URL(origin);
      }
    } catch (error) {
      logger.error('Invalid CORS origin format', { origin });
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
  });
};

/**
 * CORS error handler
 * Custom error messages for CORS failures
 */
export const corsErrorHandler = (err: Error, req: Request): void => {
  if (err.message.includes('CORS')) {
    logger.error('CORS error', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      error: err.message
    });
  }
};

/**
 * Add security headers middleware
 * Complementary to CORS for enhanced security
 */
export const securityHeadersMiddleware = (
  req: Request,
  res: any,
  next: any
): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  if (isProduction()) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    );
  }
  
  // Strict Transport Security (HTTPS only)
  if (isProduction()) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // Permissions Policy
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  next();
};

/**
 * Request origin logger middleware
 * Logs all cross-origin requests for monitoring
 */
export const originLoggerMiddleware = (
  req: Request,
  res: any,
  next: any
): void => {
  const origin = req.headers.origin;
  
  if (origin && origin !== req.headers.host) {
    logger.debug('Cross-origin request', {
      origin,
      method: req.method,
      path: req.path,
      ip: req.ip
    });
  }

  next();
};

// Validate CORS configuration on module load
validateCorsConfig();

export default createCorsMiddleware();
