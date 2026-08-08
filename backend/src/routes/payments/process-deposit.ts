// lapa-casa-hostel/backend/src/routes/payments/process-deposit.ts
// ventana3

import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

/** Stripe cobra una comision real por pago con tarjeta que PIX (Mercado Pago) no tiene -- se suma al monto que paga el huesped, editable en /admin/pricing.html (system_config.card_surcharge_percent) para que el dueño la ajuste si Stripe cambia sus tarifas, sin depender de un deploy. */
async function getCardSurchargePercent(): Promise<number> {
  const { rows } = await query<{ value: number }>(
    `SELECT value FROM system_config WHERE key = 'card_surcharge_percent'`
  );
  return rows[0]?.value ?? 0;
}

interface ProcessDepositRequest {
  reservationId: string;
  provider: 'stripe' | 'mercadopago';
  installments?: number;
}

export const processDepositHandler = async (
  req: Request<{}, {}, ProcessDepositRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId, provider, installments = 1 } = req.body;

    logger.info('Procesando depósito', { reservationId, provider });

    const booking = await bookingService.getBooking(reservationId);

    if (!booking) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada', { reservationId }));
      return;
    }

    if (booking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('No se puede procesar el depósito de una reserva cancelada'));
      return;
    }

    if (booking.status === 'completed') {
      res.status(400).json(ApiResponse.error('La reserva ya está completada'));
      return;
    }

    const existingPayments = await paymentService.getPaymentsByReservation(reservationId);
    const depositPayment = existingPayments.find(
      p => p.payment_type === 'deposit' && p.status === 'succeeded'
    );

    if (depositPayment) {
      res.status(409).json(
        ApiResponse.error('El depósito ya fue pagado', {
          paymentId: depositPayment.id,
          paidAt: depositPayment.paid_at,
        })
      );
      return;
    }

    const bedsCount = booking.beds_count ?? 0;
    const depositPercentage = bedsCount >= 15 ? 0.50 : 0.30;
    const depositAmount = Number(booking.deposit_amount);

    // El recargo solo aplica a tarjeta (Stripe cobra comisión real); PIX
    // via Mercado Pago no la tiene, así que ahí se cobra el monto justo.
    const cardSurchargePercent = provider === 'stripe' ? await getCardSurchargePercent() : 0;
    const chargedAmount = Math.round(depositAmount * (1 + cardSurchargePercent / 100) * 100) / 100;

    logger.info('Cálculo de depósito', { reservationId, bedsCount, depositPercentage, depositAmount, cardSurchargePercent, chargedAmount });

    // Depósito sin reintento: si falla, lanzará excepción y la reserva queda en pending_payment
    const paymentIntent = await paymentService.createPaymentIntent({
      reservation_id: reservationId,
      guest_id: booking.guest_id,
      amount: chargedAmount,
      baseAmount: depositAmount,
      currency: 'BRL',
      guest_email: booking.guest?.email ?? '',
      payment_type: 'deposit',
      provider,
      installments,
    });

    logger.info('Depósito creado', { paymentId: paymentIntent.payment_id });

    res.status(200).json(
      ApiResponse.success({
        payment: {
          paymentId: paymentIntent.payment_id,
          type: 'deposit',
          amount: chargedAmount,
          baseAmount: depositAmount,
          cardSurchargePercent,
          currency: 'BRL',
          status: 'pending',
          provider,
          clientSecret: paymentIntent.client_secret,
          qrCode: paymentIntent.qr_code,
          qrCodeBase64: paymentIntent.qr_code_base64,
          expiresAt: paymentIntent.expires_at,
        },
        depositInfo: {
          percentage: depositPercentage * 100,
          amount: depositAmount,
          bedsCount,
          groupSize: bedsCount >= 15 ? 'large' : 'standard',
        },
        paymentSchedule: {
          deposit: { amount: depositAmount, percentage: depositPercentage * 100, status: 'pending' },
          remaining: { amount: Number(booking.remaining_amount), percentage: (1 - depositPercentage) * 100, status: 'pending' },
          total: { amount: Number(booking.final_price), currency: 'BRL' },
        },
      }, 'Depósito iniciado exitosamente')
    );
  } catch (error) {
    logger.error('Error al procesar depósito', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
