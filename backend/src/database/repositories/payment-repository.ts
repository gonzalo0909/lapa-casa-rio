// lapa-casa-hostel/backend/src/database/repositories/payment-repository.ts
//
// FIX (auditoría 2026-08-30): reescrito de Prisma a SQL directo (pg) --
// mismo motivo que booking-repository.ts y guest-repository.ts. Se
// eliminaron 7 métodos sin ningún caller real (findByStripeIntent,
// findByMPId, findPending, findByDateRange, update, markSucceeded,
// getRevenueByDateRange) -- vestigios de una capa CRUD+analytics genérica
// que nadie llegó a usar.

import { query } from '../../config/database';
import type { Payment, PaymentProvider, PaymentStatus } from '../../types/database';

type LegacyPaymentMethod = 'card' | 'credit_card' | 'debit_card' | 'pix' | string;

function resolveProvider(paymentMethod?: LegacyPaymentMethod): 'stripe' | 'mercadopago' {
  if (!paymentMethod) {return 'stripe';}
  if (paymentMethod === 'pix') {return 'mercadopago';}
  return 'stripe';
}

export class PaymentRepository {
  async create(data: {
    reservation_id: string;
    guest_id?: string | null;
    amount: number;
    currency?: string;
    payment_method?: LegacyPaymentMethod;
    payment_type?: string;
    /** FIX (auditoría 2026-08-30): antes tipado solo 'stripe'|'mercadopago' --
     * más angosto que PaymentProvider (incluye 'cash'/'infinitypay', valores
     * reales del enum payment_provider en la DB), lo que rompía el type-check
     * de payment-service.createPaymentIntent() al pasar `provider` tal cual. */
    provider?: PaymentProvider;
    status?: PaymentStatus;
    stripe_payment_intent_id?: string | null;
    mp_payment_id?: string | null;
    provider_payment_id?: string | null;
    metadata?: any;
  }): Promise<Payment> {
    const provider = data.provider ?? resolveProvider(data.payment_method);
    const providerPaymentId =
      data.provider_payment_id ??
      data.stripe_payment_intent_id ??
      data.mp_payment_id ??
      null;
    const paymentType = data.payment_type ?? 'deposit';

    // Resolve guest_id from reservation if not provided
    let guestId = data.guest_id ?? null;
    if (!guestId) {
      const { rows } = await query<{ guest_id: string }>(
        `SELECT guest_id FROM reservations WHERE id = $1`,
        [data.reservation_id]
      );
      guestId = rows[0]?.guest_id ?? null;
    }
    if (!guestId) {throw new Error('Guest ID not found for reservation');}

    const { rows } = await query<Payment>(
      `INSERT INTO payments (
         reservation_id, guest_id, provider, payment_type, amount, currency,
         status, provider_payment_id, provider_metadata
       ) VALUES (
         $1, $2, $3::payment_provider, $4::payment_type, $5, $6,
         $7::payment_status, $8, $9::jsonb
       ) RETURNING *`,
      [
        data.reservation_id,
        guestId,
        provider,
        paymentType,
        data.amount,
        data.currency ?? 'BRL',
        data.status ?? 'pending',
        providerPaymentId,
        data.metadata !== undefined ? JSON.stringify(data.metadata) : null,
      ]
    );
    return rows[0];
  }

  async findById(id: string): Promise<Payment | null> {
    const { rows } = await query<Payment>(`SELECT * FROM payments WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    const { rows } = await query<Payment>(
      `SELECT * FROM payments WHERE provider_payment_id = $1 LIMIT 1`,
      [providerPaymentId]
    );
    return rows[0] ?? null;
  }

  async findByReservation(reservationId: string): Promise<Payment[]> {
    const { rows } = await query<Payment>(
      `SELECT * FROM payments WHERE reservation_id = $1 ORDER BY created_at ASC`,
      [reservationId]
    );
    return rows;
  }

  async markCompleted(id: string): Promise<Payment> {
    const { rows } = await query<Payment>(
      `UPDATE payments SET status = 'succeeded', paid_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows[0]) {throw new Error('Payment not found');}
    return rows[0];
  }

  async markFailed(id: string, failureReason?: string): Promise<Payment> {
    const { rows } = await query<Payment>(
      `UPDATE payments
       SET status = 'failed', failed_at = now(), failure_reason = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [failureReason ?? null, id]
    );
    if (!rows[0]) {throw new Error('Payment not found');}
    return rows[0];
  }

  async processRefund(id: string, refundAmount: number): Promise<Payment> {
    const { rows } = await query<Payment>(
      `UPDATE payments
       SET status = 'refunded', refund_amount = $1, refunded_at = now(), updated_at = now()
       WHERE id = $2 RETURNING *`,
      [refundAmount, id]
    );
    if (!rows[0]) {throw new Error('Payment not found');}
    return rows[0];
  }

  async getStatistics(): Promise<{
    totalPayments: number;
    completedPayments: number;
    failedPayments: number;
    totalRevenue: number;
    pendingAmount: number;
  }> {
    const { rows } = await query<{
      total: string; completed: string; failed: string; revenue: string; pending_amount: string;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'succeeded')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
         COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0)::float8 AS revenue,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::float8 AS pending_amount
       FROM payments`
    );
    const row = rows[0];
    return {
      totalPayments: Number(row.total),
      completedPayments: Number(row.completed),
      failedPayments: Number(row.failed),
      totalRevenue: Number(row.revenue),
      pendingAmount: Number(row.pending_amount),
    };
  }
}

export default new PaymentRepository();
