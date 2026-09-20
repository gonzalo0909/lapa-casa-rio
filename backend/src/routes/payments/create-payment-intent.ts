
import type { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

async function getCardSurchargePercent(): Promise<number> {
  const { rows } = await query<{ value: number }>(
    `SELECT value FROM system_config WHERE key = 'card_surcharge_percent'`
  );
  return rows[0]?.value ?? 0;
}

interface CreatePaymentIntentRequest {
  reservationId: string;
  paymentType: 'deposit' | 'remaining';
  provider: 'stripe' | 'mercadopago';
  currency?: string;
  installments?: number;
}

export const createPaymentIntentHandler = async (
  req: Request<{}, {}, CreatePaymentIntentRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId, paymentType, provider, currency = 'BRL', installments = 1 } = req.body;

    logger.info('Creando payment intent', { reservationId, paymentType, provider });

    const booking = await bookingService.getBooking(reservationId);

    if (!booking) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada', { reservationId }));
      return;
    }

    if (booking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('No se puede crear un pago para una reserva cancelada'));
      return;
    }

    const existingPayments = await paymentService.getPaymentsByReservation(reservationId);
    const hasCompletedDeposit = existingPayments.some(
      p => p.payment_type === 'deposit' && p.status === 'succeeded'
    );

    if (paymentType === 'deposit' && hasCompletedDeposit) {
      res.status(409).json(ApiResponse.error('El depósito ya fue pagado para esta reserva'));
      return;
    }

    if (paymentType === 'remaining' && !hasCompletedDeposit) {
      res.status(400).json(ApiResponse.error('Debe pagar el depósito primero'));
      return;
    }

    if (installments > 1 && (provider !== 'mercadopago' || currency !== 'BRL')) {
      res.status(400).json(ApiResponse.error('Cuotas solo disponibles con MercadoPago en BRL'));
      return;
    }

    if (installments > 12) {
      res.status(400).json(ApiResponse.error('Máximo 12 cuotas permitidas'));
      return;
    }

    const baseAmount = paymentType === 'deposit'
      ? Number(booking.deposit_amount)
      : Number(booking.remaining_amount);

    const cardSurchargePercent = (provider === 'stripe' && paymentType === 'deposit')
      ? await getCardSurchargePercent()
      : 0;
    const amount = cardSurchargePercent > 0
      ? Math.round(baseAmount * (1 + cardSurchargePercent / 100) * 100) / 100
      : baseAmount;

    const guestEmail = booking.guest?.email ?? '';

    const paymentIntent = await paymentService.createPaymentIntent({
      reservation_id: reservationId,
      guest_id: booking.guest_id,
      amount,
      baseAmount,
      currency,
      guest_email: guestEmail,
      payment_type: paymentType,
      provider,
      installments,
    });

    res.status(201).json(
      ApiResponse.success({
        paymentIntent: {
          paymentId: paymentIntent.payment_id,
          providerPaymentId: paymentIntent.provider_payment_id,
          clientSecret: paymentIntent.client_secret,
          amount,
          baseAmount,
          cardSurchargePercent,
          currency,
          type: paymentType,
          provider,
          qrCode: paymentIntent.qr_code,
          qrCodeBase64: paymentIntent.qr_code_base64,
          expiresAt: paymentIntent.expires_at,
          url: paymentIntent.url,
        },
        reservation: {
          id: reservationId,
          confirmationNumber: booking.reservation_number,
          finalPrice: Number(booking.final_price),
          depositAmount: Number(booking.deposit_amount),
          remainingAmount: Number(booking.remaining_amount),
          depositPaid: hasCompletedDeposit,
        },
      }, 'Payment intent creado exitosamente')
    );
  } catch (error) {
    logger.error('Error al crear payment intent', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
