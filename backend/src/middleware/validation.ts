// lapa-casa-hostel/backend/src/middleware/validation.ts

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger';

/**
 * Validation Target Type
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Generic Validation Middleware Factory
 * 
 * @param schema - Zod schema to validate against
 * @param target - Which part of request to validate (body/query/params)
 * @returns Middleware function that validates and attaches parsed data
 * 
 * @example
 * const createBookingSchema = z.object({
 *   roomId: z.string(),
 *   checkIn: z.string().datetime(),
 *   bedsCount: z.number().min(1)
 * });
 * 
 * router.post('/bookings', 
 *   validate(createBookingSchema, 'body'), 
 *   createBooking
 * );
 */
export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dataToValidate = req[target];

      // Parse and validate data
      const parsed = await schema.parseAsync(dataToValidate);

      // Attach validated data to request
      req[target] = parsed;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        logger.warn('Validation error:', { errors: formattedErrors, target });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: formattedErrors
        });
        return;
      }

      logger.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR'
      });
    }
  };
};

/**
 * Common Validation Schemas
 */

// Booking validation schemas
export const bookingSchemas = {
  create: z.object({
    roomId: z.string().min(1, 'Room ID is required'),
    checkInDate: z.string().datetime('Invalid check-in date format'),
    checkOutDate: z.string().datetime('Invalid check-out date format'),
    bedsCount: z.number().int().min(1, 'At least 1 bed required').max(45, 'Maximum 45 beds'),
    guestName: z.string().min(2, 'Guest name must be at least 2 characters'),
    guestEmail: z.string().email('Invalid email format'),
    guestPhone: z.string().min(8, 'Invalid phone number').optional(),
    guestCountry: z.string().length(2, 'Country code must be 2 letters').default('BR'),
    specialRequests: z.string().max(500, 'Special requests too long').optional(),
    agreeTerms: z.boolean().refine(val => val === true, 'Must agree to terms')
  }).refine(
    data => new Date(data.checkOutDate) > new Date(data.checkInDate),
    { message: 'Check-out must be after check-in', path: ['checkOutDate'] }
  ),

  update: z.object({
    checkInDate: z.string().datetime().optional(),
    checkOutDate: z.string().datetime().optional(),
    bedsCount: z.number().int().min(1).max(45).optional(),
    guestPhone: z.string().min(8).optional(),
    specialRequests: z.string().max(500).optional()
  }),

  cancel: z.object({
    reason: z.string().min(5, 'Cancellation reason required').max(200),
    refundRequested: z.boolean().default(true)
  })
};

// Payment validation schemas
export const paymentSchemas = {
  createIntent: z.object({
    bookingId: z.string().min(1, 'Booking ID required'),
    amount: z.number().positive('Amount must be positive'),
    currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
    paymentMethod: z.enum(['stripe', 'mercado_pago']),
    saveCard: z.boolean().optional().default(false)
  }),

  confirmPayment: z.object({
    paymentIntentId: z.string().min(1, 'Payment intent ID required'),
    paymentMethodId: z.string().optional()
  }),

  processDeposit: z.object({
    bookingId: z.string().min(1, 'Booking ID required'),
    paymentMethod: z.enum(['stripe', 'mercado_pago', 'pix']),
    installments: z.number().int().min(1).max(12).optional().default(1)
  }),

  webhook: z.object({
    type: z.string(),
    data: z.record(z.any())
  })
};

// Availability validation schemas
export const availabilitySchemas = {
  check: z.object({
    checkInDate: z.string().datetime('Invalid check-in date'),
    checkOutDate: z.string().datetime('Invalid check-out date'),
    bedsCount: z.number().int().min(1).max(45),
    roomType: z.enum(['mixed', 'female', 'any']).optional().default('any')
  }).refine(
    data => {
      const checkIn = new Date(data.checkInDate);
      const checkOut = new Date(data.checkOutDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return checkIn >= today;
    },
    { message: 'Check-in date cannot be in the past', path: ['checkInDate'] }
  ).refine(
    data => new Date(data.checkOutDate) > new Date(data.checkInDate),
    { message: 'Check-out must be after check-in', path: ['checkOutDate'] }
  ),

  roomAvailability: z.object({
    roomId: z.string().min(1, 'Room ID required'),
    startDate: z.string().datetime('Invalid start date'),
    endDate: z.string().datetime('Invalid end date')
  })
};

// Room validation schemas
export const roomSchemas = {
  list: z.object({
    type: z.enum(['mixed', 'female', 'all']).optional().default('all'),
    available: z.boolean().optional(),
    sortBy: z.enum(['name', 'capacity', 'price']).optional().default('name')
  }),

  getById: z.object({
    roomId: z.string().min(1, 'Room ID required')
  }),

  update: z.object({
    name: z.string().min(2).optional(),
    capacity: z.number().int().min(1).max(20).optional(),
    basePrice: z.number().positive().optional(),
    isFlexible: z.boolean().optional(),
    roomType: z.enum(['mixed', 'female']).optional()
  })
};

// Admin validation schemas
export const adminSchemas = {
  updateSettings: z.object({
    depositPercentage: z.number().min(0).max(1).optional(),
    autoChargeDate: z.number().int().min(1).max(30).optional(),
    carnivalMinNights: z.number().int().min(1).max(14).optional(),
    flexibleRoomAutoConvert: z.number().int().min(12).max(168).optional()
  }),

  getBookings: z.object({
    status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'all']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().min(10).max(100).optional().default(20)
  })
};

/**
 * Date Range Validator
 * Ensures check-in is before check-out and dates are valid
 */
export const validateDateRange = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { checkInDate, checkOutDate } = req.body;

    if (!checkInDate || !checkOutDate) {
      res.status(400).json({
        success: false,
        error: 'Check-in and check-out dates are required',
        code: 'DATES_REQUIRED'
      });
      return;
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format',
        code: 'INVALID_DATE_FORMAT'
      });
      return;
    }

    if (checkIn < today) {
      res.status(400).json({
        success: false,
        error: 'Check-in date cannot be in the past',
        code: 'PAST_DATE'
      });
      return;
    }

    if (checkOut <= checkIn) {
      res.status(400).json({
        success: false,
        error: 'Check-out must be after check-in',
        code: 'INVALID_DATE_RANGE'
      });
      return;
    }

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    if (nights > 90) {
      res.status(400).json({
        success: false,
        error: 'Maximum stay is 90 nights',
        code: 'STAY_TOO_LONG'
      });
      return;
    }

    // Attach calculated nights to request
    req.body.nights = nights;

    next();
  } catch (error) {
    logger.error('Date range validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Date validation error',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * Sanitize Input Middleware
 * Removes potentially dangerous characters and trims strings
 */
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj
          .trim()
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
        return sanitized;
      }

      return obj;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);

    next();
  } catch (error) {
    logger.error('Sanitization error:', error);
    next();
  }
};

/**
 * File Upload Validation
 * Validates uploaded files (if needed for future features)
 */
export const validateFileUpload = (
  allowedTypes: string[],
  maxSizeBytes: number
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.file && !req.files) {
        next();
        return;
      }

      const files = req.files 
        ? Array.isArray(req.files) 
          ? req.files 
          : Object.values(req.files).flat()
        : [req.file];

      for (const file of files) {
        if (!file) continue;

        // Check file type
        if (!allowedTypes.includes(file.mimetype)) {
          res.status(400).json({
            success: false,
            error: `File type ${file.mimetype} not allowed`,
            code: 'INVALID_FILE_TYPE',
            allowedTypes
          });
          return;
        }

        // Check file size
        if (file.size > maxSizeBytes) {
          res.status(400).json({
            success: false,
            error: 'File size exceeds limit',
            code: 'FILE_TOO_LARGE',
            maxSize: `${maxSizeBytes / 1024 / 1024}MB`
          });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('File validation error:', error);
      res.status(500).json({
        success: false,
        error: 'File validation error',
        code: 'VALIDATION_ERROR'
      });
    }
  };
};
