/**
 * File: lapa-casa-hostel/backend/src/routes/bookings/get-booking.ts
 * Get Booking Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Retrieves booking details with full payment history and status
 * Includes guest information, room assignments, and pricing breakdown
 * 
 * @module routes/bookings/get
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../../services/booking-service';
import { PaymentService } from '../../services/payment-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const bookingService = new BookingService();
const paymentService = new PaymentService();

/**
 * Get Booking Handler
 * 
 * Retrieves complete booking information including:
 * - Booking details and status
 * - Guest information
 * - Room assignments
 * - Pricing breakdown
 * - Payment history
 * - Cancellation policy
 * 
 * @param {Request} req - Express request object with booking ID in params
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getBookingHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Fetching booking', { bookingId: id });

    // Fetch booking from database
    const booking = await bookingService.getBookingById(id);

    if (!booking) {
      logger.warn('Booking not found', { bookingId: id });
      res.status(404).json(
        ApiResponse.error('Booking not found', {
          bookingId: id
        })
      );
      return;
    }

    // Fetch payment history
    const payments = await paymentService.getPaymentsByBookingId(id);

    // Calculate payment summary
    const paidAmount = payments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingAmount = payments
      .filter(p => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.amount, 0);

    const refundedAmount = payments
      .filter(p => p.status === 'REFUNDED')
      .reduce((sum, p) => sum + p.amount, 0);

    // Calculate days until check-in
    const checkInDate = new Date(booking.checkIn);
    const now = new Date();
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine cancellation policy
    const cancellationPolicy = getCancellationPolicy(
      booking.status,
      daysUntilCheckIn,
      paidAmount
    );

    // Format response
    const response = {
      booking: {
        id: booking.id,
        confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
        status: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
      },
      dates: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        daysUntilCheckIn
      },
      guest: {
        firstName: booking.guest.firstName,
        lastName: booking.guest.lastName,
        email: booking.guest.email,
        phone: booking.guest.phone,
        country: booking.guest.country,
        document: booking.guest.document
      },
      rooms: booking.rooms.map(room => ({
        roomId: room.roomId,
        roomName: room.roomName,
        bedsCount: room.bedsCount,
        type: room.type,
        isFlexible: room.isFlexible
      })),
      pricing: {
        subtotal: booking.pricing.subtotal,
        groupDiscount: booking.pricing.groupDiscount,
        groupDiscountPercentage: booking.pricing.groupDiscountPercentage,
        seasonalAdjustment: booking.pricing.seasonalAdjustment,
        seasonalMultiplier: booking.pricing.seasonalMultiplier,
        total: booking.pricing.total,
        deposit: booking.pricing.deposit,
        remaining: booking.pricing.remaining,
        currency: 'BRL'
      },
      payment: {
        paidAmount,
        pendingAmount,
        refundedAmount,
        remainingBalance: booking.pricing.total - paidAmount,
        depositPaid: paidAmount >= booking.pricing.deposit,
        fullyPaid: paidAmount >= booking.pricing.total,
        paymentHistory: payments.map(p => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          method: p.method,
          provider: p.provider,
          transactionId: p.transactionId,
          createdAt: p.createdAt,
          paidAt: p.paidAt
        }))
      },
      cancellation: cancellationPolicy,
      specialRequests: booking.specialRequests,
      source: booking.source,
      language: booking.language,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${booking.id}`,
      checkInInstructions: {
        address: 'Rua Silvio Romero 22, Santa Teresa',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '20241-110',
        country: 'Brazil',
        coordinates: {
          lat: -22.9219,
          lng: -43.1904
        },
        instructions: booking.language === 'pt'
          ? 'Check-in: 14h - Check-out: 11h. Em caso de dúvidas, contate-nos via WhatsApp.'
          : booking.language === 'es'
          ? 'Check-in: 14h - Check-out: 11h. Si tiene dudas, contáctenos por WhatsApp.'
          : 'Check-in: 2pm - Check-out: 11am. For questions, contact us via WhatsApp.',
        whatsapp: '+55 21 99999-9999'
      }
    };

    logger.info('Booking retrieved successfully', {
      bookingId: id,
      status: booking.status
    });

    res.status(200).json(
      ApiResponse.success(response, 'Booking retrieved successfully')
    );

  } catch (error) {
    logger.error('Error retrieving booking', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Calculate Cancellation Policy
 * 
 * Determines refund eligibility based on:
 * - Current booking status
 * - Days remaining until check-in
 * - Amount already paid
 * 
 * @param {string} status - Current booking status
 * @param {number} daysUntilCheckIn - Days until check-in
 * @param {number} paidAmount - Total amount paid
 * @returns {object} Cancellation policy details
 */
function getCancellationPolicy(
  status: string,
  daysUntilCheckIn: number,
  paidAmount: number
): {
  canCancel: boolean;
  refundPercentage: number;
  refundAmount: number;
  deadline: string | null;
  reason?: string;
} {
  // Cannot cancel if already cancelled or completed
  if (status === 'CANCELLED') {
    return {
      canCancel: false,
      refundPercentage: 0,
      refundAmount: 0,
      deadline: null,
      reason: 'Booking already cancelled'
    };
  }

  if (status === 'COMPLETED') {
    return {
      canCancel: false,
      refundPercentage: 0,
      refundAmount: 0,
      deadline: null,
      reason: 'Booking already completed'
    };
  }

  // Check-in already passed
  if (daysUntilCheckIn < 0) {
    return {
      canCancel: false,
      refundPercentage: 0,
      refundAmount: 0,
      deadline: null,
      reason: 'Check-in date has passed'
    };
  }

  // Full refund if more than 30 days
  if (daysUntilCheckIn > 30) {
    return {
      canCancel: true,
      refundPercentage: 100,
      refundAmount: paidAmount,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // 50% refund if 15-30 days
  if (daysUntilCheckIn > 15) {
    return {
      canCancel: true,
      refundPercentage: 50,
      refundAmount: paidAmount * 0.5,
      deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // No refund if less than 15 days
  return {
    canCancel: true,
    refundPercentage: 0,
    refundAmount: 0,
    deadline: null,
    reason: 'No refund available within 15 days of check-in'
  };
}
