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
import { createBookingHandler } from './create-booking';
import { getBookingHandler } from './get-booking';
import { updateBookingHandler } from './update-booking';
import { cancelBookingHandler } from './cancel-booking';
import { validationMiddleware } from '../../middleware/validation';
import { logger } from '../../utils/logger';

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
  validationMiddleware('createBooking'),
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
  validationMiddleware('getBooking'),
  getBookingHandler
);

/**
 * Update Booking
 * @route PATCH /bookings/:id
 * @group Bookings - Booking management operations
 * @param {string} id.path.required - Booking ID
 * @param {BookingUpdateRequest.model} booking.body.required - Updated booking details
 * @returns {Booking.model} 200 - Updated booking
 * @returns {Error} 400 - Validation error
 * @returns {Error} 404 - Booking not found
 * @returns {Error} 409 - Update conflict
 * @returns {Error} 500 - Server error
 */
router.patch(
  '/:id',
  validationMiddleware('updateBooking'),
  updateBookingHandler
);

/**
 * Cancel Booking
 * @route DELETE /bookings/:id
 * @group Bookings - Booking management operations
 * @param {string} id.path.required - Booking ID
 * @param {string} reason.query - Cancellation reason
 * @returns {object} 200 - Cancellation confirmation
 * @returns {Error} 404 - Booking not found
 * @returns {Error} 409 - Cannot cancel (payment issues)
 * @returns {Error} 500 - Server error
 */
router.delete(
  '/:id',
  validationMiddleware('cancelBooking'),
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
  validationMiddleware('listBookings'),
  async (req, res, next) => {
    try {
      logger.info('List bookings request', { query: req.query });
      
      // This would typically call a service method
      res.status(200).json({
        bookings: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
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
  validationMiddleware('getBooking'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      logger.info('Get booking confirmation', { bookingId: id });
      
      // This would typically call a service method
      res.status(200).json({
        bookingId: id,
        confirmationNumber: `LCH-${id.substring(0, 8).toUpperCase()}`,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${id}`,
        checkInInstructions: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro'
      });
    } catch (error) {
      next(error);
    }
  }
);

export const bookingsRouter = router;
