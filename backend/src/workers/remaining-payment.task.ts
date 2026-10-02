//
// Cobro del 70% de apartamentos (Clausula 3.2): a partir de las 8:00 (hora de Sao
// Paulo) del dia del check-in, crea el payment intent del saldo con el MISMO
// proveedor que el deposito (sin fallback cross-provider) y manda el recordatorio
// con el link de pago. Los reintentos los maneja remaining-payment-retries.task.ts.
//
// Antes cada reserva dejaba un job con delay en Redis; ahora se consulta la base
// (reserva confirmada, apartamento, con saldo, estancia en curso, sin ningun pago
// de saldo registrado), asi no hace falta ninguna cola ni consulta constante a Redis.
// Si el worker estuvo caido a las 8:00, el proximo ciclo la cobra mientras dure la estancia.

import { query } from '../config/database';
import bookingRepo from '../database/repositories/booking-repository';
import { paymentService } from '../services/payment-service';
import { notificationService } from '../services/notification-service';
import { logger } from '../utils/logger';
import type { BookingWithGuest } from '../services/email-service';

async function chargeRemainingBalance(reservationId: string): Promise<void> {
  const booking = await bookingRepo.findById(reservationId);

  if (!booking || !booking.guest) {
    logger.warn('remaining-payment: reserva o guest no encontrado, se omite', { reservationId });
    return;
  }
  if (booking.status !== 'confirmed') {
    logger.info('remaining-payment: reserva ya no está confirmed, se omite', { reservationId, status: booking.status });
    return;
  }
  if (Number(booking.remaining_amount) <= 0) {
    logger.info('remaining-payment: sin saldo pendiente, se omite', { reservationId });
    return;
  }

  const existingPayments = await paymentService.getPaymentsByReservation(reservationId);
  if (existingPayments.some(p => p.payment_type === 'remaining')) {
    logger.info('remaining-payment: ya existe un pago de saldo, se omite', { reservationId });
    return;
  }

  const depositPayment = existingPayments.find(p => p.payment_type === 'deposit' && p.status === 'succeeded');
  const provider = depositPayment?.provider ?? 'stripe';

  await paymentService.createPaymentIntent({
    reservation_id: reservationId,
    guest_id: booking.guest.id,
    amount: Number(booking.remaining_amount),
    guest_email: booking.guest.email,
    payment_type: 'remaining',
    provider
  });

  await notificationService.notify('payment_reminder', booking as BookingWithGuest);

  logger.info('remaining-payment: payment intent creado y recordatorio enviado', { reservationId, provider });
}

export async function runRemainingPaymentCharges(): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `SELECT r.id
     FROM reservations r
     WHERE r.status = 'confirmed'
       AND r.remaining_amount > 0
       AND r.check_in_date::date <= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
       AND r.check_out_date::date >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
       AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo')) >= 8
       AND EXISTS (
         SELECT 1 FROM reservation_beds rb JOIN room_types rt ON rt.id = rb.room_type_id
         WHERE rb.reservation_id = r.id AND rt.property_type = 'apartment'
       )
       AND NOT EXISTS (
         SELECT 1 FROM payments p WHERE p.reservation_id = r.id AND p.payment_type = 'remaining'
       )`
  );

  for (const row of rows) {
    try {
      await chargeRemainingBalance(row.id);
    } catch (error: any) {
      logger.error('remaining-payment: error cobrando el saldo', { reservationId: row.id, error: error.message });
    }
  }
}
