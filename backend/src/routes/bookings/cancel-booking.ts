/**
 * File: lapa-casa-hostel/backend/src/routes/bookings/cancel-booking.ts
 * Cancel Booking Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles booking cancellation with refund calculation
 * Processes refunds based on cancellation policy and timing
 * 
 * @module routes/bookings/cancel
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../../services/booking-service';
import { PaymentService } from '../../services/payment-service';
import { EmailService } from '../../services/email-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const bookingService = new BookingService();
const paymentService = new PaymentService();
const emailService = new EmailService();

/**
 * Cancel Booking Handler
 * 
 * Cancellation flow:
 * 1. Validate booking exists and is cancellable
 * 2. Calculate refund amount based on policy
 * 3. Process refund if applicable
 * 4. Update booking status to CANCELLED
 * 5. Send cancellation confirmation email
 * 6. Return cancellation details
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const cancelBookingHandler = async (
  req: Request<{ id: string }, {}, {}, { reason?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.query;

    logger.info('Cancelling booking', { bookingId: id, reason });

    // Step 1: Fetch booking
    const booking = await bookingService.getBookingById(id);

    if (!booking) {
      res.status(404).json(
        ApiResponse.error('Booking not found', { bookingId: id })
      );
      return;
    }

    // Step 2: Validate booking can be cancelled
    if (booking.status === 'CANCELLED') {
      res.status(400).json(
        ApiResponse.error('Booking is already cancelled')
      );
      return;
    }

    if (booking.status === 'COMPLETED') {
      res.status(400).json(
        ApiResponse.error('Cannot cancel completed booking')
      );
      return;
    }

    // Step 3: Check check-in date
    const checkInDate = new Date(booking.checkIn);
    const now = new Date();
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilCheckIn < 0) {
      res.status(400).json(
        ApiResponse.error('Cannot cancel booking after check-in date')
      );
      return;
    }

    // Step 4: Get payment history
    const payments = await paymentService.getPaymentsByBookingId(id);
    const completedPayments = payments.filter(p => p.status === 'COMPLETED');
    const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);

    // Step 5: Calculate refund based on cancellation policy
    const refundPolicy = calculateRefundPolicy(daysUntilCheckIn, totalPaid);

    logger.info('Refund policy calculated', {
      bookingId: id,
      daysUntilCheckIn,
      totalPaid,
      refundAmount: refundPolicy.refundAmount
    });

    // Step 6: Process refund if applicable
    let refundTransactions = [];
    if (refundPolicy.refundAmount > 0 && completedPayments.length > 0) {
      try {
        // Process refunds in reverse order (most recent first)
        let remainingRefund = refundPolicy.refundAmount;
        
        for (const payment of completedPayments.reverse()) {
          if (remainingRefund <= 0) break;

          const refundAmount = Math.min(remainingRefund, payment.amount);
          
          const refund = await paymentService.processRefund({
            paymentId: payment.id,
            amount: refundAmount,
            reason: reason || 'Booking cancelled by guest'
          });

          refundTransactions.push(refund);
          remainingRefund -= refundAmount;

          logger.info('Refund processed', {
            bookingId: id,
            paymentId: payment.id,
            refundAmount,
            remainingRefund
          });
        }
      } catch (error) {
        logger.error('Error processing refund', {
          bookingId: id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json(
          ApiResponse.error('Failed to process refund. Please contact support.')
        );
        return;
      }
    }

    // Step 7: Update booking status
    await bookingService.updateBooking(id, {
      status: 'CANCELLED',
      cancellationDate: new Date().toISOString(),
      cancellationReason: reason || 'Cancelled by guest'
    });

    logger.info('Booking cancelled successfully', {
      bookingId: id,
      refundAmount: refundPolicy.refundAmount
    });

    // Step 8: Send cancellation email
    emailService.sendBookingCancellation(booking, {
      refundAmount: refundPolicy.refundAmount,
      refundPercentage: refundPolicy.refundPercentage,
      processingTime: '5-10 business days',
      reason: reason || 'Cancelled by guest'
    }).catch(error => {
      logger.error('Failed to send cancellation email', {
        bookingId: id,
        error: error.message
      });
    });

    // Step 9: Return cancellation details
    res.status(200).json(
      ApiResponse.success({
        booking: {
          id: booking.id,
          confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString()
        },
        refund: {
          eligible: refundPolicy.refundAmount > 0,
          amount: refundPolicy.refundAmount,
          percentage: refundPolicy.refundPercentage,
          originalAmount: totalPaid,
          currency: 'BRL',
          processingTime: '5-10 business days',
          transactions: refundTransactions.map(t => ({
            id: t.id,
            amount: t.amount,
            status: t.status,
            method: t.method
          }))
        },
        policy: {
          daysUntilCheckIn,
          message: refundPolicy.message
        }
      }, 'Booking cancelled successfully')
    );

  } catch (error) {
    logger.error('Error cancelling booking', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Calculate Refund Policy
 * 
 * Lapa Casa Hostel Cancellation Policy:
 * - More than 30 days: 100% refund
 * - 15-30 days: 50% refund
 * - Less than 15 days: No refund
 * 
 * @param {number} daysUntilCheckIn - Days remaining until check-in
 * @param {number} totalPaid - Total amount paid
 * @returns {object} Refund policy details
 */
function calculateRefundPolicy(
  daysUntilCheckIn: number,
  totalPaid: number
): {
  refundAmount: number;
  refundPercentage: number;
  message: string;
} {
  if (daysUntilCheckIn > 30) {
    return {
      refundAmount: totalPaid,
      refundPercentage: 100,
      message: 'Full refund - Cancelled more than 30 days before check-in'
    };
  }

  if (daysUntilCheckIn > 15) {
    return {
      refundAmount: totalPaid * 0.5,
      refundPercentage: 50,
      message: '50% refund - Cancelled 15-30 days before check-in'
    };
  }

  return {
    refundAmount: 0,
    refundPercentage: 0,
    message: 'No refund - Cancelled less than 15 days before check-in'
  };
}

/**
 * Validate Refund Eligibility
 * 
 * Additional validation for special cases
 * 
 * @param {object} booking - Booking object
 * @param {number} daysUntilCheckIn - Days until check-in
 * @returns {object} Validation result
 */
function validateRefundEligibility(
  booking: any,
  daysUntilCheckIn: number
): { eligible: boolean; reason?: string } {
  // Cannot refund if check-in has passed
  if (daysUntilCheckIn < 0) {
    return {
      eligible: false,
      reason: 'Check-in date has passed'
    };
  }

  // Special handling for Carnival bookings
  const checkInDate = new Date(booking.checkIn);
  const isCarnival = checkInDate.getMonth() === 1; // February

  if (isCarnival && daysUntilCheckIn < 60) {
    return {
      eligible: false,
      reason: 'Carnival bookings require 60 days notice for cancellation'
    };
  }

  return { eligible: true };
}
