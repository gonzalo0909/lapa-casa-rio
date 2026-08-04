// lapa-casa-hostel/backend/src/database/repositories/booking-repository.ts
// ventana3

import { prisma } from '../../config/prisma';
import type { Reservation, BookingStatus } from '../../types/database';

const TOTAL_BEDS = 45;

function mapReservation(row: any): Reservation {
  if (row && row.guests !== undefined) {
    const { guests, ...rest } = row;
    return { ...rest, guest: guests ?? undefined } as unknown as Reservation;
  }
  return row as unknown as Reservation;
}

export class BookingRepository {
  async findById(id: string): Promise<Reservation | null> {
    const r = await prisma.reservations.findUnique({
      where: { id },
      include: { guests: true },
    });
    return r ? mapReservation(r) : null;
  }

  async findByGuest(guestId: string): Promise<Reservation[]> {
    const rows = await prisma.reservations.findMany({
      where: { guest_id: guestId },
      include: { guests: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapReservation);
  }

  async findByDateRange(startDate: string, endDate: string): Promise<Reservation[]> {
    const rows = await prisma.reservations.findMany({
      where: {
        check_in_date: { lt: new Date(endDate) },
        check_out_date: { gt: new Date(startDate) },
      },
      include: { guests: true },
      orderBy: { check_in_date: 'asc' },
    });
    return rows.map(mapReservation);
  }

  async findByStatus(status: BookingStatus): Promise<Reservation[]> {
    const rows = await prisma.reservations.findMany({
      where: { status: status as any },
      include: { guests: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapReservation);
  }

  async findUpcoming(limit: number = 10): Promise<Reservation[]> {
    const rows = await prisma.reservations.findMany({
      where: {
        status: 'confirmed',
        check_in_date: { gte: new Date() },
      },
      include: { guests: true },
      orderBy: { check_in_date: 'asc' },
      take: limit,
    });
    return rows.map(mapReservation);
  }

  async findPendingPayment(): Promise<Reservation[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await prisma.reservations.findMany({
      where: {
        status: 'pending_payment',
        created_at: { gte: cutoff },
      },
      include: { guests: true },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(mapReservation);
  }

  async update(id: string, data: Partial<{
    status: BookingStatus;
    special_requests: string;
    cancelled_at: Date;
    cancellation_reason: string;
    checked_in_at: Date;
    checked_out_at: Date;
    refund_amount: number;
    metadata: Record<string, any>;
    check_in_date: string;
    check_out_date: string;
    nights_count: number;
    beds_count: number;
    final_price: number;
    deposit_amount: number;
    deposit_percent: number;
    remaining_amount: number;
    base_price: number;
    season_multiplier: number;
    group_discount: number;
    early_bird_discount: number;
  }>): Promise<Reservation> {
    if (Object.keys(data).length === 0) {
      const r = await this.findById(id);
      if (!r) throw new Error('Reservation not found');
      return r;
    }
    const updated = await prisma.reservations.update({
      where: { id },
      data: { ...data, updated_at: new Date() } as any,
    });
    return updated as unknown as Reservation;
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Reservation> {
    const updated = await prisma.reservations.update({
      where: { id },
      data: { status: status as any, updated_at: new Date() },
    });
    return updated as unknown as Reservation;
  }

  async confirmReservation(id: string): Promise<Reservation> {
    const updated = await prisma.reservations.update({
      where: { id },
      data: { status: 'confirmed', updated_at: new Date() },
    });
    return updated as unknown as Reservation;
  }

  async cancelReservation(id: string, reason?: string): Promise<Reservation> {
    const updated = await prisma.reservations.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelled_at: new Date(),
        cancellation_reason: reason ?? null,
        updated_at: new Date(),
      },
    });
    return updated as unknown as Reservation;
  }

  async search(filters: {
    guestName?: string;
    guestEmail?: string;
    status?: BookingStatus;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Reservation[]> {
    const where: any = {};
    if (filters.status)   where.status = filters.status;
    if (filters.dateFrom) where.check_in_date = { ...(where.check_in_date ?? {}), gte: new Date(filters.dateFrom) };
    if (filters.dateTo)   where.check_in_date = { ...(where.check_in_date ?? {}), lte: new Date(filters.dateTo) };
    if (filters.guestName || filters.guestEmail) {
      where.guests = {};
      if (filters.guestName)  where.guests.full_name = { contains: filters.guestName, mode: 'insensitive' };
      if (filters.guestEmail) where.guests.email     = { contains: filters.guestEmail, mode: 'insensitive' };
    }

    const rows = await prisma.reservations.findMany({
      where,
      include: { guests: true },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    return rows.map(mapReservation);
  }

  async getStatistics(): Promise<{
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
      revenue: number;
    }]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))::int AS confirmed,
        COUNT(*) FILTER (WHERE status = 'pending_payment')::int AS pending,
        COALESCE(SUM(final_price) FILTER (WHERE status IN ('confirmed','completed')), 0)::float8 AS revenue
      FROM reservations
    `;
    const row = rows[0];
    const confirmed = Number(row.confirmed);
    const revenue = Number(row.revenue);
    return {
      totalBookings: Number(row.total),
      confirmedBookings: confirmed,
      pendingBookings: Number(row.pending),
      totalRevenue: revenue,
      averageBookingValue: confirmed > 0 ? Math.round((revenue / confirmed) * 100) / 100 : 0,
    };
  }

  async getOccupancyRate(startDate: string, endDate: string): Promise<number> {
    const rows = await prisma.$queryRaw<[{ bed_nights: number }]>`
      SELECT COALESCE(SUM(
        beds_count * (
          LEAST(check_out_date, ${endDate}::date) - GREATEST(check_in_date, ${startDate}::date)
        )
      ), 0)::int AS bed_nights
      FROM reservations
      WHERE status IN ('confirmed','completed')
        AND check_in_date < ${endDate}::date
        AND check_out_date > ${startDate}::date
    `;
    const bedNights = Number(rows[0].bed_nights);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalCapacity = TOTAL_BEDS * days;
    return totalCapacity > 0 ? (bedNights / totalCapacity) * 100 : 0;
  }

  async getRevenueByDateRange(startDate: string, endDate: string): Promise<number> {
    const rows = await prisma.$queryRaw<[{ revenue: number }]>`
      SELECT COALESCE(SUM(final_price), 0)::float8 AS revenue
      FROM reservations
      WHERE status IN ('confirmed','completed')
        AND check_in_date >= ${startDate}::date AND check_in_date <= ${endDate}::date
    `;
    return Number(rows[0].revenue);
  }
}

export default new BookingRepository();
