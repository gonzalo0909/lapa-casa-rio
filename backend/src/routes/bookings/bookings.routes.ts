/**
 * File: lapa-casa-hostel/backend/src/routes/bookings/bookings.routes.ts
 * Bookings Routes Module
 * Lapa Casa Channel Manager
 * 
 * Handles all booking-related endpoints including CRUD operations
 * Implements validation, error handling, and business logic routing
 * 
 * @module routes/bookings
 * @requires express
 */

import { Router } from 'express';
import QRCode from 'qrcode';
import { createHostelBookingHandler } from './create-hostel-booking';
import { getBookingHandler } from './get-booking';
import { updateBookingHandler } from './update-booking';
import { cancelBookingHandler } from './cancel-booking';
import { validate, bookingSchemas } from '../../middleware/validation';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { bookingService } from '../../services/booking-service';
import { paymentService } from '../../services/payment-service';
import type { BookingStatus } from '../../types/database';
import { ApiResponse } from '../../utils/responses';
import { generateConfirmationToken } from '../../utils/confirmation-token';

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
  createHostelBookingHandler
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
  authenticateToken,
  requireRole(['admin', 'staff']),
  getBookingHandler
);

/**
 * Update Booking
 * @route PATCH /bookings/:id
 */
router.patch(
  '/:id',
  authenticateToken,
  requireRole(['admin', 'staff']),
  validate(bookingSchemas.update),
  updateBookingHandler
);

/**
 * Cancel Booking
 * @route DELETE /bookings/:id
 */
router.delete(
  '/:id',
  authenticateToken,
  requireRole(['admin', 'staff']),
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

      res.status(200).json(ApiResponse.success({
        bookings: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      }));
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
      const { token } = req.query as { token?: string };

      if (!token || token !== generateConfirmationToken(id)) {
        return res.status(403).json(ApiResponse.error('Invalid or missing confirmation token'));
      }

      logger.info('Get booking confirmation', { bookingId: id });

      const booking = await bookingService.getBooking(id);
      if (!booking) {
        return res.status(404).json(ApiResponse.error('Booking not found'));
      }

      const checkInDate = new Date(booking.check_in_date);
      const checkOutDate = new Date(booking.check_out_date);
      const nights = Math.round(
        (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const payments = await paymentService.getPaymentsByReservation(id);
      const paidAmount = payments
        .filter(p => p.status === 'succeeded')
        .reduce((sum, p) => {
          const baseAmount = (p.provider_metadata as { base_amount?: number } | null)?.base_amount;
          return sum + (baseAmount ?? Number(p.amount));
        }, 0);
      const depositAmount = Number(booking.deposit_amount);
      const finalPrice = Number(booking.final_price);

      // L-02: QR generado localmente como data URI PNG.
      const qrCode = await QRCode.toDataURL(booking.reservation_number, { width: 200 });

      res.status(200).json(ApiResponse.success({
        booking: {
          id: booking.id,
          confirmationNumber: booking.reservation_number,
          status: booking.status,
          pendingExpiresAt: booking.pending_expires_at,
        },
        dates: {
          checkIn: booking.check_in_date,
          checkOut: booking.check_out_date,
          nights,
        },
        guest: {
          fullName: booking.guest?.full_name ?? '',
        },
        pricing: {
          total: finalPrice,
          deposit: depositAmount,
          remaining: Number(booking.remaining_amount),
          bedsCount: booking.beds_count,
          currency: 'BRL',
        },
        payment: {
          depositPaid: paidAmount >= depositAmount,
          fullyPaid: paidAmount >= finalPrice,
        },
        qrCode,
        checkInInstructions: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro',
      }));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Abandon a pending_payment booking
 * @route POST /bookings/:id/abandon
 * Guest-callable: verified via confirmationToken, only on pending_payment status.
 * No refund processing — no payment has been made at this point.
 */
router.post(
  '/:id/abandon',
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { token } = req.body as { token?: string };

      if (!token || token !== generateConfirmationToken(id)) {
        return res.status(403).json(ApiResponse.error('Invalid or missing confirmation token'));
      }

      const booking = await bookingService.getBooking(id);
      if (!booking) {
        return res.status(404).json(ApiResponse.error('Booking not found'));
      }

      if (booking.status !== 'pending_payment') {
        return res.status(400).json(
          ApiResponse.error('Only pending_payment bookings can be abandoned')
        );
      }

      await bookingService.cancelBooking(id, 'abandoned_by_guest');

      logger.info('Booking abandoned by guest', { bookingId: id });
      res.status(200).json(ApiResponse.success({ bookingId: id }, 'Booking abandoned'));
    } catch (error) {
      next(error);
    }
  }
);

export const bookingsRouter = router;
