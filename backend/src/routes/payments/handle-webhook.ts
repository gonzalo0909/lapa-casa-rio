/**
 * File: lapa-casa-hostel/backend/src/routes/payments/handle-webhook.ts
 * Payment Webhook Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles webhooks from Stripe and Mercado Pago
 * Processes payment events and updates booking status
 * 
 * @module routes/payments/webhook
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../services/payment-service';
import { BookingService } from '../../services/booking-service';
import { EmailService } from '../../services/email-service';
import { logger } from '../../utils/logger';
import Stripe from 'stripe';

const paymentService = new PaymentService();
const bookingService = new BookingService();
const emailService = new EmailService();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia'
});

/**
 * Handle Webhook Handler
 * 
 * Webhook processing flow:
 * 1. Verify webhook signature
 * 2. Parse webhook event
 * 3. Handle event based on type
 * 4. Update payment and booking status
 * 5. Send notifications
 * 6. Return 200 OK to provider
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const handleWebhookHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    logger.error('No webhook signature provided');
    res.status(400).json({ error: 'No signature' });
    return;
  }

  let event: Stripe.Event;

  try {
    // Step 1: Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (error) {
    logger.error('Webhook signature verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  logger.info('Webhook received', {
    type: event.type,
    id: event.id
  });

  try {
    // Step 2: Handle event based on type
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      default:
        logger.info('Unhandled webhook event type', { type: event.type });
    }

    // Step 3: Return 200 OK
    res.status(200).json({ received: true });

  } catch (error) {
    logger.error('Error handling webhook', {
      eventType: event.type,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Still return 200 to prevent webhook retry
    res.status(200).json({ received: true, error: 'Processing failed' });
  }
};

/**
 * Handle Payment Intent Succeeded
 * 
 * Processes successful payment confirmation
 * 
 * @param {Stripe.PaymentIntent} paymentIntent - Payment intent object
 * @returns {Promise<void>}
 */
async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  logger.info('Payment succeeded', { paymentIntentId: paymentIntent.id });

  const bookingId = paymentIntent.metadata.bookingId;
  if (!bookingId) {
    logger.error('No bookingId in payment intent metadata');
    return;
  }

  // Find payment record
  const payment = await paymentService.getPaymentByProviderIntentId(paymentIntent.id);
  if (!payment) {
    logger.error('Payment record not found', { paymentIntentId: paymentIntent.id });
    return;
  }

  // Update payment status
  await paymentService.updatePayment(payment.id, {
    status: 'COMPLETED',
    paidAt: new Date().toISOString(),
    transactionId: paymentIntent.charges.data[0]?.id || paymentIntent.id,
    providerResponse: paymentIntent
  });

  // Get booking
  const booking = await bookingService.getBookingById(bookingId);
  if (!booking) {
    logger.error('Booking not found', { bookingId });
    return;
  }

  // Calculate total paid
  const allPayments = await paymentService.getPaymentsByBookingId(bookingId);
  const totalPaid = allPayments
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.amount, 0);

  const isFullyPaid = totalPaid >= booking.pricing.total;

  // Update booking status
  if (isFullyPaid && booking.status !== 'CONFIRMED') {
    await bookingService.updateBooking(bookingId, {
      status: 'CONFIRMED'
    });

    // Sync to Google Sheets
    bookingService.syncToGoogleSheets(booking).catch(error => {
      logger.error('Failed to sync to Google Sheets', {
        bookingId,
        error: error.message
      });
    });
  } else if (booking.status === 'PENDING') {
    await bookingService.updateBooking(bookingId, {
      status: 'CONFIRMED'
    });
  }

  // Send confirmation email
  emailService.sendPaymentConfirmation(booking, {
    paymentId: payment.id,
    amount: payment.amount,
    type: payment.type,
    transactionId: paymentIntent.charges.data[0]?.id,
    totalPaid,
    remainingBalance: booking.pricing.total - totalPaid,
    isFullyPaid
  }).catch(error => {
    logger.error('Failed to send payment confirmation email', {
      bookingId,
      error: error.message
    });
  });

  logger.info('Payment processed successfully', {
    paymentId: payment.id,
    bookingId,
    totalPaid,
    isFullyPaid
  });
}

/**
 * Handle Payment Intent Failed
 * 
 * Processes failed payment attempts
 * 
 * @param {Stripe.PaymentIntent} paymentIntent - Payment intent object
 * @returns {Promise<void>}
 */
async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  logger.warn('Payment failed', { paymentIntentId: paymentIntent.id });

  const payment = await paymentService.getPaymentByProviderIntentId(paymentIntent.id);
  if (!payment) {
    logger.error('Payment record not found', { paymentIntentId: paymentIntent.id });
    return;
  }

  // Update payment status
  await paymentService.updatePayment(payment.id, {
    status: 'FAILED',
    failureReason: paymentIntent.last_payment_error?.message || 'Payment failed'
  });

  // Get booking
  const booking = await bookingService.getBookingById(payment.bookingId);
  if (!booking) {
    logger.error('Booking not found', { bookingId: payment.bookingId });
    return;
  }

  // Send failure notification
  emailService.sendPaymentFailed(booking, {
    paymentId: payment.id,
    amount: payment.amount,
    failureReason: paymentIntent.last_payment_error?.message || 'Payment declined',
    retryUrl: `${process.env.FRONTEND_URL}/booking/${booking.id}/payment`
  }).catch(error => {
    logger.error('Failed to send payment failure email', {
      bookingId: booking.id,
      error: error.message
    });
  });
}

/**
 * Handle Charge Refunded
 * 
 * Processes refund events
 * 
 * @param {Stripe.Charge} charge - Charge object
 * @returns {Promise<void>}
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  logger.info('Charge refunded', { chargeId: charge.id });

  const refundAmount = charge.amount_refunded / 100; // Convert from cents

  // Find payment by transaction ID
  const payment = await paymentService.getPaymentByTransactionId(charge.id);
  if (!payment) {
    logger.error('Payment not found for refund', { chargeId: charge.id });
    return;
  }

  // Create refund record
  await paymentService.createRefundRecord({
    paymentId: payment.id,
    amount: refundAmount,
    reason: 'Refunded via webhook',
    providerRefundId: charge.refunds?.data[0]?.id || charge.id
  });

  logger.info('Refund processed', {
    paymentId: payment.id,
    refundAmount
  });
}

/**
 * Handle Dispute Created
 * 
 * Processes chargeback/dispute events
 * 
 * @param {Stripe.Dispute} dispute - Dispute object
 * @returns {Promise<void>}
 */
async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  logger.warn('Dispute created', {
    disputeId: dispute.id,
    amount: dispute.amount / 100,
    reason: dispute.reason
  });

  // Find payment by charge ID
  const payment = await paymentService.getPaymentByTransactionId(dispute.charge as string);
  if (!payment) {
    logger.error('Payment not found for dispute', { chargeId: dispute.charge });
    return;
  }

  // Create dispute record
  await paymentService.createDisputeRecord({
    paymentId: payment.id,
    amount: dispute.amount / 100,
    reason: dispute.reason,
    status: dispute.status,
    providerDisputeId: dispute.id
  });

  // Notify admin
  emailService.sendDisputeNotification({
    paymentId: payment.id,
    bookingId: payment.bookingId,
    amount: dispute.amount / 100,
    reason: dispute.reason,
    disputeId: dispute.id
  }).catch(error => {
    logger.error('Failed to send dispute notification', {
      disputeId: dispute.id,
      error: error.message
    });
  });
}
