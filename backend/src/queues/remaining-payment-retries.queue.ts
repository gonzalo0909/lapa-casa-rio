// lapa-casa-hostel/backend/src/queues/remaining-payment-retries.queue.ts
// ventana4
//
// Reintentos del saldo restante: 3 intentos, 24h de separacion, mismo
// proveedor que el deposito (POLITICAS OPERATIVAS del Maestro). Cada
// intento se registra en la tabla real `payment_retries`
// (attempt_number 1-3, provider, status) via el worker.
//
// Limitacion real y deliberada: ni StripeHandler ni MercadoPagoHandler
// (src/lib/payments/) implementan un metodo de pago guardado para cobro
// off-session (Stripe: setup_future_usage + Customer; MercadoPago: token
// de tarjeta guardado) -- esa infraestructura no existe todavia en el
// repo. Por eso un "reintento" aca es: verificar si el pago ya se
// completo y, si no, reenviar el recordatorio con un link de pago activo
// (el huesped tiene que volver a interactuar). Es coherente con el
// estado real de Ventana 3 (pagos no probados end-to-end, ver
// prompts/combo-VENTANA-4-completa.md, CONTEXTO PREVIO). Agregar cobro
// automatico silencioso es trabajo de Ventana 3, no de esta cola.
//
// Al agotar los 3 intentos, se escala con un admin-alert (resolucion
// manual) -- eso si esta completo, no es una limitacion.

import { createSafeQueue } from './safe-queue';

export interface RemainingPaymentRetryJobData {
  reservationId: string;
  attemptNumber: 1 | 2 | 3;
}

export const remainingPaymentRetriesQueue = createSafeQueue<RemainingPaymentRetryJobData>('remaining-payment-retries', {
  attempts: 1
});

export async function scheduleNextRetry(reservationId: string, attemptNumber: 1 | 2 | 3): Promise<void> {
  await remainingPaymentRetriesQueue.add(
    'check-remaining-payment',
    { reservationId, attemptNumber },
    // BullMQ no permite ":" en un jobId custom -- "-" como separador.
    { delay: 24 * 60 * 60 * 1000, jobId: `remaining-payment-retry-${reservationId}-${attemptNumber}` }
  );
}
