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
