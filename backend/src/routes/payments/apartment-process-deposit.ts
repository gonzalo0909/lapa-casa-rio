// backend/src/routes/payments/apartment-process-deposit.ts
// Depósito para reservas de apartamento — totalmente separado del flujo del hostel.
// Lee deposit_percent directo de la reserva (sin calcular por número de camas).

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

interface ApartmentProcessDepositRequest {
  reservationId: string;
  provider: 'stripe' | 'mercadopago';
  installments?: number;
}

export const apartmentProcessDepositHandler = async (
  req: Request<{}, {}, ApartmentProcessDepositRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reservationId, provider, installments = 1 } = req.body;

    logger.info('Procesando depósito apartamento', { reservationId, provider });

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
      p => p.payment_type === 'deposit' &&
           ['succeeded', 'pending', 'in_process'].includes(p.status)
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

    // Para pagos Stripe, verificar que el propietario del apartamento tenga
    // Stripe Connect activo. Si no, el dinero iría a la cuenta plataforma sin
    // ruteo correcto — mejor fallar aquí con un mensaje claro.
    if (provider === 'stripe') {
      const { rows: connectRows } = await query(
        `SELECT ao.stripe_account_id, ao.onboarding_status
         FROM reservation_beds rb
         JOIN beds b ON b.id = rb.bed_id
         JOIN room_types rt ON rt.id = b.room_type_id
         JOIN apartment_owners ao ON ao.id = rt.owner_id
         WHERE rb.reservation_id = $1
           AND rt.property_type = 'apartment'
         LIMIT 1`,
        [reservationId]
      );
      if (connectRows.length > 0) {
        const owner = connectRows[0];
        if (!owner.stripe_account_id || owner.onboarding_status !== 'active') {
          res.status(503).json(ApiResponse.error(
            'El pago con tarjeta no está disponible para este apartamento en este momento. ' +
            'Por favor usá PIX o contactá con el establecimiento.'
          ));
          return;
        }
      }
    }

    const depositAmount = Number(booking.deposit_amount);
    const depositPercentage = Number(booking.deposit_percent ?? 0.30);

    const cardSurchargePercent = provider === 'stripe' ? await getCardSurchargePercent() : 0;
    const chargedAmount = Math.round(depositAmount * (1 + cardSurchargePercent / 100) * 100) / 100;

    const appUrl = process.env.APP_URL ?? 'https://api.lapacasario.com';
    const notificationUrl = provider === 'mercadopago'
      ? `${appUrl}/api/v1/payments/apartments/webhook/mercadopago`
      : undefined;

    logger.info('Cálculo de depósito apartamento', {
      reservationId, depositPercentage, depositAmount, cardSurchargePercent, chargedAmount,
    });

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
      notificationUrl,
    });

    logger.info('Depósito apartamento creado', { paymentId: paymentIntent.payment_id });

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
        },
        paymentSchedule: {
          deposit: { amount: depositAmount, percentage: depositPercentage * 100, status: 'pending' },
          remaining: { amount: Number(booking.remaining_amount), percentage: (1 - depositPercentage) * 100, status: 'pending' },
          total: { amount: Number(booking.final_price), currency: 'BRL' },
        },
      }, 'Depósito apartamento iniciado exitosamente')
    );
  } catch (error) {
    logger.error('Error al procesar depósito apartamento', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
