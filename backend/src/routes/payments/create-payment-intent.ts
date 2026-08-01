import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

interface CreatePaymentIntentRequest {
  bookingId: string;
  amount: number;
  paymentType: 'deposit' | 'remaining' | 'full';
  provider: 'stripe' | 'mercadopago';
  currency?: string;
  installments?: number;
  saveCard?: boolean;
}

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
      installments = 1
    } = req.body;

    logger.info('Creating payment intent', { bookingId, amount, paymentType, provider });

    const booking = await bookingService.getBookingById(bookingId);

    if (!booking) {
      res.status(404).json(ApiResponse.error('Booking not found', { bookingId }));
      return;
    }

    if (booking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('Cannot create payment for cancelled booking'));
      return;
    }

    if (booking.status === 'completed') {
      res.status(400).json(ApiResponse.error('Booking is already completed and fully paid'));
      return;
    }

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

    const existingPayments = await paymentService.getPaymentsByReservation(bookingId);
    const hasCompletedDeposit = existingPayments.some(
      p => p.payment_type === 'deposit' && p.status === 'completed'
    );

    if (paymentType === 'deposit' && hasCompletedDeposit) {
      res.status(409).json(ApiResponse.error('Deposit has already been paid for this booking'));
      return;
    }

    if (installments > 1 && (provider !== 'mercadopago' || currency !== 'BRL')) {
      res.status(400).json(ApiResponse.error('Installments only available for Mercado Pago in BRL'));
      return;
    }

    if (installments > 12) {
      res.status(400).json(ApiResponse.error('Maximum 12 installments allowed'));
      return;
    }

    let paymentIntent: any;
    try {
      paymentIntent = await paymentService.createPaymentIntent({
        bookingId,
        amount,
        currency,
        provider,
        installments,
        metadata: {
          bookingId,
          guestEmail: booking.guest?.email ?? '',
          guestName: booking.guest?.full_name ?? '',
          checkIn: booking.check_in_date,
          checkOut: booking.check_out_date,
          paymentType
        }
      });
    } catch (error) {
      logger.error('Failed to create payment intent', {
        bookingId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json(ApiResponse.error('Failed to create payment intent. Please try again.'));
      return;
    }

    logger.info('Payment intent created successfully', {
      intentId: paymentIntent.id,
      provider
    });

    const now = new Date();
    const checkInDate = new Date(booking.check_in_date);
    const depositDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const remainingDueDate = new Date(checkInDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    res.status(201).json(
      ApiResponse.success({
        payment: {
          bookingId,
          amount,
          currency,
          type: paymentType,
          provider,
          status: 'pending',
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
          depositAmount: booking.deposit_amount,
          depositDueDate: depositDueDate.toISOString(),
          depositPaid: hasCompletedDeposit,
          remainingAmount: booking.remaining_amount,
          remainingDueDate: remainingDueDate.toISOString(),
          totalAmount: booking.total_price
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

function getExpectedAmount(
  booking: any,
  paymentType: 'deposit' | 'remaining' | 'full'
): number {
  switch (paymentType) {
    case 'deposit':
      return booking.deposit_amount;
    case 'remaining':
      return booking.remaining_amount;
    case 'full':
      return booking.total_price;
    default:
      throw new Error('Invalid payment type');
  }
}

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
