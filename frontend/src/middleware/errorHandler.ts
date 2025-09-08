import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let err = error;

  // Log del error
  logger.error('Error Handler:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Si no es nuestro AppError, crear uno genérico
  if (!(err instanceof AppError)) {
    err = new AppError('Internal Server Error', 500, false);
  }

  const appError = err as AppError;

  // Respuesta del error
  const errorResponse = {
    ok: false,
    error: appError.message,
    ...(config.nodeEnv === 'development' && { 
      stack: appError.stack,
      original: error.message 
    }),
  };

  res.status(appError.statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    ok: false,
    error: `Route ${req.originalUrl} not found`,
  });
};
