// lapa-casa-hostel/backend/src/database/models/booking.ts
// ventana 1 — migrado a Prisma 5.22.0

import { prisma } from '../../config/prisma';
import { BookingStatus, Reservation } from '../../types/database';

function toReservation(row: any): Reservation {
  return row as unknown as Reservation;
}

export class BookingModel {
  static async createBooking(data: {
    guestId: string;
    channelId: string;
    bedsCount: number;
    checkIn: Date;
    checkOut: Date;
    nightsCount: number;
    basePrice: number;
    groupDiscount: number;
    seasonMultiplier: number;
    totalPrice: number;
    depositAmount: number;
    depositPercent: number;
    remainingAmount: number;
    specialRequests?: string;
    metadata?: any;
  }): Promise<Reservation> {
    const reservationNumber = await this.generateBookingNumber();
    const reservation = await prisma.reservations.create({
      data: {
        reservation_number: reservationNumber,
        guest_id: data.guestId,
        channel_id: data.channelId,
        status: 'pending_payment',
        beds_count: data.bedsCount,
        check_in_date: data.checkIn,
        check_out_date: data.checkOut,
        nights_count: data.nightsCount,
        base_price: data.basePrice,
        group_discount: data.groupDiscount,
        season_multiplier: data.seasonMultiplier,
        final_price: data.totalPrice,
        deposit_amount: data.depositAmount,
        deposit_percent: data.depositPercent,
        remaining_amount: data.remainingAmount,
        special_requests: data.specialRequests ?? null,
        metadata: data.metadata ?? undefined,
      },
    });
    return toReservation(reservation);
  }

  static async generateBookingNumber(): Promise<string> {
    const d = new Date();
    const prefix = `LCH-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-`;
    const last = await prisma.reservations.findFirst({
      where: { reservation_number: { startsWith: prefix } },
      orderBy: { created_at: 'desc' },
      select: { reservation_number: true },
    });
    const seq = last ? parseInt(last.reservation_number.split('-')[2]) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  static async getBookingById(id: string): Promise<Reservation | null> {
    const r = await prisma.reservations.findUnique({ where: { id } });
    return r ? toReservation(r) : null;
  }

  static async getBookingByNumber(number: string): Promise<Reservation | null> {
    const r = await prisma.reservations.findUnique({ where: { reservation_number: number } });
    return r ? toReservation(r) : null;
  }

  static async getBookingsByGuest(guestId: string): Promise<Reservation[]> {
    const rows = await prisma.reservations.findMany({
      where: { guest_id: guestId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toReservation);
  }

  static async getUpcomingBookings(limit = 10): Promise<Reservation[]> {
    const now = new Date();
    const rows = await prisma.reservations.findMany({
      where: {
        status: 'confirmed',
        check_in_date: { gte: now },
      },
      orderBy: { check_in_date: 'asc' },
      take: limit,
    });
    return rows.map(toReservation);
  }

  static async getPendingPaymentBookings(): Promise<Reservation[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await prisma.reservations.findMany({
      where: {
        status: 'pending_payment',
        created_at: { gte: cutoff },
      },
    });
    return rows.map(toReservation);
  }

  static async updateBookingStatus(id: string, status: BookingStatus): Promise<Reservation> {
    const r = await prisma.reservations.update({
      where: { id },
      data: { status: status as any, updated_at: new Date() },
    });
    return toReservation(r);
  }

  static async confirmBooking(id: string): Promise<Reservation> {
    return this.updateBookingStatus(id, 'confirmed');
  }

  static async cancelBooking(id: string, reason?: string): Promise<Reservation> {
    const r = await prisma.reservations.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancellation_reason: reason ?? null,
        cancelled_at: new Date(),
        updated_at: new Date(),
      },
    });
    return toReservation(r);
  }

  static async getBookingStats(): Promise<{
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    totalRevenue: number;
    averageBookingValue: number;
  }> {
    const rows = await prisma.$queryRaw<[{
      total: number;
      confirmed: number;
      pending: number;
      revenue: string;
    }]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))::int AS confirmed,
        COUNT(*) FILTER (WHERE status = 'pending_payment')::int AS pending,
        COALESCE(SUM(final_price) FILTER (WHERE status IN ('confirmed','completed')), 0)::float8 AS revenue
      FROM reservations
    `;
    const { total, confirmed, pending, revenue } = rows[0];
    const confirmedN = Number(confirmed);
    const rev = Number(revenue);
    return {
      totalBookings: Number(total),
      confirmedBookings: confirmedN,
      pendingBookings: Number(pending),
      totalRevenue: rev,
      averageBookingValue: confirmedN > 0 ? Math.round((rev / confirmedN) * 100) / 100 : 0,
    };
  }

  static async searchBookings(query: {
    guestName?: string;
    guestEmail?: string;
    bookingNumber?: string;
    status?: BookingStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<Reservation[]> {
    const where: any = {};
    if (query.bookingNumber) where.reservation_number = { contains: query.bookingNumber, mode: 'insensitive' };
    if (query.status)        where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.check_in_date = {};
      if (query.dateFrom) where.check_in_date.gte = query.dateFrom;
      if (query.dateTo)   where.check_in_date.lte = query.dateTo;
    }
    if (query.guestName || query.guestEmail) {
      where.guests = {};
      if (query.guestName)  where.guests.full_name = { contains: query.guestName, mode: 'insensitive' };
      if (query.guestEmail) where.guests.email     = { contains: query.guestEmail, mode: 'insensitive' };
    }

    const rows = await prisma.reservations.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return rows.map(toReservation);
  }
}
