import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

interface ProcessDepositRequest {
  bookingId: string;
  provider: 'stripe' | 'mercadopago';
  paymentMethodId?: string;
  installments?: number;
}

export const processDepositHandler = async (
  req: Request<{}, {}, ProcessDepositRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId, provider, installments = 1 } = req.body;

    logger.info('Processing deposit', { bookingId, provider });

    const booking = await bookingService.getBookingById(bookingId);

    if (!booking) {
      res.status(404).json(ApiResponse.error('Booking not found', { bookingId }));
      return;
    }

    if (booking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('Cannot process deposit for cancelled booking'));
      return;
    }

    if (booking.status === 'completed') {
      res.status(400).json(ApiResponse.error('Booking is already completed'));
      return;
    }

    const existingPayments = await paymentService.getPaymentsByReservation(bookingId);
    const depositPayment = existingPayments.find(
      p => p.payment_type === 'deposit' && p.status === 'completed'
    );

    if (depositPayment) {
      res.status(409).json(
        ApiResponse.error('Deposit has already been paid', {
          paymentId: depositPayment.id,
          paidAt: depositPayment.paid_at
        })
      );
      return;
    }

    const totalBeds = booking.total_beds ?? 0;
    const depositPercentage = totalBeds >= 15 ? 0.50 : 0.30;
    const depositAmount = booking.deposit_amount;

    logger.info('Deposit calculation', {
      bookingId,
      totalBeds,
      depositPercentage,
      depositAmount
    });

    let paymentIntent: any;
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
          guestEmail: booking.guest?.email ?? '',
          checkIn: booking.check_in_date
        }
      });
    } catch (error) {
      logger.error('Failed to create deposit payment intent', {
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json(ApiResponse.error('Failed to process deposit payment'));
      return;
    }

    logger.info('Deposit payment intent created', { intentId: paymentIntent.id });

    const checkInDate = new Date(booking.check_in_date);
    const depositDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const remainingDueDate = new Date(checkInDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    res.status(200).json(
      ApiResponse.success({
        payment: {
          bookingId,
          type: 'deposit',
          amount: depositAmount,
          currency: 'BRL',
          status: 'pending',
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
            status: 'pending'
          },
          remaining: {
            amount: booking.remaining_amount,
            percentage: (1 - depositPercentage) * 100,
            dueDate: remainingDueDate.toISOString(),
            status: 'pending'
          },
          total: {
            amount: booking.total_price,
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
