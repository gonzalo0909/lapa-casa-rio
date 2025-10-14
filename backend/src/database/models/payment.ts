// lapa-casa-hostel/backend/src/database/models/payment.ts

import { PrismaClient, Payment, PaymentStatus, PaymentType, PaymentProvider, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class PaymentModel {
  static async createPayment(data: {
    bookingId: string;
    amount: number;
    currency?: string;
    paymentType: PaymentType;
    provider: PaymentProvider;
    paymentMethod: string;
    cardBrand?: string;
    cardLast4?: string;
    installments?: number;
    installmentAmount?: number;
    stripePaymentIntentId?: string;
    mpPaymentId?: string;
    mpPreferenceId?: string;
    pixQrCode?: string;
    pixQrCodeBase64?: string;
    pixExpiresAt?: Date;
    metadata?: any;
  }): Promise<Payment> {
    const paymentNumber = await this.generatePaymentNumber();

    return await prisma.payment.create({
      data: {
        ...data,
        paymentNumber,
        status: PaymentStatus.PENDING,
        currency: data.currency || 'BRL'
      },
      include: { booking: true }
    });
  }

  static async generatePaymentNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;

    const lastPayment = await prisma.payment.findFirst({
      where: { paymentNumber: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' }
    });

    let sequence = 1;
    if (lastPayment) {
      const lastNumber = parseInt(lastPayment.paymentNumber.split('-')[2]);
      sequence = lastNumber + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  static async getPaymentById(paymentId: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { guest: true, room: true } } }
    });
  }

  static async getPaymentByNumber(paymentNumber: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { paymentNumber },
      include: { booking: { include: { guest: true } } }
    });
  }

  static async getPaymentByStripeIntent(stripePaymentIntentId: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { stripePaymentIntentId },
      include: { booking: true }
    });
  }

  static async getPaymentByMPId(mpPaymentId: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { mpPaymentId },
      include: { booking: true }
    });
  }

  static async getPaymentsByBooking(bookingId: string): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<Payment> {
    const updateData: any = { status };

    if (status === PaymentStatus.SUCCEEDED) {
      updateData.paidAt = new Date();
    } else if (status === PaymentStatus.FAILED) {
      updateData.failedAt = new Date();
    } else if (status === PaymentStatus.REFUNDED) {
      updateData.refundedAt = new Date();
    }

    return await prisma.payment.update({
      where: { id: paymentId },
      data: updateData
    });
  }

  static async markPaymentSucceeded(paymentId: string, metadata?: any): Promise<Payment> {
    return await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date(),
        metadata
      }
    });
  }

  static async markPaymentFailed(
    paymentId: string,
    failureReason?: string,
    failureCode?: string
  ): Promise<Payment> {
    const payment = await this.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment not found');

    return await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        failureReason,
        failureCode,
        retryAttempts: payment.retryAttempts + 1
      }
    });
  }

  static async schedulePaymentRetry(paymentId: string, nextRetryAt: Date): Promise<Payment> {
    return await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PENDING,
        nextRetryAt
      }
    });
  }

  static async processRefund(
    paymentId: string,
    refundAmount: number,
    refundReason?: string
  ): Promise<Payment> {
    const payment = await this.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment not found');

    const isPartialRefund = refundAmount < Number(payment.amount);

    return await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: isPartialRefund ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundAmount,
        refundReason
      }
    });
  }

  static async updateStripeDetails(
    paymentId: string,
    stripePaymentIntentId: string,
    stripeChargeId?: string
  ): Promise<Payment> {
    return await prisma.payment.update({
      where: { id: paymentId },
      data: {
        stripePaymentIntentId,
        stripeChargeId
      }
    });
  }

  static async updateMercadoPagoDetails(
    paymentId: string,
    mpPaymentId: string,
    mpPreferenceId?: string
  ): Promise<Payment> {
    return await prisma.payment.update({
      where: { id: paymentId },
      data: {
        mpPaymentId,
        mpPreferenceId
      }
    });
  }

  static async updatePixDetails(
    paymentId: string,
    pixQrCode: string,
    pixQrCodeBase64: string,
    pixExpiresAt: Date
  ): Promise<Payment> {
    return await prisma.payment.update({
      where: { id: paymentId },
      data: {
        pixQrCode,
        pixQrCodeBase64,
        pixExpiresAt
      }
    });
  }

  static async getPendingPayments(): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      include: { booking: { include: { guest: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getFailedPaymentsForRetry(): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: {
        status: PaymentStatus.FAILED,
        retryAttempts: { lt: 3 },
        nextRetryAt: { lte: new Date() }
      },
      include: { booking: { include: { guest: true } } }
    });
  }

  static async getPaymentStats(): Promise<{
    totalPayments: number;
    succeededPayments: number;
    failedPayments: number;
    totalRevenue: number;
    pendingAmount: number;
  }> {
    const [total, succeeded, failed, revenue, pending] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.count({ where: { status: PaymentStatus.SUCCEEDED } }),
      prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCEEDED },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PENDING },
        _sum: { amount: true }
      })
    ]);

    return {
      totalPayments: total,
      succeededPayments: succeeded,
      failedPayments: failed,
      totalRevenue: Number(revenue._sum.amount || 0),
      pendingAmount: Number(pending._sum.amount || 0)
}
