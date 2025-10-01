// lapa-casa-hostel/backend/src/database/repositories/payment-repository.ts

import { PrismaClient, Payment, PaymentStatus, PaymentType, PaymentProvider } from '@prisma/client';

const prisma = new PrismaClient();

export class PaymentRepository {
  async create(data: {
    paymentNumber: string;
    bookingId: string;
    amount: number;
    currency: string;
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
    return await prisma.payment.create({
      data: {
        ...data,
        status: PaymentStatus.PENDING
      },
      include: { booking: true }
    });
  }

  async findById(id: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            guest: true,
            room: true
          }
        }
      }
    });
  }

  async findByNumber(paymentNumber: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { paymentNumber },
      include: {
        booking: {
          include: { guest: true }
        }
      }
    });
  }

  async findByStripeIntent(stripePaymentIntentId: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { stripePaymentIntentId },
      include: { booking: true }
    });
  }

  async findByMPId(mpPaymentId: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { mpPaymentId },
      include: { booking: true }
    });
  }

  async findByBooking(bookingId: string): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findPending(): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      include: {
        booking: {
          include: { guest: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findFailedForRetry(): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: {
        status: PaymentStatus.FAILED,
        retryAttempts: { lt: 3 },
        nextRetryAt: { lte: new Date() }
      },
      include: {
        booking: {
          include: { guest: true }
        }
      }
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: {
        status: PaymentStatus.SUCCEEDED,
        paidAt: { gte: startDate, lte: endDate }
      },
      include: {
        booking: {
          include: {
            guest: true,
            room: true
          }
        }
      },
      orderBy: { paidAt: 'desc' }
    });
  }

  async findByProvider(provider: PaymentProvider): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: { provider },
      include: { booking: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async update(id: string, data: any): Promise<Payment> {
    return await prisma.payment.update({
      where: { id },
      data
    });
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const updateData: any = { status };

    if (status === PaymentStatus.SUCCEEDED) {
      updateData.paidAt = new Date();
    } else if (status === PaymentStatus.FAILED) {
      updateData.failedAt = new Date();
    } else if (status === PaymentStatus.REFUNDED) {
      updateData.refundedAt = new Date();
    }

    return await prisma.payment.update({
      where: { id },
      data: updateData
    });
  }

  async markSucceeded(id: string, metadata?: any): Promise<Payment> {
    return await prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        paidAt: new Date(),
        metadata
      }
    });
  }

  async markFailed(id: string, failureReason?: string, failureCode?: string): Promise<Payment> {
    const payment = await this.findById(id);
    if (!payment) throw new Error('Payment not found');

    return await prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        failureReason,
        failureCode,
        retryAttempts: payment.retryAttempts + 1
      }
    });
  }

  async scheduleRetry(id: string, nextRetryAt: Date): Promise<Payment> {
    return await prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.PENDING,
        nextRetryAt
      }
    });
  }

  async processRefund(id: string, refundAmount: number, refundReason?: string): Promise<Payment> {
    const payment = await this.findById(id);
    if (!payment) throw new Error('Payment not found');

    const isPartialRefund = refundAmount < Number(payment.amount);

    return await prisma.payment.update({
      where: { id },
      data: {
        status: isPartialRefund ? PaymentStatus.PARTIALLY_REFUNDED : PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundAmount,
        refundReason
      }
    });
  }

  async updateStripeDetails(id: string, stripePaymentIntentId: string, stripeChargeId?: string): Promise<Payment> {
    return await prisma.payment.update({
      where: { id },
      data: {
        stripePaymentIntentId,
        stripeChargeId
      }
    });
  }

  async updateMPDetails(id: string, mpPaymentId: string, mpPreferenceId?: string): Promise<Payment> {
    return await prisma.payment.update({
      where: { id },
      data: {
        mpPaymentId,
        mpPreferenceId
      }
    });
  }

  async updatePixDetails(
    id: string,
    pixQrCode: string,
    pixQrCodeBase64: string,
    pixExpiresAt: Date
  ): Promise<Payment> {
    return await prisma.payment.update({
      where: { id },
      data: {
        pixQrCode,
        pixQrCodeBase64,
        pixExpiresAt
      }
    });
  }

  async storeWebhookData(id: string, webhookData: any): Promise<Payment> {
    return await prisma.payment.update({
      where: { id },
      data: { webhookData }
    });
  }

  async getStatistics(): Promise<{
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
    };
  }

  async getRevenueByProvider(): Promise<Array<{ provider: string; revenue: number; count: number }>> {
    const payments = await prisma.payment.groupBy({
      by: ['provider'],
      where: { status: PaymentStatus.SUCCEEDED },
      _sum: { amount: true },
      _count: { id: true }
    });

    return payments.map(p => ({
      provider: p.provider,
      revenue: Number(p._sum.amount || 0),
      count: p._count.id
    }));
  }

  async getRevenueByDateRange(startDate: Date, endDate: Date): Promise<number> {
    const result = await prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCEEDED,
        paidAt: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    });

    return Number(result._sum.amount || 0);
  }

  async delete(id: string): Promise<Payment> {
    return await prisma.payment.delete({
      where: { id }
    });
  }

  async generateNextPaymentNumber(): Promise<string> {
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
}

export default new PaymentRepository();
