// lapa-casa-hostel/backend/src/database/models/payment.ts
// ventana 1 — migrado a Prisma 5.22.0

import { prisma } from '../../config/prisma';
import { Payment, PaymentProvider } from '../../types/database';

function toPayment(row: any): Payment {
  return row as unknown as Payment;
}

export class PaymentModel {
  static async createPayment(data: {
    reservation_id: string;
    guest_id: string;
    amount: number;
    currency?: string;
    payment_type: 'deposit' | 'remaining';
    provider: PaymentProvider;
    provider_payment_id?: string;
    metadata?: any;
  }): Promise<Payment> {
    const payment = await prisma.payments.create({
      data: {
        reservation_id: data.reservation_id,
        guest_id: data.guest_id,
        provider: data.provider,
        payment_type: data.payment_type,
        amount: data.amount,
        currency: data.currency ?? 'BRL',
        status: 'pending',
        provider_payment_id: data.provider_payment_id ?? null,
        provider_metadata: data.metadata ?? undefined,
      },
    });
    return toPayment(payment);
  }

  static async getPaymentById(id: string): Promise<Payment | null> {
    const payment = await prisma.payments.findUnique({ where: { id } });
    return payment ? toPayment(payment) : null;
  }

  static async getPaymentsByReservation(reservationId: string): Promise<Payment[]> {
    const rows = await prisma.payments.findMany({
      where: { reservation_id: reservationId },
      orderBy: { created_at: 'asc' },
    });
    return rows.map(toPayment);
  }

  static async findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    const payment = await prisma.payments.findFirst({
      where: { provider_payment_id: providerPaymentId },
    });
    return payment ? toPayment(payment) : null;
  }

  static async markSucceeded(id: string): Promise<Payment> {
    const payment = await prisma.payments.update({
      where: { id },
      data: { status: 'succeeded', paid_at: new Date(), updated_at: new Date() },
    });
    return toPayment(payment);
  }

  static async markFailed(id: string, reason?: string): Promise<Payment> {
    const payment = await prisma.payments.update({
      where: { id },
      data: { status: 'failed', failure_reason: reason ?? null, updated_at: new Date() },
    });
    return toPayment(payment);
  }

  static async processRefund(id: string, amount: number): Promise<Payment> {
    const existing = await this.getPaymentById(id);
    if (!existing) throw new Error('Payment not found');
    const isPartial = amount < Number(existing.amount);
    const payment = await prisma.payments.update({
      where: { id },
      data: {
        status: isPartial ? 'partially_refunded' : 'refunded',
        refund_amount: amount,
        refunded_at: new Date(),
        updated_at: new Date(),
      },
    });
    return toPayment(payment);
  }

  static async getPendingPayments(): Promise<Payment[]> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await prisma.payments.findMany({
      where: {
        status: 'pending',
        created_at: { gte: cutoff },
      },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toPayment);
  }

  static async getPaymentStats(): Promise<{
    totalPayments: number;
    succeededPayments: number;
    failedPayments: number;
    totalRevenue: number;
    pendingAmount: number;
  }> {
    const rows = await prisma.$queryRaw<[{
      total: number;
      succeeded: number;
      failed: number;
      revenue: number;
      pending: number;
    }]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0)::float8 AS revenue,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::float8 AS pending
      FROM payments
    `;
    return {
      totalPayments: Number(rows[0].total),
      succeededPayments: Number(rows[0].succeeded),
      failedPayments: Number(rows[0].failed),
      totalRevenue: Number(rows[0].revenue),
      pendingAmount: Number(rows[0].pending),
    };
  }
}
