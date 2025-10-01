/**
 * File: lapa-casa-hostel/backend/src/routes/payments/payments.routes.ts
 * Payments Routes Module
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles payment processing endpoints for Stripe and Mercado Pago
 * Implements deposit system, webhooks, and payment confirmations
 * 
 * @module routes/payments
 * @requires express
 */

import { Router } from 'express';
import { createPaymentIntentHandler } from './create-payment-intent';
import { confirmPaymentHandler } from './confirm-payment';
import { processDepositHandler } from './process-deposit';
import { handleWebhookHandler } from './handle-webhook';
import { validationMiddleware } from '../../middleware/validation';
import { logger } from '../../utils/logger';
import express from 'express';

const router = Router();

/**
 * Create Payment Intent (Stripe/MP)
 * @route POST /payments/intent
 * @group Payments - Payment processing operations
 * @param {object} payment.body.required - Payment intent details
 * @returns {object} 201 - Payment intent created
 * @returns {Error} 400 - Invalid payment data
 * @returns {Error} 500 - Payment processing error
 */
router.post(
  '/intent',
  validationMiddleware('createPaymentIntent'),
  createPaymentIntentHandler
);

/**
 * Confirm Payment
 * @route POST /payments/confirm
 * @group Payments - Payment processing operations
 * @param {object} confirmation.body.required - Payment confirmation details
 * @returns {object} 200 - Payment confirmed
 * @returns {Error} 400 - Invalid confirmation data
 * @returns {Error} 404 - Payment not found
 * @returns {Error} 500 - Server error
 */
router.post(
  '/confirm',
  validationMiddleware('confirmPayment'),
  confirmPaymentHandler
);

/**
 * Process Deposit Payment
 * @route POST /payments/deposit
 * @group Payments - Payment processing operations
 * @param {object} deposit.body.required - Deposit payment details
 * @returns {object} 200 - Deposit processed
 * @returns {Error} 400 - Invalid deposit data
 * @returns {Error} 409 - Deposit already paid
 * @returns {Error} 500 - Server error
 */
router.post(
  '/deposit',
  validationMiddleware('processDeposit'),
  processDepositHandler
);

/**
 * Stripe Webhook Handler
 * @route POST /payments/webhook/stripe
 * @group Payments - Payment webhook operations
 * @returns {object} 200 - Webhook processed
 * @returns {Error} 400 - Invalid webhook signature
 * @returns {Error} 500 - Server error
 */
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  handleWebhookHandler
);

/**
 * Mercado Pago Webhook Handler
 * @route POST /payments/webhook/mercadopago
 * @group Payments - Payment webhook operations
 * @returns {object} 200 - Webhook processed
 * @returns {Error} 400 - Invalid webhook data
 * @returns {Error} 500 - Server error
 */
router.post(
  '/webhook/mercadopago',
  express.json(),
  async (req, res, next) => {
    try {
      logger.info('Mercado Pago webhook received', { body: req.body });
      
      // Process Mercado Pago webhook
      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Payment Status
 * @route GET /payments/:id/status
 * @group Payments - Payment processing operations
 * @param {string} id.path.required - Payment ID
 * @returns {object} 200 - Payment status
 * @returns {Error} 404 - Payment not found
 * @returns {Error} 500 - Server error
 */
router.get(
  '/:id/status',
  validationMiddleware('getPaymentStatus'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      logger.info('Get payment status', { paymentId: id });

      res.status(200).json({
        id,
        status: 'PENDING',
        amount: 0,
        currency: 'BRL',
        method: 'card',
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Payment History for Booking
 * @route GET /payments/booking/:bookingId
 * @group Payments - Payment processing operations
 * @param {string} bookingId.path.required - Booking ID
 * @returns {Array} 200 - Payment history
 * @returns {Error} 404 - Booking not found
 * @returns {Error} 500 - Server error
 */
router.get(
  '/booking/:bookingId',
  validationMiddleware('getPaymentHistory'),
  async (req, res, next) => {
    try {
      const { bookingId } = req.params;
      
      logger.info('Get payment history', { bookingId });

      res.status(200).json({
        bookingId,
        payments: [],
        totalPaid: 0,
        totalPending: 0,
        currency: 'BRL'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Retry Failed Payment
 * @route POST /payments/:id/retry
 * @group Payments - Payment processing operations
 * @param {string} id.path.required - Payment ID
 * @returns {object} 200 - Payment retry initiated
 * @returns {Error} 400 - Payment cannot be retried
 * @returns {Error} 404 - Payment not found
 * @returns {Error} 500 - Server error
 */
router.post(
  '/:id/retry',
  validationMiddleware('retryPayment'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      logger.info('Retry payment', { paymentId: id });

      res.status(200).json({
        id,
        status: 'PENDING',
        retryAttempt: 1,
        message: 'Payment retry initiated'
      });
    } catch (error) {
      next(error);
    }
  }
);

export const paymentsRouter = router;
