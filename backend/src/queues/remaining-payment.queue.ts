// lapa-casa-hostel/backend/src/queues/remaining-payment.queue.ts
// ventana4
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
  attempts: 1
});

/** Encola el cobro de saldo para 7 dias antes del check-in (o de inmediato si esa fecha ya paso). */
export async function scheduleRemainingPayment(reservationId: string, checkInDate: Date): Promise<void> {
  const sevenDaysBefore = new Date(checkInDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const delay = Math.max(0, sevenDaysBefore.getTime() - Date.now());
  // BullMQ no permite ":" en un jobId custom (lo usa como separador interno
  // de claves de Redis) -- "-" como separador.
  await remainingPaymentQueue.add('charge-remaining-balance', { reservationId }, { delay, jobId: `remaining-payment-${reservationId}` });
}
