//
// Reintentos del saldo restante: hasta 3 intentos, 24 h entre cada uno, mismo
// proveedor que el deposito. Cada intento se registra en `payment_retries`.
// Limitacion real: no hay cobro automatico off-session todavia, asi que un
// "reintento" es reenviar el recordatorio con el link de pago. Al agotar los 3
// intentos se avisa al administrador para resolucion manual.
//
// El estado vive en la base (pago de saldo sin pagar + filas de payment_retries),
// no en una cola: se consulta periodicamente quien tiene un intento vencido.

import { query } from '../config/database';
import bookingRepo from '../database/repositories/booking-repository';
import { notificationService } from '../services/notification-service';
import { emailService, type BookingWithGuest } from '../services/email-service';
import { logger } from '../utils/logger';

interface DueRetry {
  reservation_id: string;
  payment_id: string;
  provider: string;
  attempts_done: number;
}

async function runRetry(due: DueRetry): Promise<void> {
  const booking = await bookingRepo.findById(due.reservation_id);
  if (!booking || !booking.guest || booking.status !== 'confirmed') {
    return;
  }

  const attemptNumber = due.attempts_done + 1;
  const isLastAttempt = attemptNumber >= 3;
  await query(
    `INSERT INTO payment_retries (payment_id, attempt_number, provider, status, next_retry_at, failure_reason)
     VALUES ($1, $2, $3, 'failed', $4, $5)`,
    [
      due.payment_id,
      attemptNumber,
      due.provider,
      isLastAttempt ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
      'remaining_balance_unpaid_at_retry_check'
    ]
  );

  if (isLastAttempt) {
    await emailService.sendAdminAlert('PAYMENT_RETRIES_EXHAUSTED', {
      reservationNumber: booking.reservation_number,
      guestEmail: booking.guest.email,
      remainingAmount: booking.remaining_amount,
      provider: due.provider
    });
    logger.warn('remaining-payment-retries: 3 intentos agotados, escalado a admin-alert', { reservationId: due.reservation_id });
    return;
  }

  await notificationService.notify('payment_reminder', booking as BookingWithGuest);
}

export async function runRemainingPaymentRetries(): Promise<void> {
  const { rows } = await query<DueRetry>(
    `SELECT r.id AS reservation_id, p.id AS payment_id, p.provider::text AS provider,
            COALESCE(MAX(pr.attempt_number), 0)::int AS attempts_done
     FROM reservations r
     JOIN payments p ON p.reservation_id = r.id AND p.payment_type = 'remaining' AND p.status <> 'succeeded'
     LEFT JOIN payment_retries pr ON pr.payment_id = p.id
     WHERE r.status = 'confirmed'
     GROUP BY r.id, p.id, p.created_at, p.provider
     HAVING COALESCE(MAX(pr.attempt_number), 0) < 3
        AND COALESCE(MAX(pr.attempted_at), p.created_at) <= now() - INTERVAL '24 hours'`
  );

  for (const due of rows) {
    try {
      await runRetry(due);
    } catch (error: any) {
      logger.error('remaining-payment-retries: error en el reintento', { reservationId: due.reservation_id, error: error.message });
    }
  }
}
