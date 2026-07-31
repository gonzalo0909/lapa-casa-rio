// lapa-casa-hostel/backend/src/utils/logger.ts

import winston from 'winston';
import path from 'path';

/**
 * Custom Log Levels
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

/**
 * Log Level Colors
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

/**
 * Determine Log Level Based on Environment
 */
const level = (): string => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

/**
 * Custom Format for Console Output
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    let metaString = '';
    if (Object.keys(meta).length > 0) {
      metaString = '\n' + JSON.stringify(meta, null, 2);
    }

    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

/**
 * Custom Format for File Output
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.uncolorize(),
  winston.format.json()
);

/**
 * Transport Configuration
 */
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat
  }),

  // Error log file
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),

  // HTTP requests log file
  new winston.transports.File({
    filename: path.join('logs', 'http.log'),
    level: 'http',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 3
  })
];

/**
 * Winston Logger Instance
 */
export const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test'
});

/**
 * Stream for Morgan HTTP Logger
 */
export const morganStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  }
};

/**
 * Log Booking Event Helper
 */
export const logBooking = {
  created: (bookingId: string, data: any): void => {
    logger.info('Booking created', {
      bookingId,
      guestEmail: data.guestEmail,
      checkIn: data.checkInDate,
      checkOut: data.checkOutDate,
      bedsCount: data.bedsCount,
      totalPrice: data.totalPrice
    });
  },

  confirmed: (bookingId: string, paymentId: string): void => {
    logger.info('Booking confirmed', {
      bookingId,
      paymentId,
      status: 'confirmed'
    });
  },

  cancelled: (bookingId: string, reason: string): void => {
    logger.warn('Booking cancelled', {
      bookingId,
      reason
    });
  },

  modified: (bookingId: string, changes: any): void => {
    logger.info('Booking modified', {
      bookingId,
      changes
    });
  }
};

/**
 * Log Payment Event Helper
 */
export const logPayment = {
  initiated: (paymentId: string, amount: number, currency: string): void => {
    logger.info('Payment initiated', {
      paymentId,
      amount,
      currency,
      status: 'pending'
    });
  },

  succeeded: (paymentId: string, amount: number, provider: string): void => {
    logger.info('Payment succeeded', {
      paymentId,
      amount,
      provider,
      status: 'succeeded'
    });
  },

  failed: (paymentId: string, error: string): void => {
    logger.error('Payment failed', {
      paymentId,
      error,
      status: 'failed'
    });
  },

  refunded: (paymentId: string, amount: number, reason: string): void => {
    logger.warn('Payment refunded', {
      paymentId,
      amount,
      reason,
      status: 'refunded'
    });
  }
};

/**
 * Log Security Event Helper
 */
export const logSecurity = {
  rateLimitExceeded: (ip: string, endpoint: string): void => {
    logger.warn('Rate limit exceeded', {
      ip,
      endpoint,
      severity: 'medium'
    });
  },

  invalidToken: (ip: string, token: string): void => {
    logger.warn('Invalid token attempt', {
      ip,
      token: token.substring(0, 10) + '...',
      severity: 'high'
    });
  },

  unauthorizedAccess: (userId: string, resource: string): void => {
    logger.warn('Unauthorized access attempt', {
      userId,
      resource,
      severity: 'high'
    });
  },

  suspiciousActivity: (details: any): void => {
    logger.error('Suspicious activity detected', {
      ...details,
      severity: 'critical'
    });
  }
};

/**
 * Log External Service Helper
 */
export const logExternal = {
  stripe: (action: string, success: boolean, details?: any): void => {
    const level = success ? 'info' : 'error';
    logger[level]('Stripe API call', {
      service: 'stripe',
      action,
      success,
      ...details
    });
  },

  mercadoPago: (action: string, success: boolean, details?: any): void => {
    const level = success ? 'info' : 'error';
    logger[level]('Mercado Pago API call', {
      service: 'mercado_pago',
      action,
      success,
      ...details
    });
  },

  googleSheets: (action: string, success: boolean, details?: any): void => {
    const level = success ? 'info' : 'error';
    logger[level]('Google Sheets API call', {
      service: 'google_sheets',
      action,
      success,
      ...details
    });
  },

  whatsapp: (action: string, success: boolean, details?: any): void => {
    const level = success ? 'info' : 'error';
    logger[level]('WhatsApp API call', {
      service: 'whatsapp',
      action,
      success,
      ...details
    });
  },

  email: (action: string, success: boolean, details?: any): void => {
    const level = success ? 'info' : 'error';
    logger[level]('Email service call', {
      service: 'email',
      action,
      success,
      ...details
    });
  }
};

/**
 * Log Performance Helper
 */
export const logPerformance = {
  slowQuery: (query: string, duration: number): void => {
    logger.warn('Slow database query', {
      query,
      duration: `${duration}ms`,
      threshold: '1000ms'
    });
  },

  slowRequest: (path: string, method: string, duration: number): void => {
    logger.warn('Slow HTTP request', {
      path,
      method,
      duration: `${duration}ms`,
      threshold: '3000ms'
    });
  },

  slowExternalCall: (service: string, duration: number): void => {
    logger.warn('Slow external service call', {
      service,
      duration: `${duration}ms`,
      threshold: '5000ms'
    });
  }
};

/**
 * Create Child Logger with Context
 */
export const createContextLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

/**
 * Log Startup Information
 */
export const logStartup = (): void => {
  logger.info('='.repeat(50));
  logger.info('🚀 Lapa Casa Hostel - Channel Manager');
  logger.info('='.repeat(50));
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Port: ${process.env.PORT || 3001}`);
  logger.info(`Log Level: ${level()}`);
  logger.info(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  logger.info(`Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
  logger.info('='.repeat(50));
};

/**
 * Log Shutdown Information
 */
export const logShutdown = (signal: string): void => {
  logger.info('='.repeat(50));
  logger.warn(`Received ${signal} signal`);
  logger.warn('Shutting down gracefully...');
  logger.info('='.repeat(50));
};
