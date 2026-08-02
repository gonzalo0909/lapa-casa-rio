// lapa-casa-hostel/backend/src/database/models/payment.ts

import { pool } from '../../config/database';
import { Payment, PaymentProvider, PaymentType } from '../../types/database';

export class PaymentModel {
  static async createPayment(data: {
    reservation_id: string;
    guest_id: string;
    amount: number;
    currency?: string;
    payment_type: PaymentType;
    provider: PaymentProvider;
    provider_payment_id?: string;
    pix_qr_code?: string;
    pix_qr_code_base64?: string;
    pix_expires_at?: Date;
    stripe_client_secret?: string;
    metadata?: any;
  }): Promise<Payment> {
    const { rows } = await pool.query(
      `INSERT INTO payments (reservation_id, guest_id, provider, payment_type, amount, currency,
        provider_payment_id, pix_qr_code, pix_qr_code_base64, pix_expires_at, stripe_client_secret, status, metadata)
       VALUES ($1,$2,$3::payment_provider,$4::payment_type,$5,$6,$7,$8,$9,$10,$11,'pending',$12::jsonb)
       RETURNING *`,
      [data.reservation_id, data.guest_id, data.provider, data.payment_type, data.amount,
       data.currency||'BRL', data.provider_payment_id||null, data.pix_qr_code||null,
       data.pix_qr_code_base64||null, data.pix_expires_at||null, data.stripe_client_secret||null,
       JSON.stringify(data.metadata||{})]
    );
    return rows[0];
  }

  static async getPaymentById(id: string): Promise<Payment | null> {
    const { rows } = await pool.query(`SELECT * FROM payments WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  static async getPaymentsByReservation(reservationId: string): Promise<Payment[]> {
    const { rows } = await pool.query(`SELECT * FROM payments WHERE reservation_id = $1 ORDER BY created_at`, [reservationId]);
    return rows;
  }

  static async findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    const { rows } = await pool.query(`SELECT * FROM payments WHERE provider_payment_id = $1 LIMIT 1`, [providerPaymentId]);
    return rows[0] || null;
  }

  static async markSucceeded(id: string): Promise<Payment> {
    const { rows } = await pool.query(
      `UPDATE payments SET status = 'succeeded', paid_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`, [id]
    );
    return rows[0];
  }

  static async markFailed(id: string, reason?: string): Promise<Payment> {
    const { rows } = await pool.query(
      `UPDATE payments SET status = 'failed', failure_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, reason||null]
    );
    return rows[0];
  }

  static async processRefund(id: string, amount: number): Promise<Payment> {
    const payment = await this.getPaymentById(id);
    if (!payment) throw new Error('Payment not found');
    const isPartial = amount < Number(payment.amount);
    const { rows } = await pool.query(
      `UPDATE payments SET status = $1, refund_amount = $2, refunded_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [isPartial ? 'partially_refunded' : 'refunded', amount, id]
    );
    return rows[0];
  }

  static async getPendingPayments(): Promise<Payment[]> {
    const { rows } = await pool.query(
      `SELECT * FROM payments WHERE status = 'pending' AND created_at >= NOW() - INTERVAL '7 days' ORDER BY created_at DESC`
    );
    return rows;
  }

  static async getPaymentStats(): Promise<{
    totalPayments: number; succeededPayments: number; failedPayments: number;
    totalRevenue: number; pendingAmount: number;
  }> {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'succeeded') AS succeeded,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0) AS revenue,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS pending
      FROM payments
    `);
    return {
      totalPayments: Number(rows[0].total), succeededPayments: Number(rows[0].succeeded),
      failedPayments: Number(rows[0].failed), totalRevenue: Number(rows[0].revenue),
      pendingAmount: Number(rows[0].pending),
    };
  }
}
