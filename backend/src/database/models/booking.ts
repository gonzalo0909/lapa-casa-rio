// lapa-casa-hostel/backend/src/database/models/booking.ts

import { PrismaClient, Booking, BookingStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class BookingModel {
  static async createBooking(data: {
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
    const bookingNumber = await this.generateBookingNumber();

    const booking = await prisma.booking.create({
      data: { ...data, bookingNumber, status: BookingStatus.PENDING },
      include: { guest: true, room: true }
    });

    await this.updateRoomAvailability(data.roomId, data.checkInDate, data.checkOutDate, data.bedsCount, 'occupy');

    return booking;
  }

  static async generateBookingNumber(): Promise<string> {
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

  static async getBookingById(bookingId: string): Promise<Booking | null> {
    return await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { guest: true, room: true, payments: true }
    });
  }

  static async getBookingByNumber(bookingNumber: string): Promise<Booking | null> {
    return await prisma.booking.findUnique({
      where: { bookingNumber },
      include: { guest: true, room: true, payments: true }
    });
  }

  static async getBookingsByGuest(guestId: string): Promise<Booking[]> {
    return await prisma.booking.findMany({
      where: { guestId },
      include: { room: true, payments: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getBookingsByRoom(roomId: string, startDate?: Date, endDate?: Date): Promise<Booking[]> {
    const where: any = { roomId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } };

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

  static async getUpcomingBookings(limit: number = 10): Promise<Booking[]> {
    return await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        checkInDate: { gte: new Date() }
      },
      include: { guest: true, room: true },
      orderBy: { checkInDate: 'asc' },
      take: limit
    });
  }

  static async getPendingPaymentBookings(): Promise<Booking[]> {
    return await prisma.booking.findMany({
      where: {
        status: 'PENDING',
        depositPaid: false,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      include: { guest: true, room: true }
    });
  }

  static async updateBookingStatus(bookingId: string, status: BookingStatus): Promise<Booking> {
    return await prisma.booking.update({
      where: { id: bookingId },
      data: { status }
    });
  }

  static async confirmBooking(bookingId: string): Promise<Booking> {
    return await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        depositPaid: true,
        depositPaidAt: new Date()
      }
    });
  }

  static async checkInBooking(bookingId: string): Promise<Booking> {
    return await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CHECKED_IN }
    });
  }

  static async checkOutBooking(bookingId: string): Promise<Booking> {
    return await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CHECKED_OUT }
    });
  }

  static async cancelBooking(bookingId: string, reason?: string, refundAmount?: number): Promise<Booking> {
    const booking = await this.getBookingById(bookingId);
    if (!booking) throw new Error('Booking not found');

    await this.updateRoomAvailability(
      booking.roomId,
      booking.checkInDate,
      booking.checkOutDate,
      booking.bedsCount,
      'release'
    );

    return await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundAmount: refundAmount
      }
    });
  }

  static async markRemainingPaid(bookingId: string): Promise<Booking> {
    return await prisma.booking.update({
      where: { id: bookingId },
      data: {
        remainingPaid: true,
        remainingPaidAt: new Date()
      }
    });
  }

  static async updateSheetsSyncStatus(bookingId: string, rowNumber?: number): Promise<Booking> {
    return await prisma.booking.update({
      where: { id: bookingId },
      data: {
        sheetsSynced: true,
        sheetsSyncedAt: new Date(),
        sheetsRowNumber: rowNumber
      }
    });
  }

  static async updateBooking(bookingId: string, data: Partial<Prisma.BookingUpdateInput>): Promise<Booking> {
    return await prisma.booking.update({
      where: { id: bookingId },
      data
    });
  }

  static async getBookingStats(): Promise<{
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

  static async searchBookings(query: {
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
      include: { guest: true, room: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  private static async updateRoomAvailability(
    roomId: string,
    checkInDate: Date,
    checkOutDate: Date,
    bedsCount: number,
    action: 'occupy' | 'release'
  ): Promise<void> {
    const availabilityRecords = await prisma.roomAvailability.findMany({
      where: {
        roomId,
        date: { gte: checkInDate, lt: checkOutDate }
      }
    });

    for (const record of availabilityRecords) {
      const change = action === 'occupy' ? -bedsCount : bedsCount;
      
      await prisma.roomAvailability.update({
        where: { id: record.id },
        data: {
          availableBeds: record.availableBeds + change,
          occupiedBeds: record.occupiedBeds + (action === 'occupy' ? bedsCount : -bedsCount),
          isAvailable: (record.availableBeds + change) > 0
        }
      });
    }
  }
}
