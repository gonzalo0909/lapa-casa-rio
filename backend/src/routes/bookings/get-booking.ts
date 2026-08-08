// lapa-casa-hostel/backend/src/routes/bookings/get-booking.ts
// ventana3

import { Request, Response, NextFunction } from 'express';
import { bookingService } from '../../services/booking-service';
import { paymentService } from '../../services/payment-service';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

export const getBookingHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Obteniendo reserva', { bookingId: id });

    const booking = await bookingService.getBooking(id);

    if (!booking) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada', { bookingId: id }));
      return;
    }

    const payments = await paymentService.getPaymentsByReservation(id);

    const paidAmount = payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const pendingAmount = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const refundedAmount = payments
      .filter(p => p.status === 'refunded')
      .reduce((sum, p) => sum + Number(p.refund_amount ?? p.amount), 0);

    const checkInDate = new Date(booking.check_in_date);
    const checkOutDate = new Date(booking.check_out_date);
    const now = new Date();
    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const finalPrice = Number(booking.final_price);
    const depositAmount = Number(booking.deposit_amount);

    // Política de cancelación desde SQL
    let refundAmount = 0;
    let refundPercentage = 0;
    let canCancel = booking.status !== 'cancelled' && booking.status !== 'completed' && checkInDate >= now;
    if (canCancel && paidAmount > 0) {
      const refundResult = await query<{ refund_amount: string }>(
        `SELECT calculate_cancellation_refund($1, $2::date, NOW()) AS refund_amount`,
        [finalPrice, booking.check_in_date]
      );
      refundAmount = Math.min(parseFloat(refundResult.rows[0]?.refund_amount ?? '0'), paidAmount);
      refundPercentage = finalPrice > 0 ? Math.round((refundAmount / finalPrice) * 100) : 0;
    }

    const nameParts = (booking.guest?.full_name || '').split(' ');

    res.status(200).json(ApiResponse.success({
      booking: {
        id: booking.id,
        confirmationNumber: `LCH-${booking.id.substring(0, 8).toUpperCase()}`,
        status: booking.status,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        pendingExpiresAt: booking.pending_expires_at,
      },
      dates: {
        checkIn: booking.check_in_date,
        checkOut: booking.check_out_date,
        nights,
        daysUntilCheckIn,
      },
      guest: {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        fullName: booking.guest?.full_name,
        email: booking.guest?.email,
        phone: booking.guest?.phone,
        country: booking.guest?.country,
      },
      pricing: {
        total: finalPrice,
        deposit: depositAmount,
        remaining: Number(booking.remaining_amount),
        groupDiscount: Number(booking.group_discount),
        seasonMultiplier: Number(booking.season_multiplier),
        earlyBirdDiscount: Number(booking.early_bird_discount),
        bedsCount: booking.beds_count,
        nightsCount: booking.nights_count,
        currency: 'BRL',
      },
      payment: {
        paidAmount,
        pendingAmount,
        refundedAmount,
        remainingBalance: finalPrice - paidAmount,
        depositPaid: paidAmount >= depositAmount,
        fullyPaid: paidAmount >= finalPrice,
        paymentHistory: payments.map(p => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          provider: p.provider,
          paymentType: p.payment_type,
          providerPaymentId: p.provider_payment_id,
          createdAt: p.created_at,
          paidAt: p.paid_at,
        })),
      },
      cancellation: {
        canCancel,
        refundPercentage,
        refundAmount,
        paidAmount,
      },
      specialRequests: booking.special_requests,
      checkInInstructions: {
        address: 'Rua Silvio Romero 22, Santa Teresa',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '20241-110',
        country: 'Brazil',
        whatsapp: '+55 21 99999-9999',
      },
    }, 'Reserva obtenida exitosamente'));

  } catch (error) {
    logger.error('Error al obtener reserva', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
