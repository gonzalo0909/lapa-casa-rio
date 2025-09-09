"use strict";

const winston = require('winston');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');

// Crear directorio de logs si no existe
const fs = require('fs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  })
);

// Configuración del logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { 
    service: 'lapa-casa-backend',
    env: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Archivo de errores
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Archivo general
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Performance logs
    new winston.transports.File({
      filename: path.join(logDir, 'performance.log'),
      level: 'debug',
      maxsize: 5242880,
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.label({ label: 'PERF' }),
        customFormat
      )
    })
  ]
});

// Console para desarrollo
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    )
  }));
}

// Middleware para request logging
function requestLogger(req, res, next) {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    
    logger.info('Request processed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: data ? data.length : 0
    });
    
    // Log slow requests
    if (duration > 2000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        threshold: 2000
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
}

// Performance tracking
function trackPerformance(operation, metadata = {}) {
  const start = Date.now();
  
  return {
    end: (additionalMeta = {}) => {
      const duration = Date.now() - start;
      logger.debug('Performance tracked', {
        operation,
        duration,
        ...metadata,
        ...additionalMeta
      });
      return duration;
    }
  };
}

// Error logging con contexto
function logError(error, context = {}) {
  logger.error('Application error', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context
  });
}

// Business metrics
function logBusinessEvent(event, data = {}) {
  logger.info('Business event', {
    event,
    data,
    category: 'business'
  });
}

// Security events
function logSecurityEvent(event, request, details = {}) {
  logger.warn('Security event', {
    event,
    ip: request.ip,
    userAgent: request.get('User-Agent'),
    url: request.url,
    method: request.method,
    details,
    category: 'security'
  });
}

module.exports = {
  logger,
  requestLogger,
  trackPerformance,
  logError,
  logBusinessEvent,
  logSecurityEvent
};
