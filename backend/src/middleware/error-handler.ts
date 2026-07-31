// lapa-casa-hostel/backend/src/middleware/error-handler.ts

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Custom Application Error Class
 */
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common Application Errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 402, 'PAYMENT_ERROR', true, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`${service} error: ${message}`, 503, 'EXTERNAL_SERVICE_ERROR');
  }
}

/**
 * Error Response Interface
 */
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  statusCode: number;
  details?: any;
  stack?: string;
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Main Error Handler Middleware
 * Centralized error handling for all application errors
 * 
 * @description
 * - Handles custom AppError instances
 * - Transforms Prisma errors
 * - Transforms Zod validation errors
 * - Logs errors appropriately
 * - Returns consistent error responses
 * - Hides sensitive information in production
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Default error values
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;

    // Log operational errors as warnings
    if (err.isOperational) {
      logger.warn(`Operational error: ${message}`, {
        code,
        statusCode,
        path: req.path,
        method: req.method
      });
    } else {
      logger.error(`Application error: ${message}`, {
        code,
        statusCode,
        stack: err.stack
      });
    }
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = err.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code
    }));

    logger.warn('Zod validation error', { details });
  }
  // Handle Prisma errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(err);
    statusCode = prismaError.statusCode;
    code = prismaError.code;
    message = prismaError.message;
    details = prismaError.details;

    logger.error('Prisma error', { code: err.code, meta: err.meta });
  }
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    code = 'DATABASE_VALIDATION_ERROR';
    message = 'Invalid database operation';

    logger.error('Prisma validation error', { error: err.message });
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';

    logger.warn('JWT error', { error: err.message });
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';

    logger.warn('Token expired');
  }
  // Handle generic errors
  else {
    logger.error('Unhandled error', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: message,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Add details if available
  if (details) {
    errorResponse.details = details;
  }

  // Add stack trace in development
  if (!isProduction && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(err: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  code: string;
  message: string;
  details?: any;
} {
  switch (err.code) {
    case 'P2002': // Unique constraint violation
      return {
        statusCode: 409,
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists',
        details: {
          fields: err.meta?.target
        }
      };

    case 'P2025': // Record not found
      return {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Record not found'
      };

    case 'P2003': // Foreign key constraint failed
      return {
        statusCode: 400,
        code: 'INVALID_REFERENCE',
        message: 'Referenced record does not exist',
        details: {
          field: err.meta?.field_name
        }
      };

    case 'P2014': // Invalid ID
      return {
        statusCode: 400,
        code: 'INVALID_ID',
        message: 'Invalid identifier provided'
      };

    case 'P2011': // Null constraint violation
      return {
        statusCode: 400,
        code: 'NULL_CONSTRAINT',
        message: 'Required field is missing',
        details: {
          field: err.meta?.target
        }
      };

    default:
      return {
        statusCode: 500,
        code: 'DATABASE_ERROR',
        message: 'Database operation failed'
      };
  }
}

/**
 * Not Found Handler (404)
 * Catches all requests that don't match any route
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors
 * 
 * @example
 * router.get('/bookings', asyncHandler(async (req, res) => {
 *   const bookings = await getBookings();
 *   res.json(bookings);
 * }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Unhandled Rejection Handler
 * Catches unhandled promise rejections
 */
export const handleUnhandledRejection = (): void => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack
    });

    // In production, might want to gracefully shutdown
    if (process.env.NODE_ENV === 'production') {
      logger.error('Server shutting down due to unhandled rejection');
      process.exit(1);
    }
  });
};

/**
 * Uncaught Exception Handler
 * Catches uncaught exceptions
 */
export const handleUncaughtException = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack
    });

    // Always exit on uncaught exceptions
    logger.error('Server shutting down due to uncaught exception');
    process.exit(1);
  });
};
