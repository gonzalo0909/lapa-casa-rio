// lapa-casa-hostel/backend/src/database/repositories/payment-repository.ts
// ventana 3 — migrado a Prisma 5.22.0

import { prisma } from '../../config/prisma';
import type { Payment, PaymentStatus } from '../../types/database';

type LegacyPaymentMethod = 'card' | 'credit_card' | 'debit_card' | 'pix' | string;

function resolveProvider(paymentMethod?: LegacyPaymentMethod): 'stripe' | 'mercadopago' {
  if (!paymentMethod) return 'stripe';
  if (paymentMethod === 'pix') return 'mercadopago';
  return 'stripe';
}

function toPayment(row: any): Payment {
  return row as unknown as Payment;
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
    const paymentType = (data.payment_type ?? 'deposit') as 'deposit' | 'remaining';

    let guestId = data.guest_id ?? null;
    if (!guestId) {
      const reservation = await prisma.reservations.findUnique({
        where: { id: data.reservation_id },
        select: { guest_id: true },
      });
      guestId = reservation?.guest_id ?? null;
    }
    if (!guestId) throw new Error('Guest ID not found for reservation');

    const payment = await prisma.payments.create({
      data: {
        reservation_id: data.reservation_id,
        guest_id: guestId,
        provider: provider as any,
        payment_type: paymentType as any,
        amount: data.amount,
        currency: data.currency ?? 'BRL',
        status: (data.status ?? 'pending') as any,
        provider_payment_id: providerPaymentId,
        provider_metadata: data.metadata ?? undefined,
      },
    });
    return toPayment(payment);
  }

  async findById(id: string): Promise<Payment | null> {
    const payment = await prisma.payments.findUnique({ where: { id } });
    return payment ? toPayment(payment) : null;
  }

  async findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    const payment = await prisma.payments.findFirst({
      where: { provider_payment_id: providerPaymentId },
    });
    return payment ? toPayment(payment) : null;
  }

  async findByStripeIntent(stripePaymentIntentId: string): Promise<Payment | null> {
    const payment = await prisma.payments.findFirst({
      where: { provider: 'stripe', provider_payment_id: stripePaymentIntentId },
    });
    return payment ? toPayment(payment) : null;
  }

  async findByMPId(mpPaymentId: string): Promise<Payment | null> {
    const payment = await prisma.payments.findFirst({
      where: { provider: 'mercadopago', provider_payment_id: mpPaymentId },
    });
    return payment ? toPayment(payment) : null;
  }

  async findByReservation(reservationId: string): Promise<Payment[]> {
    const rows = await prisma.payments.findMany({
      where: { reservation_id: reservationId },
      orderBy: { created_at: 'asc' },
    });
    return rows.map(toPayment);
  }

  async findPending(): Promise<Payment[]> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await prisma.payments.findMany({
      where: { status: 'pending', created_at: { gte: cutoff } },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toPayment);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
    const rows = await prisma.payments.findMany({
      where: {
        status: 'succeeded',
        paid_at: { gte: startDate, lte: endDate },
      },
      orderBy: { paid_at: 'desc' },
    });
    return rows.map(toPayment);
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
    if (Object.keys(data).length === 0) {
      const p = await this.findById(id);
      if (!p) throw new Error('Payment not found');
      return p;
    }
    const payment = await prisma.payments.update({
      where: { id },
      data: { ...data, updated_at: new Date() } as any,
    });
    return toPayment(payment);
  }

  async markCompleted(id: string): Promise<Payment> {
    const payment = await prisma.payments.update({
      where: { id },
      data: { status: 'succeeded', paid_at: new Date(), updated_at: new Date() },
    });
    return toPayment(payment);
  }

  async markSucceeded(id: string): Promise<Payment> {
    return this.markCompleted(id);
  }

  async markFailed(id: string, failureReason?: string): Promise<Payment> {
    const payment = await prisma.payments.update({
      where: { id },
      data: {
        status: 'failed',
        failed_at: new Date(),
        failure_reason: failureReason ?? null,
        updated_at: new Date(),
      },
    });
    return toPayment(payment);
  }

  async processRefund(id: string, refundAmount: number): Promise<Payment> {
    const p = await this.findById(id);
    if (!p) throw new Error('Payment not found');
    const payment = await prisma.payments.update({
      where: { id },
      data: {
        status: 'refunded',
        refund_amount: refundAmount,
        refunded_at: new Date(),
        updated_at: new Date(),
      },
    });
    return toPayment(payment);
  }

  async getStatistics(): Promise<{
    totalPayments: number;
    completedPayments: number;
    failedPayments: number;
    totalRevenue: number;
    pendingAmount: number;
  }> {
    const rows = await prisma.$queryRaw<[{
      total: number;
      completed: number;
      failed: number;
      revenue: number;
      pending_amount: number;
    }]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'succeeded')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0)::float8 AS revenue,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::float8 AS pending_amount
      FROM payments
    `;
    const row = rows[0];
    return {
      totalPayments: Number(row.total),
      completedPayments: Number(row.completed),
      failedPayments: Number(row.failed),
      totalRevenue: Number(row.revenue),
      pendingAmount: Number(row.pending_amount),
    };
  }

  async getRevenueByDateRange(startDate: Date, endDate: Date): Promise<number> {
    const rows = await prisma.$queryRaw<[{ revenue: number }]>`
      SELECT COALESCE(SUM(amount), 0)::float8 AS revenue FROM payments
      WHERE status = 'succeeded' AND paid_at >= ${startDate} AND paid_at <= ${endDate}
    `;
    return Number(rows[0].revenue);
  }
}

export default new PaymentRepository();
