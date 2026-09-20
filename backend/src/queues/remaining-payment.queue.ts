//
// Se encola UNA vez por reserva cuando se confirma el deposito (ver
// routes/payments/confirm-payment.ts), con delay hasta 7 dias antes del
// check-in (system_config / POLITICAS OPERATIVAS del Maestro). El
// worker crea el payment intent del saldo y dispara el primer
// recordatorio; remaining-payment-retries.queue.ts se encarga de los
// reintentos si no se paga.
//
// Limitacion real, no de este archivo: ni stripe-handler.ts ni
// mercado-pago-handler.ts guardan un metodo de pago reutilizable
// (setup_future_usage / customer de Stripe, o token off-session de
// MercadoPago) -- ver notas en remaining-payment-retries.queue.ts.

import { createSafeQueue } from './safe-queue';

export interface RemainingPaymentJobData {
  reservationId: string;
}

export const remainingPaymentQueue = createSafeQueue<RemainingPaymentJobData>('remaining-payment', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30_000 },
});

/** Encola el cobro de saldo para 7 dias antes del check-in (o de inmediato si esa fecha ya paso).
 *  Uso: reservas de hostel (camas). */
export async function scheduleRemainingPayment(reservationId: string, checkInDate: Date): Promise<void> {
  const sevenDaysBefore = new Date(checkInDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const delay = Math.max(0, sevenDaysBefore.getTime() - Date.now());
  // BullMQ no permite ":" en un jobId custom (lo usa como separador interno
  // de claves de Redis) -- "-" como separador.
  await remainingPaymentQueue.add('charge-remaining-balance', { reservationId }, { delay, jobId: `remaining-payment-${reservationId}` });
}

/** Encola el cobro del saldo de 70% para las 8:00 AM (hora São Paulo = UTC-3)
 *  del día de check-in. Uso exclusivo: apartamentos con antecedencia ≥48h
 *  (Cláusula 3.2 del Termo de Adesão v2.1). Brasil no usa horario de verano
 *  desde 2019, por lo que UTC-3 es fijo. */
export async function scheduleApartmentRemainingPayment(reservationId: string, checkInDate: Date): Promise<void> {
  // 8:00 AM São Paulo = 11:00 UTC (UTC-3 fijo)
  const checkInMorning = new Date(checkInDate);
  checkInMorning.setUTCHours(11, 0, 0, 0);
  const delay = Math.max(0, checkInMorning.getTime() - Date.now());
  await remainingPaymentQueue.add(
    'charge-remaining-balance',
    { reservationId },
    { delay, jobId: `remaining-payment-${reservationId}` }
  );
}
