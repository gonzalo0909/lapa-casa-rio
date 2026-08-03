// lapa-casa-hostel/backend/src/middleware/error-handler.ts
// ventana3

import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

export class AppError extends Error {
  constructor(message: string, public readonly statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Unhandled error:', {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  if (res.headersSent) {
    return next(error);
  }

  const statusCode = (error as any).statusCode || (error as any).status || 500;

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : error.message,
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected error occurred'
      : error.message,
    timestamp: new Date().toISOString(),
  });
};
