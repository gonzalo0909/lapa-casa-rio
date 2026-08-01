// lapa-casa-hostel/backend/src/services/booking-service.ts

import { query } from '../config/database';
import { GuestRepository } from '../database/repositories/guest-repository';
import { BookingRepository } from '../database/repositories/booking-repository';
import { logger } from '../utils/logger';
import type { Reservation, BookingStatus } from '../types/database';

const guestRepo = new GuestRepository();
const bookingRepo = new BookingRepository();

const DIRECT_CHANNEL_ID = '96a01f24-147b-4cd5-8cb3-7a1fc96a8f46';

export class BookingService {
  async createBooking(data: {
    full_name: string;
    email: string;
    phone?: string;
    country?: string;
    language?: 'pt' | 'en' | 'es';
    check_in_date: string;
    check_out_date: string;
    beds_count: number;
    special_requests?: string;
    source?: string;
  }): Promise<Reservation> {
    const guest = await guestRepo.upsert({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
      country: data.country ?? null,
      language: data.language ?? null,
    });

    const nights = Math.ceil(
      (new Date(data.check_out_date).getTime() - new Date(data.check_in_date).getTime())
      / (1000 * 60 * 60 * 24)
    );

    const priceResult = await query<{ base_price: number }>(
      `SELECT base_price FROM room_types ORDER BY capacity DESC LIMIT 1`
    );
    const basePrice = Number(priceResult.rows[0]?.base_price ?? 0);
    const finalPrice = basePrice * nights * data.beds_count;
    const depositAmount = Math.ceil(finalPrice * 0.3 * 100) / 100;
    const remainingAmount = Math.ceil((finalPrice - depositAmount) * 100) / 100;

    const result = await query<Reservation>(
      `INSERT INTO reservations (
         guest_id, channel_id, check_in_date, check_out_date,
         beds_count, base_price, final_price,
         deposit_amount, remaining_amount, special_requests, status
       )
       VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10, 'pending_payment')
       RETURNING *`,
      [
        guest.id,
        DIRECT_CHANNEL_ID,
        data.check_in_date,
        data.check_out_date,
        data.beds_count,
        basePrice,
        finalPrice,
        depositAmount,
        remainingAmount,
        data.special_requests ?? null,
      ]
    );

    logger.info('Booking created', { reservationId: result.rows[0].id });
    return result.rows[0];
  }

  async getBooking(id: string): Promise<Reservation | null> {
    return bookingRepo.findById(id);
  }

  async cancelBooking(id: string, reason?: string): Promise<Reservation> {
    return bookingRepo.cancelReservation(id, reason);
  }

  async confirmBooking(id: string): Promise<Reservation> {
    return bookingRepo.confirmReservation(id);
  }

  async listBookings(filters: {
    status?: BookingStatus;
    dateFrom?: string;
    dateTo?: string;
    guestEmail?: string;
    guestName?: string;
  } = {}): Promise<Reservation[]> {
    return bookingRepo.search(filters);
  }

  async getBookingStats(from: string, to: string): Promise<{
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
  }> {
    const result = await query<{
      total: string; confirmed: string; pending: string;
      cancelled: string; revenue: string;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))::int AS confirmed,
         COUNT(*) FILTER (WHERE status = 'pending_payment')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
         COALESCE(SUM(final_price) FILTER (WHERE status IN ('confirmed','completed')), 0) AS revenue
       FROM reservations
       WHERE check_in_date >= $1::date AND check_in_date <= $2::date`,
      [from, to]
    );
    const row = result.rows[0];
    return {
      totalBookings: parseInt(row.total, 10),
      confirmedBookings: parseInt(row.confirmed, 10),
      pendingBookings: parseInt(row.pending, 10),
      cancelledBookings: parseInt(row.cancelled, 10),
      totalRevenue: parseFloat(row.revenue),
    };
  }
}

export const bookingService = new BookingService();
