/**
 * File: lapa-casa-hostel/backend/src/routes/payments/confirm-payment.ts
 * Confirm Payment Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Confirms successful payment and updates booking status
 * Sends confirmation emails and updates Google Sheets
 * 
 * @module routes/payments/confirm
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../services/payment-service';
import { BookingService } from '../../services/booking-service';
import { EmailService } from '../../services/email-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const paymentService = new PaymentService();
const bookingService = new BookingService();
const emailService = new EmailService();

/**
 * File: lapa-casa-hostel/backend/src/routes/payments/confirm-payment.ts
 * Confirm Payment Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Confirms successful payment and updates booking status
 * Sends confirmation emails and updates Google Sheets
 * 
 * @module routes/payments/confirm
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../services/payment-service';
import { BookingService } from '../../services/booking-service';
import { EmailService } from '../../services/email-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const paymentService = new PaymentService();
const bookingService = new BookingService();
const emailService = new EmailService();

/**
 * Confirm Payment Request Interface
 */
interface ConfirmPaymentRequest {
  paymentId: string;
  providerPaymentId?: string;
  transactionId?: string;
}

/**
 * Confirm Payment Handler
 * 
 * Payment confirmation flow:
 * 1. Validate payment exists and is confirmable
 * 2. Verify payment with provider (Stripe/MP)
 * 3. Update payment status to COMPLETED
 * 4. Update booking status if fully paid
 * 5. Send payment confirmation email
 * 6. Sync with Google Sheets
 * 7. Return confirmation details
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const confirmPaymentHandler = async (
  req: Request<{}, {}, ConfirmPaymentRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { paymentId, providerPaymentId, transactionId } = req.body;

    logger.info('Confirming payment', { paymentId, providerPaymentId });

    // Step 1: Get payment record
    const payment = await paymentService.getPaymentById(paymentId);

    if (!payment) {
      res.status(404).json(
        ApiResponse.error('Payment not found', { paymentId })
      );
      return;
    }

    // Step 2: Validate payment can be confirmed
    if (payment.status === 'COMPLETED') {
      res.status(400).json(
        ApiResponse.error('Payment has already been confirmed')
      );
      return;
    }

    if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
      res.status(400).json(
        ApiResponse.error('Cannot confirm a failed or cancelled payment')
      );
      return;
    }

    // Step 3: Verify payment with provider
    let providerVerification;
    try {
      providerVerification = await paymentService.verifyPaymentWithProvider(
        payment.provider,
        providerPaymentId || payment.providerIntentId
      );
    } catch (error) {
      logger.error('Provider verification failed', {
        paymentId,
        provider: payment.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json(
        ApiResponse.error('Failed to verify payment with provider')
      );
      return;
    }

    if (!providerVerification.success) {
      logger.warn('Payment verification failed', {
        paymentId,
        reason: providerVerification.reason
      });

      await paymentService.updatePayment(paymentId, {
        status: 'FAILED',
        failureReason: providerVerification.reason
      });

      res.status(400).json(
        ApiResponse.error('Payment verification failed', {
          reason: providerVerification.reason
        })
      );
      return;
    }

    // Step 4: Update payment status
    const updatedPayment = await paymentService.updatePayment(paymentId, {
      status: 'COMPLETED',
      paidAt: new Date().toISOString(),
      transactionId: transactionId || providerVerification.transactionId,
      providerResponse: providerVerification.data
    });

    logger.info('Payment confirmed successfully', {
      paymentId,
      transactionId: updatedPayment.transactionId
    });

    // Step 5: Get booking and check if fully paid
    const booking = await bookingService.getBookingById(payment.bookingId);

    if (!booking) {
      throw new Error('Booking not found for confirmed payment');
    }

    // Calculate total paid amount
    const allPayments = await paymentService.getPaymentsByBookingId(payment.bookingId);
    const totalPaid = allPayments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0);

    const isFullyPaid = totalPaid >= booking.pricing.total;
    const isDepositPaid = totalPaid >= booking.pricing.deposit;

    // Step 6: Update booking status
    let newBookingStatus = booking.status;
    if (isFullyPaid && booking.status === 'PENDING') {
      newBookingStatus = 'CONFIRMED';
      await bookingService.updateBooking(booking.id, {
        status: 'CONFIRMED'
      });
      logger.info('Booking fully paid and confirmed', { bookingId: booking.id });
    } else if (isDepositPaid && booking.status === 'PENDING') {
      newBookingStatus = 'CONFIRMED';
      await bookingService.updateBooking(booking.id, {
        status: 'CONFIRMED'
      });
      logger.info('Booking deposit paid and confirmed', { bookingId: booking.id });
    }

    // Step 7: Send confirmation email
    emailService.sendPaymentConfirmation(booking, {
      paymentId: updatedPayment.id,
      amount: updatedPayment.amount,
      type: updatedPayment.type,
      transactionId: updatedPayment.transactionId,
      totalPaid,
      remainingBalance: booking.pricing.total - totalPaid,
      isFullyPaid
    }).catch(error => {
      logger.error('Failed to send payment confirmation email', {
        paymentId,
        error: error.message
      });
    });

    // Step 8: Sync with Google Sheets (async)
    if (newBookingStatus === 'CONFIRMED') {
      bookingService.syncToGoogleSheets(booking).catch(error => {
        logger.error('Failed to sync booking to Google Sheets', {
          bookingId: booking.id,
          error: error.message
        });
      });
    }

    // Step 9: Return confirmation
    res.status(200).json(
      ApiResponse.success({
        payment: {
          id: updatedPayment.id,
          status: 'COMPLETED',
          amount: updatedPayment.amount,
          currency: updatedPayment.currency,
          type: updatedPayment.type,
          transactionId: updatedPayment.transactionId,
          paidAt: updatedPayment.paidAt
        },
        booking: {
          id: booking.id,
          confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
          status: newBookingStatus,
          totalPaid,
          remainingBalance: booking.pricing.total - totalPaid,
          isDepositPaid,
          isFullyPaid
        },
        nextSteps: isFullyPaid 
          ? {
              message: 'Your booking is fully paid and confirmed!',
              checkInDate: booking.checkIn,
              checkInTime: '14:00',
              address: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro'
            }
          : {
              message: 'Deposit paid successfully. Remaining balance due 7 days before check-in.',
              remainingAmount: booking.pricing.total - totalPaid,
              dueDate: new Date(
                new Date(booking.checkIn).getTime() - 7 * 24 * 60 * 60 * 1000
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
