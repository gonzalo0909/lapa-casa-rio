// lapa-casa-hostel/backend/src/routes/bookings/get-booking.ts

import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../../services/booking-service';
import { PaymentService } from '../../services/payment-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const bookingService = new BookingService();
const paymentService = new PaymentService();

export const getBookingHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Fetching booking', { bookingId: id });

    const booking = await bookingService.getBookingById(id);

    if (!booking) {
      logger.warn('Booking not found', { bookingId: id });
      res.status(404).json(ApiResponse.error('Booking not found', { bookingId: id }));
      return;
    }

    const payments = await paymentService.getPaymentsByReservation(id);

    const paidAmount = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const pendingAmount = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const refundedAmount = payments
      .filter(p => p.status === 'refunded')
      .reduce((sum, p) => sum + Number(p.refund_amount ?? p.amount), 0);

    const checkInDate = new Date(booking.check_in_date);
    const checkOut = new Date(booking.check_out_date);
    const now = new Date();
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const nights = Math.round(
      (checkOut.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const totalPrice = Number(booking.total_price);
    const depositAmount = Number(booking.deposit_amount ?? 0);

    const cancellationPolicy = getCancellationPolicy(
      booking.status,
      daysUntilCheckIn,
      paidAmount
    );

    // Split full_name into first/last for API response
    const nameParts = (booking.guest?.full_name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const response = {
      booking: {
        id: booking.id,
        confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
        status: booking.status,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at
      },
      dates: {
        checkIn: booking.check_in_date,
        checkOut: booking.check_out_date,
        nights,
        daysUntilCheckIn
      },
      guest: {
        firstName,
        lastName,
        fullName: booking.guest?.full_name,
        email: booking.guest?.email,
        phone: booking.guest?.phone,
        country: booking.guest?.country
      },
      pricing: {
        total: totalPrice,
        deposit: depositAmount,
        remaining: totalPrice - depositAmount,
        groupDiscountPct: Number(booking.group_discount_pct ?? 0),
        seasonType: booking.season_type,
        seasonMultiplier: Number(booking.season_multiplier ?? 1),
        currency: 'BRL'
      },
      payment: {
        paidAmount,
        pendingAmount,
        refundedAmount,
        remainingBalance: totalPrice - paidAmount,
        depositPaid: paidAmount >= depositAmount,
        fullyPaid: paidAmount >= totalPrice,
        paymentHistory: payments.map(p => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          provider: p.provider,
          paymentType: p.payment_type,
          providerPaymentId: p.provider_payment_id,
          createdAt: p.created_at,
          paidAt: p.paid_at
        }))
      },
      cancellation: cancellationPolicy,
      specialRequests: booking.special_requests,
      checkInInstructions: {
        address: 'Rua Silvio Romero 22, Santa Teresa',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '20241-110',
        country: 'Brazil',
        coordinates: { lat: -22.9219, lng: -43.1904 },
        whatsapp: '+55 21 99999-9999'
      }
    };

    logger.info('Booking retrieved successfully', { bookingId: id, status: booking.status });

    res.status(200).json(ApiResponse.success(response, 'Booking retrieved successfully'));
  } catch (error) {
    logger.error('Error retrieving booking', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

function getCancellationPolicy(
  status: string,
  daysUntilCheckIn: number,
  paidAmount: number
): {
  canCancel: boolean;
  refundPercentage: number;
  refundAmount: number;
  deadline: string | null;
  reason?: string;
} {
  if (status === 'cancelled') {
    return { canCancel: false, refundPercentage: 0, refundAmount: 0, deadline: null, reason: 'Booking already cancelled' };
  }
  if (status === 'completed') {
    return { canCancel: false, refundPercentage: 0, refundAmount: 0, deadline: null, reason: 'Booking already completed' };
  }
  if (daysUntilCheckIn < 0) {
    return { canCancel: false, refundPercentage: 0, refundAmount: 0, deadline: null, reason: 'Check-in date has passed' };
  }
  if (daysUntilCheckIn > 30) {
    return {
      canCancel: true,
      refundPercentage: 100,
      refundAmount: paidAmount,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  }
  if (daysUntilCheckIn > 15) {
    return {
      canCancel: true,
      refundPercentage: 50,
      refundAmount: paidAmount * 0.5,
      deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    };
  }
  return {
    canCancel: true,
    refundPercentage: 0,
    refundAmount: 0,
    deadline: null,
    reason: 'No refund available within 15 days of check-in'
  };
}
