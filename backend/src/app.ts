// lapa-casa-hostel/backend/src/app.ts

import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { logger } from '@/utils/logger';
import { environment } from '@/config/environment';
import { corsOptions } from '@/config/cors';
import { errorHandler } from '@/middleware/error-handler';
import { rateLimiter } from '@/middleware/rate-limiter';
import routes from '@/routes';

/**
 * Express application instance for Lapa Casa Hostel Channel Manager
 * Configures all middleware, routes, and error handling
 */

const app: Application = express();

// ===========================================
// TRUST PROXY (for production behind reverse proxy)
// ===========================================
if (environment.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================

/**
 * Helmet - Security headers
 * Protects against common vulnerabilities
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

/**
 * CORS - Cross-Origin Resource Sharing
 * Allows frontend to communicate with API
 */
app.use(cors(corsOptions));

// ===========================================
// REQUEST PARSING MIDDLEWARE
// ===========================================

/**
 * JSON body parser
 * Max size: 10mb for file uploads
 */
app.use(express.json({ limit: '10mb' }));

/**
 * URL-encoded body parser
 * For form submissions
 */
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Response compression
 * Reduces response size for better performance
 */
app.use(compression());

// ===========================================
// LOGGING MIDDLEWARE
// ===========================================

/**
 * Morgan HTTP request logger
 * Different formats for dev vs production
 */
if (environment.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));
}

// ===========================================
// RATE LIMITING
// ===========================================

/**
 * Global rate limiter
 * Prevents abuse and DDoS attacks
 */
app.use('/api/', rateLimiter);

// ===========================================
// HEALTH CHECK ENDPOINT
// ===========================================

/**
 * Health check endpoint
 * Used by Docker, Kubernetes, monitoring tools
 */
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const { prisma } = await import('@/config/database');
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis connection
    const { redis } = await import('@/config/redis');
    await redis.ping();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: environment.nodeEnv,
      version: environment.apiVersion,
      services: {
        database: 'connected',
        redis: 'connected',
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});

/**
 * Readiness check endpoint
 * More detailed health information
 */
app.get('/ready', async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('@/config/database');
    const { redis } = await import('@/config/redis');

    // Test database
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    // Test Redis
    const redisStart = Date.now();
    await redis.ping();
    const redisLatency = Date.now() - redisStart;

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'ok',
          latency: `${dbLatency}ms`,
        },
        redis: {
          status: 'ok',
          latency: `${redisLatency}ms`,
        },
      },
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
    });
  }
});

// ===========================================
// API ROUTES
// ===========================================

/**
 * Root endpoint
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Lapa Casa Hostel API',
    version: environment.apiVersion,
    description: 'Channel Manager Backend',
    documentation: environment.nodeEnv === 'development' 
      ? `${environment.appUrl}/api-docs` 
      : 'Contact admin for API documentation',
    health: `${environment.appUrl}/health`,
  });
});

/**
 * API version prefix
 */
app.use(`/api/${environment.apiVersion}`, routes);

// ===========================================
// 404 HANDLER
// ===========================================

/**
 * Handle undefined routes
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// ===========================================
// ERROR HANDLER
// ===========================================

/**
 * Global error handler middleware
 * Must be last middleware
 */
app.use(errorHandler);

// ===========================================
// EXPORT APP
// ===========================================

export default app;
