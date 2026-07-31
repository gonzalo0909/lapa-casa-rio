// lapa-casa-hostel/backend/src/middleware/logger.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request with tracking ID
 */
export interface TrackedRequest extends Request {
  requestId?: string;
  startTime?: number;
}

/**
 * HTTP Request Logger Middleware
 * Logs all incoming HTTP requests with detailed information
 * 
 * @description
 * - Assigns unique request ID
 * - Logs request details (method, path, IP, user agent)
 * - Measures response time
 * - Logs response status and size
 * - Sanitizes sensitive data from logs
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const trackedReq = req as TrackedRequest;
  
  // Assign unique request ID
  trackedReq.requestId = uuidv4();
  trackedReq.startTime = Date.now();

  // Extract request information
  const requestInfo = {
    requestId: trackedReq.requestId,
    method: req.method,
    path: req.path,
    query: sanitizeLogData(req.query),
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    referer: req.get('referer'),
    userId: (req as any).user?.userId
  };

  // Log incoming request
  logger.info('Incoming request', requestInfo);

  // Capture response
  const originalSend = res.send;
  let responseBody: any;

  res.send = function (data: any): Response {
    responseBody = data;
    return originalSend.call(this, data);
  };

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (trackedReq.startTime || 0);
    const responseSize = res.get('content-length') || 0;

    const responseInfo = {
      requestId: trackedReq.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: `${responseSize} bytes`,
      userId: (req as any).user?.userId
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Request failed with server error', {
        ...responseInfo,
        error: responseBody
      });
    } else if (res.statusCode >= 400) {
      logger.warn('Request failed with client error', responseInfo);
    } else {
      logger.info('Request completed', responseInfo);
    }

    // Log slow requests (> 3 seconds)
    if (duration > 3000) {
      logger.warn('Slow request detected', {
        ...responseInfo,
        threshold: '3000ms'
      });
    }
  });

  next();
};

/**
 * Error Logger Middleware
 * Logs errors with full context
 * 
 * @description
 * - Logs error details with request context
 * - Includes stack trace in development
 * - Sanitizes sensitive information
 */
export const errorLogger = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const trackedReq = req as TrackedRequest;

  const errorInfo = {
    requestId: trackedReq.requestId,
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
    userId: (req as any).user?.userId,
    ip: req.ip,
    body: sanitizeLogData(req.body)
  };

  logger.error('Request error', errorInfo);

  next(err);
};

/**
 * Authentication Event Logger
 * Logs authentication-related events
 * 
 * @description
 * - Logs successful and failed authentication attempts
 * - Tracks login/logout events
 * - Helps with security auditing
 */
export const logAuthEvent = (
  event: 'login' | 'logout' | 'token_refresh' | 'auth_failed',
  userId?: string,
  details?: Record<string, any>
): void => {
  logger.info('Authentication event', {
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * Booking Event Logger
 * Logs booking-related events for business analytics
 * 
 * @description
 * - Tracks booking lifecycle events
 * - Useful for business intelligence
 * - Helps identify booking patterns
 */
export const logBookingEvent = (
  event: 'created' | 'confirmed' | 'cancelled' | 'completed' | 'modified',
  bookingId: string,
  details?: Record<string, any>
): void => {
  logger.info('Booking event', {
    event,
    bookingId,
    timestamp: new Date().toISOString(),
    ...sanitizeLogData(details || {})
  });
};

/**
 * Payment Event Logger
 * Logs payment-related events for audit trail
 * 
 * @description
 * - Tracks all payment transactions
 * - Essential for financial auditing
 * - Helps with dispute resolution
 */
export const logPaymentEvent = (
  event: 'initiated' | 'succeeded' | 'failed' | 'refunded' | 'disputed',
  paymentId: string,
  amount: number,
  currency: string,
  details?: Record<string, any>
): void => {
  logger.info('Payment event', {
    event,
    paymentId,
    amount,
    currency,
    timestamp: new Date().toISOString(),
    ...sanitizeLogData(details || {})
  });
};

/**
 * Security Event Logger
 * Logs security-related events
 * 
 * @description
 * - Tracks suspicious activities
 * - Rate limit violations
 * - Invalid token attempts
 * - Helps with security monitoring
 */
export const logSecurityEvent = (
  event: 'rate_limit_exceeded' | 'invalid_token' | 'unauthorized_access' | 'suspicious_activity',
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any>
): void => {
  const logMethod = severity === 'critical' || severity === 'high' 
    ? logger.error 
    : logger.warn;

  logMethod('Security event', {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * External Service Logger
 * Logs interactions with external services
 * 
 * @description
 * - Tracks API calls to external services
 * - Stripe, Mercado Pago, Google Sheets, etc.
 * - Helps debug integration issues
 */
export const logExternalService = (
  service: 'stripe' | 'mercado_pago' | 'google_sheets' | 'whatsapp' | 'email',
  action: string,
  success: boolean,
  details?: Record<string, any>
): void => {
  const logMethod = success ? logger.info : logger.error;

  logMethod('External service call', {
    service,
    action,
    success,
    timestamp: new Date().toISOString(),
    ...sanitizeLogData(details || {})
  });
};

/**
 * Performance Logger
 * Logs performance metrics
 * 
 * @description
 * - Tracks slow operations
 * - Database query times
 * - External API call times
 * - Helps identify bottlenecks
 */
export const logPerformance = (
  operation: string,
  duration: number,
  threshold: number = 1000,
  details?: Record<string, any>
): void => {
  if (duration > threshold) {
    logger.warn('Slow operation detected', {
      operation,
      duration: `${duration}ms`,
      threshold: `${threshold}ms`,
      ...details
    });
  } else {
    logger.debug('Operation completed', {
      operation,
      duration: `${duration}ms`,
      ...details
    });
  }
};

/**
 * Sanitize Sensitive Data
 * Removes or masks sensitive information from logs
 * 
 * @description
 * - Removes passwords, tokens, card numbers
 * - Masks email addresses and phone numbers
 * - Ensures PCI compliance
 */
function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'apiKey',
    'secret',
    'cardNumber',
    'cvv',
    'pin',
    'ssn'
  ];

  const sanitized: any = Array.isArray(data) ? [] : {};

  for (const key in data) {
    const lowerKey = key.toLowerCase();

    // Remove completely sensitive fields
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Mask email addresses
    if (lowerKey.includes('email') && typeof data[key] === 'string') {
      const email = data[key];
      const [username, domain] = email.split('@');
      sanitized[key] = username.length > 2
        ? `${username.substring(0, 2)}***@${domain}`
        : `***@${domain}`;
      continue;
    }

    // Mask phone numbers
    if (lowerKey.includes('phone') && typeof data[key] === 'string') {
      const phone = data[key];
      sanitized[key] = phone.length > 4
        ? `***${phone.substring(phone.length - 4)}`
        : '***';
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof data[key] === 'object' && data[key] !== null) {
      sanitized[key] = sanitizeLogData(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }

  return sanitized;
}

/**
 * Database Query Logger
 * Logs database queries for debugging
 * 
 * @description
 * - Only enabled in development
 * - Helps debug slow queries
 * - Shows query parameters
 */
export const logDatabaseQuery = (
  query: string,
  params: any[],
  duration: number
): void => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Database query', {
      query,
      params: sanitizeLogData(params),
      duration: `${duration}ms`
    });

    // Warn about slow queries
    if (duration > 1000) {
      logger.warn('Slow database query', {
        query,
        duration: `${duration}ms`,
        threshold: '1000ms'
      });
    }
  }
};

/**
 * Cache Event Logger
 * Logs cache hits/misses for optimization
 * 
 * @description
 * - Tracks cache effectiveness
 * - Helps optimize caching strategy
 * - Identifies frequently accessed data
 */
export const logCacheEvent = (
  event: 'hit' | 'miss' | 'set' | 'delete' | 'clear',
  key: string,
  details?: Record<string, any>
): void => {
  logger.debug('Cache event', {
    event,
    key,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * Business Metrics Logger
 * Logs business-related metrics for analytics
 * 
 * @description
 * - Revenue tracking
 * - Conversion rates
 * - Booking patterns
 * - User behavior
 */
export const logBusinessMetric = (
  metric: string,
  value: number,
  unit: string,
  tags?: Record<string, any>
): void => {
  logger.info('Business metric', {
    metric,
    value,
    unit,
    timestamp: new Date().toISOString(),
    ...tags
  });
};

/**
 * Availability Check Logger
 * Logs availability searches for analytics
 * 
 * @description
 * - Tracks search patterns
 * - Identifies popular dates
 * - Helps with pricing strategy
 */
export const logAvailabilityCheck = (
  checkIn: Date,
  checkOut: Date,
  bedsCount: number,
  available: boolean,
  roomsFound?: number
): void => {
  logger.info('Availability check', {
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
    bedsCount,
    available,
    roomsFound,
    timestamp: new Date().toISOString()
  });
};

/**
 * Webhook Event Logger
 * Logs incoming webhook events
 * 
 * @description
 * - Tracks webhook deliveries
 * - Helps debug integration issues
 * - Ensures webhook reliability
 */
export const logWebhookEvent = (
  provider: 'stripe' | 'mercado_pago' | 'whatsapp',
  eventType: string,
  eventId: string,
  processed: boolean,
  error?: string
): void => {
  const logMethod = processed ? logger.info : logger.error;

  logMethod('Webhook event', {
    provider,
    eventType,
    eventId,
    processed,
    error,
    timestamp: new Date().toISOString()
  });
};

/**
 * Email Event Logger
 * Logs email sending events
 * 
 * @description
 * - Tracks email delivery
 * - Monitors email service health
 * - Helps with deliverability issues
 */
export const logEmailEvent = (
  event: 'sent' | 'failed' | 'bounced' | 'opened' | 'clicked',
  recipient: string,
  subject: string,
  details?: Record<string, any>
): void => {
  const logMethod = event === 'failed' || event === 'bounced' 
    ? logger.error 
    : logger.info;

  logMethod('Email event', {
    event,
    recipient: sanitizeLogData({ email: recipient }).email,
    subject,
    timestamp: new Date().toISOString(),
    ...details
  });
};

/**
 * System Health Logger
 * Logs system health metrics
 * 
 * @description
 * - Memory usage
 * - CPU usage
 * - Database connections
 * - Redis connections
 */
export const logSystemHealth = (
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    dbConnections: number;
    redisConnections: number;
    uptime: number;
  }
): void => {
  logger.info('System health', {
    ...metrics,
    timestamp: new Date().toISOString()
  });

  // Warn about high resource usage
  if (metrics.memoryUsage > 80) {
    logger.warn('High memory usage detected', {
      memoryUsage: `${metrics.memoryUsage}%`,
      threshold: '80%'
    });
  }

  if (metrics.cpuUsage > 80) {
    logger.warn('High CPU usage detected', {
      cpuUsage: `${metrics.cpuUsage}%`,
      threshold: '80%'
    });
  }
};

/**
 * Request ID Middleware
 * Adds request ID to all logs within the request scope
 * 
 * @description
 * - Enables request tracing
 * - Correlates logs across services
 * - Helps debug distributed systems
 */
export const addRequestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const trackedReq = req as TrackedRequest;
  
  if (!trackedReq.requestId) {
    trackedReq.requestId = uuidv4();
  }

  // Add request ID to response headers
  res.setHeader('X-Request-ID', trackedReq.requestId);

  next();
};

/**
 * Response Time Header Middleware
 * Adds response time to headers
 * 
 * @description
 * - Helps monitor API performance
 * - Client-side performance tracking
 * - Useful for debugging
 */
export const addResponseTime = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const trackedReq = req as TrackedRequest;
  trackedReq.startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - (trackedReq.startTime || 0);
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
};

/**
 * User Action Logger
 * Logs user actions for audit trail
 * 
 * @description
 * - Tracks user behavior
 * - Helps with support tickets
 * - Provides audit trail
 */
export const logUserAction = (
  userId: string,
  action: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, any>
): void => {
  logger.info('User action', {
    userId,
    action,
    resource,
    resourceId,
    timestamp: new Date().toISOString(),
    ...sanitizeLogData(details || {})
  });
};

/**
 * Admin Action Logger
 * Logs administrative actions for compliance
 * 
 * @description
 * - Tracks all admin operations
 * - Required for compliance
 * - Provides accountability
 */
export const logAdminAction = (
  adminId: string,
  action: string,
  target: string,
  before?: any,
  after?: any
): void => {
  logger.info('Admin action', {
    adminId,
    action,
    target,
    before: sanitizeLogData(before),
    after: sanitizeLogData(after),
    timestamp: new Date().toISOString()
  });
};

/**
 * Data Export Logger
 * Logs data export events for GDPR compliance
 * 
 * @description
 * - Tracks data exports
 * - Required for GDPR/LGPD
 * - Provides audit trail
 */
export const logDataExport = (
  userId: string,
  dataType: string,
  format: string,
  recordCount: number
): void => {
  logger.info('Data export', {
    userId,
    dataType,
    format,
    recordCount,
    timestamp: new Date().toISOString()
  });
};

/**
 * Cleanup Old Logs
 * Utility to clean up old log entries
 * 
 * @description
 * - Removes logs older than retention period
 * - Helps manage storage costs
 * - Maintains compliance requirements
 */
export const cleanupOldLogs = async (
  retentionDays: number = 90
): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    logger.info('Starting log cleanup', {
      retentionDays,
      cutoffDate: cutoffDate.toISOString()
    });

    // Implementation depends on log storage system
    // This is a placeholder for the actual cleanup logic

    logger.info('Log cleanup completed');
  } catch (error) {
    logger.error('Error cleaning up logs', { error });
    throw error;
  }
};
