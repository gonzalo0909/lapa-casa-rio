// lapa-casa-hostel/backend/src/routes/bookings/cancel-booking.ts

import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../../services/booking-service';
import { PaymentService } from '../../services/payment-service';
import { EmailService } from '../../services/email-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const bookingService = new BookingService();
const paymentService = new PaymentService();
const emailService = new EmailService();

export const cancelBookingHandler = async (
  req: Request<{ id: string }, {}, {}, { reason?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.query;

    logger.info('Cancelling booking', { bookingId: id, reason });

    const booking = await bookingService.getBookingById(id);

    if (!booking) {
      res.status(404).json(ApiResponse.error('Booking not found', { bookingId: id }));
      return;
    }

    if (booking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('Booking is already cancelled'));
      return;
    }

    if (booking.status === 'completed') {
      res.status(400).json(ApiResponse.error('Cannot cancel completed booking'));
      return;
    }

    const checkInDate = new Date(booking.check_in_date);
    const now = new Date();
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilCheckIn < 0) {
      res.status(400).json(ApiResponse.error('Cannot cancel booking after check-in date'));
      return;
    }

    const payments = await paymentService.getPaymentsByReservation(id);
    const completedPayments = payments.filter(p => p.status === 'completed');
    const totalPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const refundPolicy = calculateRefundPolicy(daysUntilCheckIn, totalPaid);

    logger.info('Refund policy calculated', {
      bookingId: id,
      daysUntilCheckIn,
      totalPaid,
      refundAmount: refundPolicy.refundAmount
    });

    // Process refund if applicable
    if (refundPolicy.refundAmount > 0 && completedPayments.length > 0) {
      try {
        await paymentService.processRefund({
          reservationId: id,
          amount: refundPolicy.refundAmount,
          reason: reason || 'Booking cancelled by guest'
        });
      } catch (error) {
        logger.error('Error processing refund', {
          bookingId: id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json(ApiResponse.error('Failed to process refund. Please contact support.'));
        return;
      }
    }

    await bookingService.updateBooking(id, { status: 'cancelled' });

    logger.info('Booking cancelled successfully', {
      bookingId: id,
      refundAmount: refundPolicy.refundAmount
    });

    // Send cancellation email (non-blocking)
    emailService.sendCancellationEmail({
      to: booking.guest?.email || '',
      bookingId: id,
      guestName: booking.guest?.full_name || '',
      refundAmount: refundPolicy.refundAmount,
      language: 'pt'
    }).catch(error => {
      logger.error('Failed to send cancellation email', { bookingId: id, error: error.message });
    });

    res.status(200).json(
      ApiResponse.success({
        booking: {
          id: booking.id,
          confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
          status: 'cancelled',
          cancelledAt: new Date().toISOString()
        },
        refund: {
          eligible: refundPolicy.refundAmount > 0,
          amount: refundPolicy.refundAmount,
          percentage: refundPolicy.refundPercentage,
          originalAmount: totalPaid,
          currency: 'BRL',
          processingTime: '5-10 business days'
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

function calculateRefundPolicy(
  daysUntilCheckIn: number,
  totalPaid: number
): { refundAmount: number; refundPercentage: number; message: string } {
  if (daysUntilCheckIn > 30) {
    return {
      refundAmount: totalPaid,
      refundPercentage: 100,
      message: 'Full refund - Cancelled more than 30 days before check-in'
    };
  }
  if (daysUntilCheckIn > 15) {
    return {
      refundAmount: Math.round(totalPaid * 0.5 * 100) / 100,
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
