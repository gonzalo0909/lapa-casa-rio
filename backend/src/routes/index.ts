/**
 * File: lapa-casa-hostel/backend/src/routes/index.ts
 * Main API Routes Index
 * Lapa Casa Hostel Channel Manager
 * 
 * Centralizes all API route modules and applies global middleware
 * Implements versioning, rate limiting, and security headers
 * 
 * @module routes/index
 * @requires express
 */

import { Router, Request, Response } from 'express';
import { bookingsRouter } from './bookings/bookings.routes';
import { availabilityRouter } from './availability/availability.routes';
import { paymentsRouter } from './payments/payments.routes';
import { roomsRouter } from './rooms/rooms.routes';
import { adminRouter } from './admin/admin.routes';
import { authMiddleware } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { logger } from '../utils/logger';

const router = Router();

/**
 * API Health Check Endpoint
 * @route GET /health
 * @returns {object} 200 - Server health status
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * API Information Endpoint
 * @route GET /info
 * @returns {object} 200 - API information
 */
router.get('/info', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'Lapa Casa Hostel API',
    version: '1.0.0',
    description: 'Channel Manager & Booking Engine API',
    endpoints: {
      bookings: '/api/v1/bookings',
      availability: '/api/v1/availability',
      payments: '/api/v1/payments',
      rooms: '/api/v1/rooms',
      admin: '/api/v1/admin'
    },
    documentation: '/api/docs',
    support: 'tech@lapacasahostel.com'
  });
});

/**
 * Public Routes (No Authentication Required)
 */
router.use('/availability', rateLimiter({ max: 100, windowMs: 60000 }), availabilityRouter);
router.use('/rooms', rateLimiter({ max: 100, windowMs: 60000 }), roomsRouter);

/**
 * Semi-Protected Routes (Rate Limited)
 */
router.use('/bookings', rateLimiter({ max: 50, windowMs: 60000 }), bookingsRouter);

/**
 * Payment Routes (Strict Rate Limiting)
 */
router.use('/payments', rateLimiter({ max: 30, windowMs: 60000 }), paymentsRouter);

/**
 * Admin Routes (Authentication Required)
 */
router.use('/admin', authMiddleware, rateLimiter({ max: 200, windowMs: 60000 }), adminRouter);

/**
 * Catch-all 404 Handler
 */
router.use('*', (req: Request, res: Response) => {
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

/**
 * Global Error Handler for Routes
 */
router.use((error: Error, req: Request, res: Response, next: Function) => {
  logger.error('Route Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message,
    timestamp: new Date().toISOString()
  });
});

export default router;
