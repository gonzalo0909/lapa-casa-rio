// lapa-casa-hostel/backend/src/middleware/error-handler.ts

import type { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { ApiResponse } from '@/utils/responses';

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

  // Sección 8 auditoría 17 secciones: unificar formato de error -- antes
  // este handler devolvía {error,message,timestamp} (sin success:false),
  // distinto del {success:false,error,timestamp} que usan las ~30 rutas
  // vía ApiResponse.error(). Solo los 500 (errores no esperados) ocultan
  // el mensaje real en producción; un AppError 400/404/409/503 con
  // mensaje pensado para el usuario (ej. "Reserva no encontrada") se
  // muestra siempre, no solo fuera de producción.
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : error.message;

  res.status(statusCode).json(ApiResponse.error(message));
};
