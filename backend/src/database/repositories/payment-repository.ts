// lapa-casa-hostel/backend/src/database/repositories/payment-repository.ts
// ventana3

import { query } from '../../config/database';
import type { Payment, PaymentStatus } from '../../types/database';

type LegacyPaymentMethod = 'card' | 'credit_card' | 'debit_card' | 'pix' | string;

function resolveProvider(paymentMethod?: LegacyPaymentMethod): 'stripe' | 'mercadopago' {
  if (!paymentMethod) return 'stripe';
  if (paymentMethod === 'pix') return 'mercadopago';
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
    provider?: 'stripe' | 'mercadopago';
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
    const providerMetadata = data.metadata ? JSON.stringify(data.metadata) : null;
    const paymentType = data.payment_type ?? 'deposit';

    const result = await query<Payment>(
      `INSERT INTO payments (
         reservation_id, guest_id, provider, payment_type, amount, currency, status,
         provider_payment_id, provider_metadata
       )
       VALUES (
         $1,
         COALESCE($2, (SELECT guest_id FROM reservations WHERE id = $1)),
         $3::payment_provider,
         $4::payment_type,
         $5,
         $6,
         $7::payment_status,
         $8,
         $9
       )
       RETURNING *, provider_metadata AS metadata`,
      [
        data.reservation_id,
        data.guest_id ?? null,
        provider,
        paymentType,
        data.amount,
        data.currency ?? 'BRL',
        data.status ?? 'pending',
        providerPaymentId,
        providerMetadata,
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Payment | null> {
    const result = await query<Payment>(
      `SELECT *, provider_metadata AS metadata FROM payments WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    const result = await query<Payment>(
      `SELECT *, provider_metadata AS metadata FROM payments
       WHERE provider_payment_id = $1 LIMIT 1`,
      [providerPaymentId]
    );
    return result.rows[0] ?? null;
  }

  async findByStripeIntent(stripePaymentIntentId: string): Promise<Payment | null> {
    const result = await query<Payment>(
      `SELECT *, provider_metadata AS metadata FROM payments
       WHERE provider = 'stripe' AND provider_payment_id = $1 LIMIT 1`,
      [stripePaymentIntentId]
    );
    return result.rows[0] ?? null;
  }

  async findByMPId(mpPaymentId: string): Promise<Payment | null> {
    const result = await query<Payment>(
      `SELECT *, provider_metadata AS metadata FROM payments
       WHERE provider = 'mercadopago' AND provider_payment_id = $1 LIMIT 1`,
      [mpPaymentId]
    );
    return result.rows[0] ?? null;
  }

  async findByReservation(reservationId: string): Promise<Payment[]> {
    const result = await query<Payment>(
      `SELECT *, provider_metadata AS metadata FROM payments
       WHERE reservation_id = $1 ORDER BY created_at ASC`,
      [reservationId]
    );
    return result.rows;
  }

  async findPending(): Promise<Payment[]> {
    const result = await query<Payment>(
      `SELECT *, provider_metadata AS metadata FROM payments
       WHERE status = 'pending'
         AND created_at >= NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
    const result = await query<Payment>(
      `SELECT *, provider_metadata AS metadata FROM payments
       WHERE status = 'completed'
         AND paid_at >= $1 AND paid_at <= $2
       ORDER BY paid_at DESC`,
      [startDate, endDate]
    );
    return result.rows;
  }

  async update(id: string, data: Partial<{
    status: PaymentStatus;
    provider_payment_id: string;
    provider_metadata: any;
    failure_reason: string;
    refund_amount: number;
    paid_at: Date;
    failed_at: Date;
    refunded_at: Date;
  }>): Promise<Payment> {
    const mapped: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === 'provider_metadata') {
        mapped[k] = typeof v === 'string' ? v : JSON.stringify(v);
      } else {
        mapped[k] = v;
      }
    }

    const fields = Object.keys(mapped);
    if (fields.length === 0) {
      const p = await this.findById(id);
      if (!p) throw new Error('Payment not found');
      return p;
    }
    const sets = fields.map((f, i) => {
      if (f === 'status') return `${f} = $${i + 2}::payment_status`;
      return `${f} = $${i + 2}`;
    }).join(', ');
    const values = fields.map(f => mapped[f]);
    const result = await query<Payment>(
      `UPDATE payments SET ${sets}, updated_at = NOW() WHERE id = $1
       RETURNING *, provider_metadata AS metadata`,
      [id, ...values]
    );
    return result.rows[0];
  }

  async markCompleted(id: string): Promise<Payment> {
    const result = await query<Payment>(
      `UPDATE payments
       SET status = 'succeeded', paid_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *, provider_metadata AS metadata`,
      [id]
    );
    return result.rows[0];
  }

  async markSucceeded(id: string): Promise<Payment> {
    return this.markCompleted(id);
  }

  async markFailed(id: string, failureReason?: string): Promise<Payment> {
    const result = await query<Payment>(
      `UPDATE payments
       SET status = 'failed', failed_at = NOW(), failure_reason = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *, provider_metadata AS metadata`,
      [id, failureReason ?? null]
    );
    return result.rows[0];
  }

  async processRefund(id: string, refundAmount: number): Promise<Payment> {
    const p = await this.findById(id);
    if (!p) throw new Error('Payment not found');
    const result = await query<Payment>(
      `UPDATE payments
       SET status = 'refunded', refund_amount = $2, refunded_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *, provider_metadata AS metadata`,
      [id, refundAmount]
    );
    return result.rows[0];
  }

  async getStatistics(): Promise<{
    totalPayments: number;
    completedPayments: number;
    failedPayments: number;
    totalRevenue: number;
    pendingAmount: number;
  }> {
    const result = await query<{
      total: string;
      completed: string;
      failed: string;
      revenue: string;
      pending_amount: string;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'succeeded')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
         COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0) AS revenue,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending_amount
       FROM payments`
    );
    const row = result.rows[0];
    return {
      totalPayments: parseInt(row.total, 10),
      completedPayments: parseInt(row.completed, 10),
      failedPayments: parseInt(row.failed, 10),
      totalRevenue: parseFloat(row.revenue),
      pendingAmount: parseFloat(row.pending_amount),
    };
  }

  async getRevenueByDateRange(startDate: Date, endDate: Date): Promise<number> {
    const result = await query<{ revenue: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS revenue FROM payments
       WHERE status = 'completed' AND paid_at >= $1 AND paid_at <= $2`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0].revenue);
  }
}

export default new PaymentRepository();
