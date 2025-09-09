"use strict";

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Servicios optimizados
const { logger, requestLogger } = require('./api/services/logger');
const metrics = require('./api/services/metrics');
const cache = require('./api/services/cache');

// Rutas
const availabilityRouter = require('./api/routes/availability');
const bookingsRouter = require('./api/routes/bookings');
const { router: holdsRouter } = require('./api/routes/holds');
const { router: paymentsRouter, stripeWebhook, mpWebhook } = require('./api/routes/payments');

const app = express();
const PORT = process.env.PORT || 3001;

// === INICIALIZACIÓN ===
async function initializeServices() {
  try {
    await cache.connect();
    logger.info('Services initialized successfully');
  } catch (err) {
    logger.error('Service initialization failed:', err);
    process.exit(1);
  }
}

// === SEGURIDAD ===
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://sdk.mercadopago.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3001", "https://*.stripe.com", "https://*.mercadopago.com"],
      frameSrc: ["https://js.stripe.com", "https://www.mercadopago.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// === RATE LIMITING ===
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: 'rate_limit_exceeded' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'api_rate_limit_exceeded' }
});

app.use(generalLimiter);
app.use('/api/', apiLimiter);

// === MIDDLEWARES ===
app.use(compression());
app.use(requestLogger);
app.use(metrics.getMiddleware());

// Raw body para webhooks de Stripe
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));

// JSON parser para el resto
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === CORS ===
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://lapacasahostel.com',
    'https://www.lapacasahostel.com'
  ];
  
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// === STATIC FILES ===
const frontendPath = path.join(__dirname, 'frontend', 'src');
app.use(express.static(frontendPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    
    // Cache estático en producción
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// === API ROUTES ===
app.use('/api/availability', availabilityRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/holds', holdsRouter);
app.use('/api/payments', paymentsRouter);

// Webhooks especiales (raw body)
app.post('/api/payments/stripe/webhook', stripeWebhook);
app.get('/api/payments/mp/webhook', mpWebhook);
app.post('/api/payments/mp/webhook', mpWebhook);

// === HEALTH & METRICS ===
app.get('/api/health', async (req, res) => {
  const timer = metrics.startTimer('health_check_duration');
  
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache: cache.getStats(),
      metrics: {
        requests: metrics.getCounters().http_requests_total || 0,
        errors: metrics.getCounters().http_errors_total || 0
      }
    };
    
    res.json(health);
  } catch (err) {
    logger.error('Health check failed:', err);
    res.status(503).json({
      status: 'error',
      error: 'health_check_failed'
    });
  } finally {
    timer.end();
  }
});

app.get('/api/metrics', (req, res) => {
  try {
    if (req.headers.accept === 'application/json') {
      res.json(metrics.getSystemStats());
    } else {
      res.setHeader('Content-Type', 'text/plain');
      res.send(metrics.getPrometheusMetrics());
    }
  } catch (err) {
    logger.error('Metrics endpoint failed:', err);
    res.status(500).json({ error: 'metrics_failed' });
  }
});

// === ADMIN ROUTES ===
app.get('/api/admin/stats', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  res.json({
    system: metrics.getSystemStats(),
    cache: cache.getStats(),
    uptime: process.uptime()
  });
});

// === SERVICE WORKER ===
app.get('/sw.js', (req, res) => {
  const swPath = path.join(frontendPath, 'sw.js');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  
  if (fs.existsSync(swPath)) {
    res.sendFile(swPath);
  } else {
    res.send('// Service Worker not found');
  }
});

// === ERROR HANDLING ===
app.use((err, req, res, next) => {
  metrics.increment('http_errors_total');
  
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    error: 'internal_server_error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// === 404 HANDLER ===
app.use((req, res) => {
  // Static files
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    return res.status(404).send('File not found');
  }
  
  // SPA fallback
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'not_found' });
  }
});

// === GRACEFUL SHUTDOWN ===
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await cache.destroy();
    process.exit(0);
  } catch (err) {
    logger.error('Shutdown error:', err);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    await cache.destroy();
    process.exit(0);
  } catch (err) {
    logger.error('Shutdown error:', err);
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', { reason, promise });
  process.exit(1);
});

// === STARTUP ===
async function startServer() {
  try {
    await initializeServices();
    
    app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`, {
        env: process.env.NODE_ENV || 'development',
        frontend: fs.existsSync(frontendPath) ? 'found' : 'missing'
      });
      
      // Verificar archivos críticos
      const criticalFiles = [
        'index.html',
        'js/main.js',
        'assets/css/styles.css'
      ];
      
      criticalFiles.forEach(file => {
        const fullPath = path.join(frontendPath, file);
        if (fs.existsSync(fullPath)) {
          logger.info(`Found: ${file}`);
        } else {
          logger.warn(`Missing: ${file}`);
        }
      });
    });
  } catch (err) {
    logger.error('Server startup failed:', err);
    process.exit(1);
  }
}

startServer();
