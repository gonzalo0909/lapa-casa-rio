import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { emailService } from '../../services/email-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

interface ConfirmPaymentRequest {
  paymentId: string;
  providerPaymentId?: string;
  transactionId?: string;
}

export const confirmPaymentHandler = async (
  req: Request<{}, {}, ConfirmPaymentRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { paymentId, providerPaymentId, transactionId } = req.body;

    logger.info('Confirming payment', { paymentId, providerPaymentId });

    const payment = await paymentService.getPaymentById(paymentId);

    if (!payment) {
      res.status(404).json(ApiResponse.error('Payment not found', { paymentId }));
      return;
    }

    if (payment.status === 'completed') {
      res.status(400).json(ApiResponse.error('Payment has already been confirmed'));
      return;
    }

    if (payment.status === 'failed' || payment.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('Cannot confirm a failed or cancelled payment'));
      return;
    }

    let providerVerification: any;
    try {
      providerVerification = await paymentService.verifyPaymentWithProvider(
        payment.provider,
        providerPaymentId || payment.provider_payment_id
      );
    } catch (error) {
      logger.error('Provider verification failed', {
        paymentId,
        provider: payment.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json(ApiResponse.error('Failed to verify payment with provider'));
      return;
    }

    if (!providerVerification.success) {
      logger.warn('Payment verification failed', {
        paymentId,
        reason: providerVerification.reason
      });

      await paymentService.updatePayment(paymentId, {
        status: 'failed',
        failure_reason: providerVerification.reason
      });

      res.status(400).json(
        ApiResponse.error('Payment verification failed', { reason: providerVerification.reason })
      );
      return;
    }

    const updatedPayment = await paymentService.updatePayment(paymentId, {
      status: 'completed',
      paid_at: new Date().toISOString()
    });

    logger.info('Payment confirmed successfully', { paymentId });

    const booking = await bookingService.getBookingById(payment.reservation_id);

    if (!booking) {
      throw new Error('Booking not found for confirmed payment');
    }

    const allPayments = await paymentService.getPaymentsByReservation(payment.reservation_id);
    const totalPaid = allPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const isFullyPaid = totalPaid >= booking.total_price;
    const isDepositPaid = totalPaid >= booking.deposit_amount;

    let newBookingStatus = booking.status;
    if ((isFullyPaid || isDepositPaid) && booking.status === 'pending_payment') {
      newBookingStatus = 'confirmed';
      await bookingService.updateBooking(booking.id, { status: 'confirmed' });
      logger.info('Booking confirmed after payment', { bookingId: booking.id });
    }

    emailService.sendPaymentConfirmationEmail({
      guestName: booking.guest?.full_name ?? '',
      guestEmail: booking.guest?.email ?? '',
      bookingId: booking.id,
      amount: payment.amount,
      paymentType: payment.payment_type,
      totalPaid,
      remainingBalance: booking.total_price - totalPaid,
      isFullyPaid
    }).catch((err: Error) => {
      logger.error('Failed to send payment confirmation email', {
        paymentId,
        error: err.message
      });
    });

    res.status(200).json(
      ApiResponse.success({
        payment: {
          id: updatedPayment?.id ?? paymentId,
          status: 'completed',
          amount: payment.amount,
          currency: payment.currency,
          type: payment.payment_type,
          paidAt: new Date().toISOString()
        },
        booking: {
          id: booking.id,
          confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
          status: newBookingStatus,
          totalPaid,
          remainingBalance: booking.total_price - totalPaid,
          isDepositPaid,
          isFullyPaid
        },
        nextSteps: isFullyPaid
          ? {
              message: 'Your booking is fully paid and confirmed!',
              checkInDate: booking.check_in_date,
              checkInTime: '14:00',
              address: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro'
            }
          : {
              message: 'Deposit paid successfully. Remaining balance due 7 days before check-in.',
              remainingAmount: booking.total_price - totalPaid,
              dueDate: new Date(
                new Date(booking.check_in_date).getTime() - 7 * 24 * 60 * 60 * 1000
              ).toISOString()
            }
      }, 'Payment confirmed successfully')
    );

  } catch (error) {
    logger.error('Error confirming payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};
