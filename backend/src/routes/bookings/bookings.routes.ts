/**
 * File: lapa-casa-hostel/backend/src/routes/bookings/bookings.routes.ts
 * Bookings Routes Module
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles all booking-related endpoints including CRUD operations
 * Implements validation, error handling, and business logic routing
 * 
 * @module routes/bookings
 * @requires express
 */

import { Router } from 'express';
import QRCode from 'qrcode';
import { createBookingHandler } from './create-booking';
import { getBookingHandler } from './get-booking';
import { updateBookingHandler } from './update-booking';
import { cancelBookingHandler } from './cancel-booking';
import { validate, bookingSchemas } from '../../middleware/validation';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { bookingService } from '../../services/booking-service';
import type { BookingStatus } from '../../types/database';

const router = Router();

/**
 * Create New Booking
 * @route POST /bookings
 * @group Bookings - Booking management operations
 * @param {BookingCreateRequest.model} booking.body.required - Booking details
 * @returns {Booking.model} 201 - Created booking
 * @returns {Error} 400 - Validation error
 * @returns {Error} 409 - Availability conflict
 * @returns {Error} 500 - Server error
 */
router.post(
  '/',
  // H-01: usar el middleware real con el schema Zod — validationMiddleware era no-op
  validate(bookingSchemas.create),
  createBookingHandler
);

/**
 * Get Booking by ID
 * @route GET /bookings/:id
 * @group Bookings - Booking management operations
 * @param {string} id.path.required - Booking ID
 * @returns {Booking.model} 200 - Booking details
 * @returns {Error} 404 - Booking not found
 * @returns {Error} 500 - Server error
 */
router.get(
  '/:id',
  getBookingHandler
);

/**
 * Update Booking
 * @route PATCH /bookings/:id
 */
router.patch(
  '/:id',
  updateBookingHandler
);

/**
 * Cancel Booking
 * @route DELETE /bookings/:id
 */
router.delete(
  '/:id',
  cancelBookingHandler
);

/**
 * List All Bookings (Admin)
 * @route GET /bookings
 * @group Bookings - Booking management operations
 * @param {string} status.query - Filter by status
 * @param {string} checkInFrom.query - Filter check-in from date
 * @param {string} checkInTo.query - Filter check-in to date
 * @param {number} page.query - Page number (default: 1)
 * @param {number} limit.query - Items per page (default: 20)
 * @returns {Array.<Booking>} 200 - List of bookings
 * @returns {Error} 500 - Server error
 */
router.get(
  '/',
  // H-03: el listado completo incluye PII — solo accesible con token admin
  authenticateToken,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      logger.info('List bookings request', { query: req.query });

      const { status, checkInFrom, checkInTo, page, limit } = req.query;
      const result = await bookingService.listBookings({
        status: status as BookingStatus | undefined,
        dateFrom: checkInFrom as string | undefined,
        dateTo: checkInTo as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined
      });

      res.status(200).json({
        bookings: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Booking Confirmation Details
 * @route GET /bookings/:id/confirmation
 * @group Bookings - Booking management operations
 * @param {string} id.path.required - Booking ID
 * @returns {object} 200 - Confirmation details
 * @returns {Error} 404 - Booking not found
 * @returns {Error} 500 - Server error
 */
router.get(
  '/:id/confirmation',
  async (req, res, next) => {
    try {
      const { id } = req.params;
      logger.info('Get booking confirmation', { bookingId: id });

      const booking = await bookingService.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // L-02: QR generado localmente como data URI PNG — sin dependencia
      // externa ni envío del número de reserva a api.qrserver.com.
      const qrCode = await QRCode.toDataURL(booking.reservation_number, { width: 200 });

      res.status(200).json({
        bookingId: booking.id,
        confirmationNumber: booking.reservation_number,
        status: booking.status,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        qrCode,
        checkInInstructions: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro'
      });
    } catch (error) {
      next(error);
    }
  }
);

export const bookingsRouter = router;
