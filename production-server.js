"use strict";

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Production security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com", "https://sdk.mercadopago.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.stripe.com", "https://*.mercadopago.com"],
      frameSrc: ["https://js.stripe.com", "https://www.mercadopago.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'rate_limit_exceeded' },
  standardHeaders: true
});

app.use('/api/', apiLimiter);

// Compression
app.use(compression({
  level: 6,
  threshold: 1024
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS para producción
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://lapacasahostel.com',
    'https://www.lapacasahostel.com'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Static files with aggressive caching
const frontendPath = path.join(__dirname, 'frontend', 'src');
app.use(express.static(frontendPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : '0',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    }
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
    }
  }
}));

// API Routes (basic implementation for production)
app.post('/api/availability', async (req, res) => {
  try {
    // Simulated availability check
    const { from, to } = req.body;
    
    res.json({
      ok: true,
      from,
      to,
      occupied: {
        room1: [1, 5, 8],
        room3: [2, 7],
        room5: [1, 3],
        room6: []
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'availability_failed' });
  }
});

app.post('/api/holds/start', async (req, res) => {
  try {
    const holdId = `HOLD-${Date.now()}`;
    res.json({
      ok: true,
      holdId,
      expiresAt: Date.now() + (3 * 60 * 1000)
    });
  } catch (err) {
    res.status(500).json({ error: 'hold_failed' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const bookingId = `BK-${Date.now()}`;
    res.json({
      ok: true,
      bookingId,
      status: 'confirmed'
    });
  } catch (err) {
    res.status(500).json({ error: 'booking_failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// Admin endpoint
app.get('/api/admin/status', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  res.json({
    server: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'internal_server_error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'not_found' });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Production server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Frontend path: ${frontendPath}`);
});

module.exports = app;
