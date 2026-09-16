// lapa-casa-hostel/backend/src/config/cors.ts
//
// FIX (auditoría 2026-08-30): se eliminaron 5 exports sin ningún uso
// (strictCorsOptions, publicCorsOptions, createCorsMiddleware,
// corsErrorHandler, securityHeadersMiddleware, originLoggerMiddleware)
// -- app.ts aplica CORS directamente con `cors(corsOptions)`, nunca usó
// la fábrica ni el default export de este archivo. corsOptions es el
// único export real en uso.

import type { CorsOptions } from 'cors';
import { env, isProduction } from './environment';
import { logger } from '../utils/logger';

/**
 * CORS Configuration
 * Cross-Origin Resource Sharing setup for Lapa Casa API
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
  const origins = env.CORS_ORIGINS.split(',').map(origin => origin.trim());

  return [
    'https://lapacasario.com',
    'https://www.lapacasario.com',
    'https://booking.lapacasario.com',
    // El panel /admin se sirve desde el propio backend (mismo origen que
    // APP_URL) -- sin esto, fetch() desde /admin/index.html manda
    // Origin: <APP_URL> y el login queda bloqueado por CORS (ver login
    // admin devolviendo 500 "Origin ... not allowed by CORS policy").
    env.APP_URL,
    // Deployments de Vercel: producción (lapa-casa.vercel.app) y previews
    // (lapa-casa-git-<branch>-lapa-casa.vercel.app, lapa-casa-<hash>-lapa-casa.vercel.app).
    'https://lapa-casa.vercel.app',
    'https://lapa-casa-*.vercel.app',
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

  // Check wildcard patterns (escape literal dots first, then expand * to .*)
  const isAllowed = allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
      const pattern = new RegExp(
        '^' + allowedOrigin.split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'
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
  // x-csrf-token: requerido por el patrón doble cookie del panel de owners
  // (ver backend/src/middleware/csrf.ts y frontend/src/lib/api.ts) -- el
  // frontend lo incluye en cada request no-GET una vez que recibe la cookie
  // lch_owner_csrf del login. Sin este header en la lista, el preflight CORS
  // falla para todos los POST/PUT/DELETE del panel y nunca llegan al servidor.
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'Accept',
    'Accept-Language',
    'Cache-Control',
    'Pragma',
    'x-csrf-token',
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
 * Validate CORS configuration on startup
 */
const validateCorsConfig = (): void => {
  logger.info('CORS Configuration', {
    environment: env.NODE_ENV,
    allowedOrigins: isProduction() ? allowedOrigins : ['*'],
    credentials: env.CORS_CREDENTIALS,
    methods: corsOptions.methods,
    strictMode: isProduction()
  });

  // Warn if using wildcard in production
  if (isProduction() && env.CORS_ORIGINS === '*') {
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

// Validate CORS configuration on module load
validateCorsConfig();
