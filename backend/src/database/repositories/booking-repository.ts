// lapa-casa-hostel/backend/src/database/repositories/booking-repository.ts

import { PrismaClient, Booking, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class BookingRepository {
  async create(data: {
    bookingNumber: string;
    guestId: string;
    roomId: string;
    bedsCount: number;
    checkInDate: Date;
    checkOutDate: Date;
    nightsCount: number;
    basePrice: number;
    groupDiscount: number;
    seasonMultiplier: number;
    totalPrice: number;
    depositAmount: number;
    depositPercent: number;
    remainingAmount: number;
    specialRequests?: string;
    source?: string;
    userAgent?: string;
    ipAddress?: string;
    metadata?: any;
  }): Promise<Booking> {
    return await prisma.booking.create({
      data: {
        ...data,
        status: BookingStatus.PENDING
      },
      include: {
        guest: true,
        room: true
      }
    });
  }

  async findById(id: string): Promise<Booking | null> {
    return await prisma.booking.findUnique({
      where: { id },
      include: {
        guest: true,
        room: true,
        payments: true
      }
    });
  }

  async findByNumber(bookingNumber: string): Promise<Booking | null> {
    return await prisma.booking.findUnique({
      where: { bookingNumber },
      include: {
        guest: true,
        room: true,
        payments: true
      }
    });
  }

  async findByGuest(guestId: string): Promise<Booking[]> {
    return await prisma.booking.findMany({
      where: { guestId },
      include: {
        room: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findByRoom(roomId: string, startDate?: Date, endDate?: Date): Promise<Booking[]> {
    const where: any = {
      roomId,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] }
    };

    if (startDate && endDate) {
      where.OR = [
        { AND: [{ checkInDate: { lte: startDate } }, { checkOutDate: { gt: startDate } }] },
        { AND: [{ checkInDate: { lt: endDate } }, { checkOutDate: { gte: endDate } }] },
        { AND: [{ checkInDate: { gte: startDate } }, { checkOutDate: { lte: endDate } }] }
      ];
    }

    return await prisma.booking.findMany({
      where,
      include: { guest: true },
      orderBy: { checkInDate: 'asc' }
    });
  }

  async findUpcoming(limit: number = 10): Promise<Booking[]> {
    return await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        checkInDate: { gte: new Date() }
      },
      include: {
        guest: true,
        room: true
      },
      orderBy: { checkInDate: 'asc' },
      take: limit
    });
  }

  async findPendingPayment(): Promise<Booking[]> {
    return await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        depositPaid: false,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      include: {
        guest: true,
        room: true
      }
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Booking[]> {
    return await prisma.booking.findMany({
      where: {
        OR: [
          { AND: [{ checkInDate: { lte: startDate } }, { checkOutDate: { gt: startDate } }] },
          { AND: [{ checkInDate: { lt: endDate } }, { checkOutDate: { gte: endDate } }] },
          { AND: [{ checkInDate: { gte: startDate } }, { checkOutDate: { lte: endDate } }] }
        ]
      },
      include: {
        guest: true,
        room: true
      },
      orderBy: { checkInDate: 'asc' }
    });
  }

  async findByStatus(status: BookingStatus): Promise<Booking[]> {
    return await prisma.booking.findMany({
      where: { status },
      include: {
        guest: true,
        room: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, data: any): Promise<Booking> {
    return await prisma.booking.update({
      where: { id },
      data
    });
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    return await prisma.booking.update({
      where: { id },
      data: { status }
    });
  }

  async confirmBooking(id: string): Promise<Booking> {
    return await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CONFIRMED,
        depositPaid: true,
        depositPaidAt: new Date()
      }
    });
  }

  async checkIn(id: string): Promise<Booking> {
    return await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CHECKED_IN }
    });
  }

  async checkOut(id: string): Promise<Booking> {
    return await prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CHECKED_OUT }
    });
  }

  async cancel(id: string, reason?: string, refundAmount?: number): Promise<Booking> {
    return await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundAmount
      }
    });
  }

  async markRemainingPaid(id: string): Promise<Booking> {
    return await prisma.booking.update({
      where: { id },
      data: {
        remainingPaid: true,
        remainingPaidAt: new Date()
      }
    });
  }

  async updateSheetsSyncStatus(id: string, rowNumber?: number): Promise<Booking> {
    return await prisma.booking.update({
      where: { id },
      data: {
        sheetsSynced: true,
        sheetsSyncedAt: new Date(),
        sheetsRowNumber: rowNumber
      }
    });
  }

  async search(query: {
    guestName?: string;
    guestEmail?: string;
    bookingNumber?: string;
    status?: BookingStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<Booking[]> {
    const where: any = {};

    if (query.bookingNumber) {
      where.bookingNumber = { contains: query.bookingNumber, mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.dateFrom || query.dateTo) {
      where.checkInDate = {};
      if (query.dateFrom) where.checkInDate.gte = query.dateFrom;
      if (query.dateTo) where.checkInDate.lte = query.dateTo;
    }

    if (query.guestName || query.guestEmail) {
      where.guest = {};
      if (query.guestName) {
        where.guest.OR = [
          { firstName: { contains: query.guestName, mode: 'insensitive' } },
          { lastName: { contains: query.guestName, mode: 'insensitive' } }
        ];
      }
      if (query.guestEmail) {
        where.guest.email = { contains: query.guestEmail, mode: 'insensitive' };
      }
    }

    return await prisma.booking.findMany({
      where,
      include: {
        guest: true,
        room: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  async getStatistics(): Promise<{
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    totalRevenue: number;
    averageBookingValue: number;
  }> {
    const [total, confirmed, pending, revenue] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } } }),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.booking.aggregate({
        where: { status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
        _sum: { totalPrice: true }
      })
    ]);

    const totalRevenue = Number(revenue._sum.totalPrice || 0);
    const averageBookingValue = confirmed > 0 ? totalRevenue / confirmed : 0;

    return {
      totalBookings: total,
      confirmedBookings: confirmed,
      pendingBookings: pending,
      totalRevenue,
      averageBookingValue: Math.round(averageBookingValue * 100) / 100
    };
  }

  async getRevenueByDateRange(startDate: Date, endDate: Date): Promise<number> {
    const result = await prisma.booking.aggregate({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        checkInDate: { gte: startDate, lte: endDate }
      },
      _sum: { totalPrice: true }
    });

    return Number(result._sum.totalPrice || 0);
  }

  async getOccupancyRate(startDate: Date, endDate: Date): Promise<number> {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        OR: [
          { AND: [{ checkInDate: { lte: startDate } }, { checkOutDate: { gt: startDate } }] },
          { AND: [{ checkInDate: { lt: endDate } }, { checkOutDate: { gte: endDate } }] },
          { AND: [{ checkInDate: { gte: startDate } }, { checkOutDate: { lte: endDate } }] }
        ]
      },
      include: { room: true }
    });

    if (bookings.length === 0) return 0;

    const totalBedNights = bookings.reduce((sum, b) => sum + (b.bedsCount * b.nightsCount), 0);
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalCapacity = 38 * days; // 38 total beds

    return (totalBedNights / totalCapacity) * 100;
  }

  async delete(id: string): Promise<Booking> {
    return await prisma.booking.delete({
      where: { id }
    });
  }

  async generateNextBookingNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LCH-${year}-`;

    const lastBooking = await prisma.booking.findFirst({
      where: { bookingNumber: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' }
    });

    let sequence = 1;
    if (lastBooking) {
      const lastNumber = parseInt(lastBooking.bookingNumber.split('-')[2]);
      sequence = lastNumber + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }
}

export default new BookingRepository();
