/**
 * File: lapa-casa-hostel/backend/src/routes/payments/process-deposit.ts
 * Process Deposit Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles deposit payment processing with validation
 * Implements 30% or 50% deposit rules for groups
 * 
 * @module routes/payments/deposit
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
 * Process Deposit Request Interface
 */
interface ProcessDepositRequest {
  bookingId: string;
  provider: 'stripe' | 'mercadopago';
  paymentMethodId?: string;
  installments?: number;
}

/**
 * Process Deposit Handler
 * 
 * Deposit processing flow:
 * 1. Validate booking exists and requires deposit
 * 2. Calculate deposit amount (30% standard, 50% for 15+ people)
 * 3. Check if deposit already paid
 * 4. Process payment with selected provider
 * 5. Update booking status to CONFIRMED
 * 6. Schedule remaining payment reminder
 * 7. Return deposit confirmation
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const processDepositHandler = async (
  req: Request<{}, {}, ProcessDepositRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId, provider, paymentMethodId, installments = 1 } = req.body;

    logger.info('Processing deposit', { bookingId, provider });

    // Step 1: Get booking
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
        ApiResponse.error('Cannot process deposit for cancelled booking')
      );
      return;
    }

    if (booking.status === 'COMPLETED') {
      res.status(400).json(
        ApiResponse.error('Booking is already completed')
      );
      return;
    }

    // Step 3: Check if deposit already paid
    const existingPayments = await paymentService.getPaymentsByBookingId(bookingId);
    const depositPayment = existingPayments.find(
      p => p.type === 'deposit' && p.status === 'COMPLETED'
    );

    if (depositPayment) {
      res.status(409).json(
        ApiResponse.error('Deposit has already been paid', {
          paymentId: depositPayment.id,
          paidAt: depositPayment.paidAt
        })
      );
      return;
    }

    // Step 4: Calculate deposit amount
    const totalBeds = booking.rooms.reduce((sum, room) => sum + room.bedsCount, 0);
    const depositPercentage = totalBeds >= 15 ? 0.50 : 0.30;
    const depositAmount = booking.pricing.deposit;

    logger.info('Deposit calculation', {
      bookingId,
      totalBeds,
      depositPercentage,
      depositAmount
    });

    // Step 5: Validate deposit amount matches booking
    const expectedDeposit = booking.pricing.total * depositPercentage;
    if (Math.abs(depositAmount - expectedDeposit) > 0.01) {
      logger.warn('Deposit amount mismatch', {
        bookingId,
        expected: expectedDeposit,
        stored: depositAmount
      });
    }

    // Step 6: Create payment intent
    let paymentIntent;
    try {
      paymentIntent = await paymentService.createPaymentIntent({
        bookingId,
        amount: depositAmount,
        currency: 'BRL',
        provider,
        installments,
        metadata: {
          bookingId,
          type: 'deposit',
          depositPercentage: depositPercentage * 100,
          totalBeds,
          guestEmail: booking.guest.email,
          checkIn: booking.checkIn
        }
      });
    } catch (error) {
      logger.error('Failed to create deposit payment intent', {
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json(
        ApiResponse.error('Failed to process deposit payment')
      );
      return;
    }

    // Step 7: Store payment record
    const paymentRecord = await paymentService.createPaymentRecord({
      bookingId,
      amount: depositAmount,
      currency: 'BRL',
      type: 'deposit',
      provider,
      providerIntentId: paymentIntent.id,
      status: 'PENDING',
      installments,
      metadata: {
        depositPercentage: depositPercentage * 100,
        totalBeds
      }
    });

    logger.info('Deposit payment intent created', {
      paymentId: paymentRecord.id,
      intentId: paymentIntent.id
    });

    // Step 8: Calculate due dates
    const checkInDate = new Date(booking.checkIn);
    const depositDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now
    const remainingDueDate = new Date(checkInDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before check-in

    // Step 9: Return deposit details
    res.status(200).json(
      ApiResponse.success({
        payment: {
          id: paymentRecord.id,
          bookingId,
          type: 'deposit',
          amount: depositAmount,
          currency: 'BRL',
          status: 'PENDING',
          provider,
          installments
        },
        intent: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.clientSecret,
          publicKey: provider === 'stripe'
            ? process.env.STRIPE_PUBLIC_KEY
            : process.env.MP_PUBLIC_KEY
        },
        depositInfo: {
          percentage: depositPercentage * 100,
          amount: depositAmount,
          dueDate: depositDueDate.toISOString(),
          totalBeds,
          groupSize: totalBeds >= 15 ? 'large' : 'standard'
        },
        paymentSchedule: {
          deposit: {
            amount: depositAmount,
            percentage: depositPercentage * 100,
            dueDate: depositDueDate.toISOString(),
            status: 'PENDING'
          },
          remaining: {
            amount: booking.pricing.remaining,
            percentage: (1 - depositPercentage) * 100,
            dueDate: remainingDueDate.toISOString(),
            status: 'PENDING'
          },
          total: {
            amount: booking.pricing.total,
            currency: 'BRL'
          }
        },
        installments: installments > 1 ? {
          count: installments,
          amountPerInstallment: depositAmount / installments,
          totalWithInterest: calculateInstallmentTotal(depositAmount, installments)
        } : null
      }, 'Deposit payment intent created')
    );

  } catch (error) {
    logger.error('Error processing deposit', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Calculate Installment Total with Interest
 * 
 * @param {number} amount - Base amount
 * @param {number} installments - Number of installments
 * @returns {number} Total with interest
 */
function calculateInstallmentTotal(amount: number, installments: number): number {
  if (installments <= 1) return amount;

  let interestRate = 0;
  if (installments >= 7) {
    interestRate = 0.10;
  } else if (installments >= 4) {
    interestRate = 0.05;
  }

  return amount * (1 + interestRate);
}
