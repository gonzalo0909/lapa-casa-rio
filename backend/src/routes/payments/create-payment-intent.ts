/**
 * File: lapa-casa-hostel/backend/src/routes/payments/create-payment-intent.ts
 * Create Payment Intent Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Creates payment intents for Stripe and Mercado Pago
 * Handles deposit calculations and installment options
 * 
 * @module routes/payments/create-intent
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../../services/payment-service';
import { BookingService } from '../../services/booking-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const paymentService = new PaymentService();
const bookingService = new BookingService();

/**
 * Payment Intent Request Interface
 */
interface CreatePaymentIntentRequest {
  bookingId: string;
  amount: number;
  paymentType: 'deposit' | 'remaining' | 'full';
  provider: 'stripe' | 'mercadopago';
  currency?: string;
  installments?: number;
  saveCard?: boolean;
}

/**
 * Create Payment Intent Handler
 * 
 * Payment intent flow:
 * 1. Validate booking exists and payment is required
 * 2. Verify payment amount matches booking
 * 3. Create payment intent with selected provider
 * 4. Return client secret for frontend processing
 * 5. Store payment record with PENDING status
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const createPaymentIntentHandler = async (
  req: Request<{}, {}, CreatePaymentIntentRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      bookingId,
      amount,
      paymentType,
      provider,
      currency = 'BRL',
      installments = 1,
      saveCard = false
    } = req.body;

    logger.info('Creating payment intent', {
      bookingId,
      amount,
      paymentType,
      provider
    });

    // Step 1: Validate booking exists
    const booking = await bookingService.getBookingById(bookingId);

    if (!booking) {
      res.status(404).json(
        ApiResponse.error('Booking not found', { bookingId })
      );
      return;
    }

    // Step 2: Validate booking status
    if (booking.status === 'CANCELLED') {
      res.status(400).json(
        ApiResponse.error('Cannot create payment for cancelled booking')
      );
      return;
    }

    if (booking.status === 'COMPLETED') {
      res.status(400).json(
        ApiResponse.error('Booking is already completed and fully paid')
      );
      return;
    }

    // Step 3: Validate payment amount
    const expectedAmount = getExpectedAmount(booking, paymentType);

    if (Math.abs(amount - expectedAmount) > 0.01) {
      res.status(400).json(
        ApiResponse.error('Payment amount does not match expected amount', {
          provided: amount,
          expected: expectedAmount
        })
      );
      return;
    }

    // Step 4: Check if payment already exists
    const existingPayments = await paymentService.getPaymentsByBookingId(bookingId);
    const hasCompletedDeposit = existingPayments.some(
      p => p.type === 'deposit' && p.status === 'COMPLETED'
    );

    if (paymentType === 'deposit' && hasCompletedDeposit) {
      res.status(409).json(
        ApiResponse.error('Deposit has already been paid for this booking')
      );
      return;
    }

    // Step 5: Validate installments (Brazil only for MP)
    if (installments > 1 && (provider !== 'mercadopago' || currency !== 'BRL')) {
      res.status(400).json(
        ApiResponse.error('Installments only available for Mercado Pago in BRL')
      );
      return;
    }

    if (installments > 12) {
      res.status(400).json(
        ApiResponse.error('Maximum 12 installments allowed')
      );
      return;
    }

    // Step 6: Create payment intent with provider
    let paymentIntent;
    try {
      paymentIntent = await paymentService.createPaymentIntent({
        bookingId,
        amount,
        currency,
        provider,
        installments,
        metadata: {
          bookingId,
          guestEmail: booking.guest.email,
          guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          paymentType
        }
      });
    } catch (error) {
      logger.error('Failed to create payment intent', {
        bookingId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json(
        ApiResponse.error('Failed to create payment intent. Please try again.')
      );
      return;
    }

    // Step 7: Store payment record
    const paymentRecord = await paymentService.createPaymentRecord({
      bookingId,
      amount,
      currency,
      type: paymentType,
      provider,
      providerIntentId: paymentIntent.id,
      status: 'PENDING',
      installments,
      metadata: paymentIntent.metadata
    });

    logger.info('Payment intent created successfully', {
      paymentId: paymentRecord.id,
      intentId: paymentIntent.id,
      provider
    });

    // Step 8: Calculate due dates
    const now = new Date();
    const checkInDate = new Date(booking.checkIn);
    const depositDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h from now
    const remainingDueDate = new Date(checkInDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before check-in

    // Step 9: Return payment intent details
    res.status(201).json(
      ApiResponse.success({
        payment: {
          id: paymentRecord.id,
          bookingId,
          amount,
          currency,
          type: paymentType,
          provider,
          status: 'PENDING',
          installments
        },
        intent: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.clientSecret,
          publicKey: provider === 'stripe' 
            ? process.env.STRIPE_PUBLIC_KEY 
            : process.env.MP_PUBLIC_KEY
        },
        schedule: {
          depositAmount: booking.pricing.deposit,
          depositDueDate: depositDueDate.toISOString(),
          depositPaid: hasCompletedDeposit,
          remainingAmount: booking.pricing.remaining,
          remainingDueDate: remainingDueDate.toISOString(),
          totalAmount: booking.pricing.total
        },
        installments: installments > 1 ? {
          count: installments,
          amountPerInstallment: amount / installments,
          totalWithInterest: calculateInstallmentTotal(amount, installments)
        } : null
      }, 'Payment intent created successfully')
    );

  } catch (error) {
    logger.error('Error creating payment intent', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Get Expected Payment Amount
 * 
 * Calculates expected payment based on type and booking pricing
 * 
 * @param {object} booking - Booking object
 * @param {string} paymentType - Payment type (deposit/remaining/full)
 * @returns {number} Expected payment amount
 */
function getExpectedAmount(
  booking: any,
  paymentType: 'deposit' | 'remaining' | 'full'
): number {
  switch (paymentType) {
    case 'deposit':
      return booking.pricing.deposit;
    case 'remaining':
      return booking.pricing.remaining;
    case 'full':
      return booking.pricing.total;
    default:
      throw new Error('Invalid payment type');
  }
}

/**
 * Calculate Installment Total
 * 
 * Calculates total amount with interest for installment payments
 * Brazilian market typically charges 2-3% interest per installment
 * 
 * @param {number} amount - Base amount
 * @param {number} installments - Number of installments
 * @returns {number} Total amount with interest
 */
function calculateInstallmentTotal(
  amount: number,
  installments: number
): number {
  if (installments <= 1) return amount;

  // Interest calculation (simplified)
  // 1-3 installments: no interest
  // 4-6 installments: 5% interest
  // 7-12 installments: 10% interest
  let interestRate = 0;
  
  if (installments >= 7) {
    interestRate = 0.10;
  } else if (installments >= 4) {
    interestRate = 0.05;
  }

  return amount * (1 + interestRate);
}
