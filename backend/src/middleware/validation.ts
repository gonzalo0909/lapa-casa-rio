// lapa-casa-hostel/backend/src/middleware/validation.ts

import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema } from 'zod';

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

/**
 * Sanitizacion de inputs contra XSS/inyeccion de markup (
 * entregable 6). Las queries a Postgres ya van parametrizadas ($1, $2...
 * via `pg`, ver config/database.ts) asi que no hay inyeccion SQL posible
 * desde aca -- esto cubre el otro vector real: texto de huesped
 * (guest.firstName/lastName, specialRequests, etc.) que termina
 * renderizado sin escapar en el panel admin (ver admin/js/*.js). Se
 * aplica en el body/query antes de que llegue a cualquier ruta, asi el
 * dato que se persiste en la base ya viene limpio.
 */
// Data URLs (fotos en base64: documento de identidad, etc.) no se
// renderizan nunca como HTML -- van a decodeBase64Image()/Cloudinary, no
// al panel admin -- así que sanitizarlas no aporta nada y sí sale caro:
// son strings de cientos de miles de caracteres y la regex on\w+=... de
// abajo es propensa a backtracking catastrófico en textos así de largos,
// al punto de colgar el pedido. Se dejan pasar tal cual.
const DATA_URL = /^data:[\w/+.-]+;base64,/;

function sanitizeValue<T>(value: T): T {
  if (typeof value === 'string') {
    if (DATA_URL.test(value)) {return value;}
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
    for (const key of Object.keys(req.query)) {delete (req.query as Record<string, unknown>)[key];}
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
  update: z.object({
    checkIn: z.string().min(1).optional(),
    checkOut: z.string().min(1).optional(),
    rooms: z.array(z.object({
      roomId: z.string().min(1),
      bedsCount: z.number().int().positive(),
    })).optional(),
    guest: z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
    specialRequests: z.string().optional(),
  }),
};
