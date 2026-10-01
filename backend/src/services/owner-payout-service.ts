// Pago a administradores de apartamentos.
//
// Flujo de dinero (la plataforma cobra todo en su cuenta Stripe, sin destination charge):
//   - Depósito online (30%): 5% comisión Lapa Casa + 25% garantía retenida en Stripe.
//   - Check-in: el huésped paga el 70% restante en InfinityPay (no pasa por acá).
//   - Después del check-out + período de espera (protege contra golpes/estafas):
//     la garantía retenida (25%) se transfiere AUTOMÁTICAMENTE al administrador,
//     menos la tasa de payout (apartment_owners.payout_fee_rate).

import { query } from '../config/database';
import { stripeConnectHandler } from '../lib/payments/stripe-connect';
import { auditLogService } from './audit-log-service';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import { emailService } from './email-service';

/** Horas de espera después del check-out antes de pagar al administrador. */
const DEFAULT_HOLD_HOURS = 48;

/** Intentos fallidos de transferencia por reserva antes de dejar de reintentar y alertar. */
const MAX_PAYOUT_ATTEMPTS = 5;

export interface ReleaseResult {
  transferId: string;
  stripeTransferId: string;
  reservationId: string;
  ownerId: string;
  ownerName: string;
  heldAmount: number;
  payoutFeeAmount: number;
  adminNetAmount: number;
}

async function getHoldHours(): Promise<number> {
  const { rows } = await query<{ value: number }>(
    `SELECT value FROM system_config WHERE key = 'owner_payout_hold_hours'`
  );
  const v = Number(rows[0]?.value);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_HOLD_HOURS;
}

/**
 * Transfiere la garantía retenida de UNA reserva al administrador.
 * Con `enforceHold: true` (job automático) exige que haya pasado el período
 * de espera post check-out; el endpoint manual de admin puede saltearlo.
 */
export async function releaseHeldDeposit(
  reservationId: string,
  opts: { enforceHold: boolean }
): Promise<ReleaseResult> {
  const { rows } = await query(
    `SELECT r.id, r.reservation_number, r.status, r.deposit_amount,
            r.check_out_date, r.checked_out_at,
            ao.id AS owner_id, ao.full_name AS owner_name, ao.stripe_account_id,
            ao.onboarding_status, ao.payout_fee_rate
       FROM reservations r
       JOIN reservation_beds rb ON rb.reservation_id = r.id
       JOIN beds b ON b.id = rb.bed_id
       JOIN room_types rt ON rt.id = b.room_type_id
       LEFT JOIN apartment_owners ao ON ao.id = rt.owner_id
      WHERE r.id = $1 AND rt.property_type = 'apartment'
      LIMIT 1`,
    [reservationId]
  );
  if (rows.length === 0) {
    throw new AppError('Reserva no encontrada o no es de tipo apartamento', 404);
  }
  const r = rows[0];

  // 'completed' = estadía terminada (check-out). 'no_show': el admin retiene las arras (Cláusula 5.4).
  if (r.status !== 'completed' && r.status !== 'no_show') {
    throw new AppError(
      `No se puede pagar al administrador: la reserva está en estado "${r.status}". ` +
      'Debe estar completada (check-out hecho) o no-show.',
      400
    );
  }
  if (!r.owner_id) {
    throw new AppError('Este apartamento no tiene administrador asignado', 400);
  }
  if (!r.stripe_account_id || r.onboarding_status !== 'active') {
    throw new AppError(
      'El administrador aún no completó su registro bancario en Stripe ' +
      `(estado: "${r.onboarding_status}")`,
      400
    );
  }

  if (opts.enforceHold) {
    const holdHours = await getHoldHours();
    const base = r.checked_out_at ? new Date(r.checked_out_at) : new Date(`${new Date(r.check_out_date).toISOString().slice(0, 10)}T14:00:00Z`);
    if (Date.now() < base.getTime() + holdHours * 3600 * 1000) {
      throw new AppError('Aún dentro del período de espera post check-out', 409);
    }
  }

  const heldAmount = parseFloat((parseFloat(r.deposit_amount) * (25 / 30)).toFixed(2));
  const { payoutFeeAmount, adminNetAmount } = stripeConnectHandler.calculateAdminAmount({
    finalPrice: heldAmount,
    commissionRate: 0, // el 5% de Lapa Casa ya quedó retenido del depósito
    payoutFeeRate: parseFloat(r.payout_fee_rate),
  });
  if (adminNetAmount <= 0) {
    throw new AppError('El monto a transferir es cero', 400);
  }

  // Idempotencia: la fila 'pending' bloquea doble pago aun con jobs concurrentes
  // (índice único parcial recomendado sobre (reservation_id, transfer_kind) WHERE status IN ('pending','succeeded')).
  const { rows: existing } = await query(
    `SELECT id FROM owner_transfers
      WHERE reservation_id = $1 AND transfer_kind = 'held_25' AND status IN ('succeeded','pending')`,
    [reservationId]
  );
  if (existing.length > 0) {
    throw new AppError('El depósito retenido ya fue liberado (o está en proceso) para esta reserva', 409);
  }

  let transferRecordId: string;
  try {
    const { rows: tr } = await query(
      `INSERT INTO owner_transfers (reservation_id, owner_id, amount, currency, transfer_kind, status)
       VALUES ($1, $2, $3, 'BRL', 'held_25', 'pending') RETURNING id`,
      [reservationId, r.owner_id, adminNetAmount]
    );
    transferRecordId = tr[0].id;
  } catch (err: any) {
    // 23505 = índice único uq_owner_transfers_held25_live: otro proceso ya tomó esta reserva
    if (err?.code === '23505') {
      throw new AppError('El depósito retenido ya fue liberado (o está en proceso) para esta reserva', 409);
    }
    throw err;
  }

  let stripeTransferId: string;
  try {
    const t = await stripeConnectHandler.createTransfer({
      amount: adminNetAmount,
      destinationAccountId: r.stripe_account_id,
      reservationId,
      description: `Garantía retenida — Reserva ${r.reservation_number}`,
      metadata: { transfer_kind: 'held_25', transfer_record_id: transferRecordId },
    });
    stripeTransferId = t.transferId;
  } catch (err: any) {
    await query(
      `UPDATE owner_transfers SET status = 'failed', error_message = $1, updated_at = now() WHERE id = $2`,
      [err.message, transferRecordId]
    );
    throw new AppError(`Error al crear el Transfer en Stripe: ${err.message}`, 502);
  }

  await query(
    `UPDATE owner_transfers
        SET status = 'succeeded', stripe_transfer_id = $1, transferred_at = now(), updated_at = now()
      WHERE id = $2`,
    [stripeTransferId, transferRecordId]
  );

  await auditLogService.log({
    entity_type: 'owner_transfer',
    entity_id: transferRecordId,
    operation: 'RELEASE_HELD_DEPOSIT',
    reservation_id: reservationId,
    new_data: { ownerId: r.owner_id, ownerName: r.owner_name, heldAmount, adminNetAmount, payoutFeeAmount, stripeTransferId },
  });

  logger.info('Garantía retenida transferida al administrador', { reservationId, stripeTransferId, adminNetAmount });
  return {
    transferId: transferRecordId, stripeTransferId, reservationId,
    ownerId: r.owner_id, ownerName: r.owner_name, heldAmount, payoutFeeAmount, adminNetAmount,
  };
}

/**
 * Job automático: paga a los administradores de todas las reservas de apartamento
 * ya terminadas cuyo período de espera venció. Los errores de una reserva no
 * frenan a las demás (un admin sin onboarding queda para el próximo ciclo).
 */
export async function releaseDueOwnerPayouts(): Promise<{ released: number; skipped: number }> {
  const holdHours = await getHoldHours();
  const { rows } = await query<{ id: string }>(
    `SELECT DISTINCT r.id
       FROM reservations r
       JOIN reservation_beds rb ON rb.reservation_id = r.id
       JOIN beds b ON b.id = rb.bed_id
       JOIN room_types rt ON rt.id = b.room_type_id
       JOIN apartment_owners ao ON ao.id = rt.owner_id
      WHERE rt.property_type = 'apartment'
        AND r.status IN ('completed', 'no_show')
        AND ao.onboarding_status = 'active'
        AND ao.stripe_account_id IS NOT NULL
        AND COALESCE(r.checked_out_at, r.check_out_date::timestamptz) + make_interval(hours => $1) <= now()
        AND NOT EXISTS (
          SELECT 1 FROM owner_transfers ot
           WHERE ot.reservation_id = r.id AND ot.transfer_kind = 'held_25'
             AND ot.status IN ('succeeded', 'pending')
        )
        AND (
          SELECT COUNT(*) FROM owner_transfers ot
           WHERE ot.reservation_id = r.id AND ot.transfer_kind = 'held_25' AND ot.status = 'failed'
        ) < $2
      LIMIT 100`,
    [holdHours, MAX_PAYOUT_ATTEMPTS]
  );

  let released = 0;
  let skipped = 0;
  for (const { id } of rows) {
    try {
      await releaseHeldDeposit(id, { enforceHold: true });
      released++;
    } catch (err: any) {
      skipped++;
      logger.warn('Pago automático a administrador omitido', { reservationId: id, error: err.message });
      await alertIfAttemptsExhausted(id, err.message);
    }
  }
  return { released, skipped };
}

/** Al llegar al tope de intentos fallidos avisa al admin UNA vez (el job deja de reintentar esa reserva). */
async function alertIfAttemptsExhausted(reservationId: string, lastError: string): Promise<void> {
  try {
    const { rows } = await query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM owner_transfers
        WHERE reservation_id = $1 AND transfer_kind = 'held_25' AND status = 'failed'`,
      [reservationId]
    );
    if (Number(rows[0]?.n) === MAX_PAYOUT_ATTEMPTS) {
      await emailService.sendAdminAlert('OWNER_PAYOUT_FAILED', {
        reservationId,
        attempts: MAX_PAYOUT_ATTEMPTS,
        lastError,
        action: 'Revisar el registro bancario del administrador y usar POST /payments/release-deposit',
      });
    }
  } catch (err: any) {
    logger.error('No se pudo enviar la alerta de pago fallido al administrador', { reservationId, error: err.message });
  }
}
