// lapa-casa-hostel/backend/src/utils/responses.ts

import { Response } from 'express';

/**
 * Standard API Response Interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  meta?: ResponseMeta;
  timestamp: string;
}

/**
 * Response Metadata Interface
 */
export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

/**
 * Pagination Parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
}

/**
 * Success Response Helper
 * Sends a standardized success response
 * 
 * @param res - Express response object
 * @param data - Data to send
 * @param message - Optional success message
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Optional metadata
 */
export const successResponse = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: ResponseMeta
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
};

/**
 * Error Response Helper
 * Sends a standardized error response
 * 
 * @param res - Express response object
 * @param error - Error message
 * @param statusCode - HTTP status code (default: 500)
 * @param code - Error code
 * @param details - Additional error details
 */
export const errorResponse = (
  res: Response,
  error: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): void => {
  const response: ApiResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString()
  };

  if (code) {
    response.code = code;
  }

  if (details) {
    response.data = details;
  }

  res.status(statusCode).json(response);
};

/**
 * Created Response (201)
 * For successful resource creation
 */
export const createdResponse = <T>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully'
): void => {
  successResponse(res, data, message, 201);
};

/**
 * No Content Response (204)
 * For successful operations with no data to return
 */
export const noContentResponse = (res: Response): void => {
  res.status(204).send();
};

/**
 * Paginated Response
 * For list endpoints with pagination
 * 
 * @param res - Express response object
 * @param data - Array of items
 * @param pagination - Pagination parameters
 * @param message - Optional message
 */
export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  pagination: PaginationParams,
  message?: string
): void => {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  const meta: ResponseMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };

  successResponse(res, data, message, 200, meta);
};

/**
 * Booking Response Helpers
 */
export const bookingResponses = {
  created: (res: Response, booking: any): void => {
    createdResponse(res, booking, 'Booking created successfully');
  },

  confirmed: (res: Response, booking: any): void => {
    successResponse(res, booking, 'Booking confirmed successfully');
  },

  cancelled: (res: Response, booking: any): void => {
    successResponse(res, booking, 'Booking cancelled successfully');
  },

  notFound: (res: Response): void => {
    errorResponse(res, 'Booking not found', 404, 'BOOKING_NOT_FOUND');
  },

  alreadyConfirmed: (res: Response): void => {
    errorResponse(
      res,
      'Booking already confirmed',
      400,
      'BOOKING_ALREADY_CONFIRMED'
    );
  },

  cannotCancel: (res: Response, reason: string): void => {
    errorResponse(
      res,
      `Cannot cancel booking: ${reason}`,
      400,
      'BOOKING_CANNOT_CANCEL'
    );
  }
};

/**
 * Payment Response Helpers
 */
export const paymentResponses = {
  intentCreated: (res: Response, intent: any): void => {
    createdResponse(res, intent, 'Payment intent created successfully');
  },

  succeeded: (res: Response, payment: any): void => {
    successResponse(res, payment, 'Payment processed successfully');
  },

  failed: (res: Response, reason: string): void => {
    errorResponse(
      res,
      `Payment failed: ${reason}`,
      402,
      'PAYMENT_FAILED'
    );
  },

  invalidAmount: (res: Response): void => {
    errorResponse(
      res,
      'Invalid payment amount',
      400,
      'PAYMENT_INVALID_AMOUNT'
    );
  },

  alreadyPaid: (res: Response): void => {
    errorResponse(
      res,
      'Payment already processed',
      400,
      'PAYMENT_ALREADY_PROCESSED'
    );
  }
};

/**
 * Availability Response Helpers
 */
export const availabilityResponses = {
  available: (res: Response, rooms: any[]): void => {
    successResponse(
      res,
      { available: true, rooms },
      'Rooms available for selected dates'
    );
  },

  notAvailable: (res: Response): void => {
    successResponse(
      res,
      { available: false, rooms: [] },
      'No rooms available for selected dates'
    );
  },

  invalidDates: (res: Response): void => {
    errorResponse(
      res,
      'Invalid date range',
      400,
      'AVAILABILITY_INVALID_DATES'
    );
  }
};

/**
 * Authentication Response Helpers
 */
export const authResponses = {
  loginSuccess: (res: Response, token: string, user: any): void => {
    successResponse(
      res,
      { token, user },
      'Login successful'
    );
  },

  loginFailed: (res: Response): void => {
    errorResponse(
      res,
      'Invalid credentials',
      401,
      'AUTH_INVALID_CREDENTIALS'
    );
  },

  tokenExpired: (res: Response): void => {
    errorResponse(
      res,
      'Token expired',
      401,
      'AUTH_TOKEN_EXPIRED'
    );
  },

  unauthorized: (res: Response): void => {
    errorResponse(
      res,
      'Unauthorized access',
      401,
      'AUTH_UNAUTHORIZED'
    );
  },

  forbidden: (res: Response): void => {
    errorResponse(
      res,
      'Insufficient permissions',
      403,
      'AUTH_FORBIDDEN'
    );
  }
};

/**
 * Validation Response Helpers
 */
export const validationResponses = {
  failed: (res: Response, errors: any[]): void => {
    errorResponse(
      res,
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      { errors }
    );
  },

  invalidField: (res: Response, field: string, message: string): void => {
    errorResponse(
      res,
      `Invalid ${field}: ${message}`,
      400,
      'VALIDATION_INVALID_FIELD',
      { field, message }
    );
  }
};

/**
 * Rate Limit Response
 */
export const rateLimitResponse = (res: Response, retryAfter?: number): void => {
  const response: ApiResponse = {
    success: false,
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  };

  if (retryAfter) {
    response.data = { retryAfter };
  }

  res.status(429).json(response);
};

/**
 * Not Found Response
 */
export const notFoundResponse = (res: Response, resource: string = 'Resource'): void => {
  errorResponse(
    res,
    `${resource} not found`,
    404,
    'NOT_FOUND'
  );
};

/**
 * Internal Server Error Response
 */
export const serverErrorResponse = (res: Response, message: string = 'Internal server error'): void => {
  errorResponse(
    res,
    message,
    500,
    'INTERNAL_ERROR'
  );
};

/**
 * Bad Request Response
 */
export const badRequestResponse = (res: Response, message: string): void => {
  errorResponse(
    res,
    message,
    400,
    'BAD_REQUEST'
  );
};

/**
 * Conflict Response
 */
export const conflictResponse = (res: Response, message: string): void => {
  errorResponse(
    res,
    message,
    409,
    'CONFLICT'
  );
};

/**
 * Service Unavailable Response
 */
export const serviceUnavailableResponse = (res: Response, service: string): void => {
  errorResponse(
    res,
    `${service} service unavailable`,
    503,
    'SERVICE_UNAVAILABLE'
  );
};

/**
 * Maintenance Mode Response
 */
export const maintenanceResponse = (res: Response): void => {
  errorResponse(
    res,
    'System under maintenance',
    503,
    'MAINTENANCE_MODE'
  );
};

/**
 * Health Check Response
 */
export const healthCheckResponse = (
  res: Response,
  status: 'healthy' | 'degraded' | 'unhealthy',
  checks: Record<string, boolean>
): void => {
  const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

  successResponse(
    res,
    {
      status,
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    undefined,
    statusCode
  );
};
