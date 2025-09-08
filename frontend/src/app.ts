import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import all API routes
import apiRoutes from './api';
import paymentsRoutes from './api/routes/payments';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: {
    ok: false,
    error: 'Too many requests, please try again later',
  },
});
app.use('/api', limiter);

// Raw body for webhooks (debe ir antes de express.json())
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments/mercadopago/webhook', express.raw({ type: 'application/json' }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Health check global
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.nodeEnv,
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api', apiRoutes);
app.use('/api/payments', paymentsRoutes);

// Static files para servir frontend en producción
if (config.nodeEnv === 'production') {
  app.use(express.static('public'));
  
  app.get('*', (_req, res) => {
    res.sendFile('public/index.html', { root: process.cwd() });
  });
}

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
