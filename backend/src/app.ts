// lapa-casa-hostel/backend/src/app.ts

import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from '@/utils/logger';
import { environment } from '@/config/environment';
import { corsOptions } from '@/config/cors';
import { errorHandler } from '@/middleware/error-handler';
import { generalRateLimiter } from '@/middleware/rate-limiter';
import routes from '@/routes';

const app: Application = express();

if (environment.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

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

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/', generalRateLimiter);

app.get('/health', async (req: Request, res: Response) => {
  try {
    const { testConnection } = await import('@/config/database');
    const ok = await testConnection();

    if (!ok) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: { database: 'disconnected' },
      });
      return;
    }

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: environment.NODE_ENV,
      version: environment.API_VERSION,
      services: { database: 'connected' },
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

app.get('/ready', async (req: Request, res: Response) => {
  try {
    const { testConnection } = await import('@/config/database');
    const ok = await testConnection();

    if (!ok) {
      res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
      return;
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'ok',
        },
      },
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
  }
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Lapa Casa Hostel API',
    version: environment.API_VERSION,
    description: 'Channel Manager Backend',
    documentation: environment.NODE_ENV === 'development'
      ? `${environment.APP_URL}/api-docs`
      : 'Contact admin for API documentation',
    health: `${environment.APP_URL}/health`,
  });
});

app.use(`/api/${environment.API_VERSION}`, routes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

app.use(errorHandler);

export default app;
