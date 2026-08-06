// lapa-casa-hostel/backend/src/middleware/validation.ts

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(error);
  }
};

export const validationMiddleware = (_schemaName: string) =>
  (_req: Request, _res: Response, next: NextFunction): void => next();

/**
 * Sanitizacion de inputs contra XSS/inyeccion de markup (Ventana 6,
 * entregable 6). Las queries a Postgres ya van parametrizadas ($1, $2...
 * via `pg`, ver config/database.ts) asi que no hay inyeccion SQL posible
 * desde aca -- esto cubre el otro vector real: texto de huesped
 * (guest.firstName/lastName, specialRequests, etc.) que termina
 * renderizado sin escapar en el panel admin (ver admin/js/*.js). Se
 * aplica en el body/query antes de que llegue a cualquier ruta, asi el
 * dato que se persiste en la base ya viene limpio.
 */
function sanitizeValue<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=\s*(["']).*?\1/gi, '') as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeValue(val);
    }
    return out as T;
  }
  return value;
}

export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
    const sanitizedQuery = sanitizeValue(req.query as Record<string, unknown>);
    for (const key of Object.keys(req.query)) delete (req.query as Record<string, unknown>)[key];
    Object.assign(req.query as Record<string, unknown>, sanitizedQuery);
  }
  next();
};

export const bookingSchemas = {
  create: z.object({
    checkIn: z.string().min(1),
    checkOut: z.string().min(1),
    rooms: z.array(z.object({
      roomId: z.string().min(1),
      bedsCount: z.number().int().positive(),
    })).min(1),
    guest: z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      country: z.string().optional(),
    }),
    specialRequests: z.string().optional(),
    language: z.enum(['pt', 'en', 'es']).optional(),
  }),
};
