// lapa-casa-hostel/backend/src/database/models/booking.ts

import { pool } from '../../config/database';
import { BookingStatus, Reservation } from '../../types/database';

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
    const { rows } = await pool.query(
      `INSERT INTO reservations (reservation_number, guest_id, channel_id, status, beds_count,
        check_in, check_out, nights_count, base_price, group_discount, season_multiplier,
        total_price, deposit_amount, deposit_percent, remaining_amount, notes, metadata)
       VALUES ($1,$2,$3,'pending_payment'::booking_status,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
       RETURNING *`,
      [reservationNumber, data.guestId, data.channelId, data.bedsCount,
       data.checkIn, data.checkOut, data.nightsCount, data.basePrice, data.groupDiscount,
       data.seasonMultiplier, data.totalPrice, data.depositAmount, data.depositPercent,
       data.remainingAmount, data.specialRequests || null, JSON.stringify(data.metadata || {})]
    );
    return rows[0];
  }

  static async generateBookingNumber(): Promise<string> {
    const d = new Date();
    const prefix = `LCH-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-`;
    const { rows } = await pool.query(
      `SELECT reservation_number FROM reservations WHERE reservation_number LIKE $1 ORDER BY created_at DESC LIMIT 1`,
      [prefix + '%']
    );
    const seq = rows.length > 0 ? parseInt(rows[0].reservation_number.split('-')[2]) + 1 : 1;
    return `${prefix}${String(seq).padStart(4,'0')}`;
  }

  static async getBookingById(id: string): Promise<Reservation | null> {
    const { rows } = await pool.query(`SELECT * FROM reservations WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  static async getBookingByNumber(number: string): Promise<Reservation | null> {
    const { rows } = await pool.query(`SELECT * FROM reservations WHERE reservation_number = $1`, [number]);
    return rows[0] || null;
  }

  static async getBookingsByGuest(guestId: string): Promise<Reservation[]> {
    const { rows } = await pool.query(
      `SELECT * FROM reservations WHERE guest_id = $1 ORDER BY created_at DESC`, [guestId]
    );
    return rows;
  }

  static async getUpcomingBookings(limit = 10): Promise<Reservation[]> {
    const { rows } = await pool.query(
      `SELECT * FROM reservations WHERE status = 'confirmed' AND check_in >= NOW() ORDER BY check_in LIMIT $1`, [limit]
    );
    return rows;
  }

  static async getPendingPaymentBookings(): Promise<Reservation[]> {
    const { rows } = await pool.query(
      `SELECT * FROM reservations WHERE status = 'pending_payment' AND created_at >= NOW() - INTERVAL '24 hours'`
    );
    return rows;
  }

  static async updateBookingStatus(id: string, status: BookingStatus): Promise<Reservation> {
    const { rows } = await pool.query(
      `UPDATE reservations SET status = $1::booking_status, updated_at = NOW() WHERE id = $2 RETURNING *`, [status, id]
    );
    return rows[0];
  }

  static async confirmBooking(id: string): Promise<Reservation> {
    return this.updateBookingStatus(id, 'confirmed');
  }

  static async cancelBooking(id: string, reason?: string): Promise<Reservation> {
    const { rows } = await pool.query(
      `UPDATE reservations SET status = 'cancelled'::booking_status, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, reason || null]
    );
    return rows[0];
  }

  static async getBookingStats(): Promise<{
    totalBookings: number; confirmedBookings: number; pendingBookings: number;
    totalRevenue: number; averageBookingValue: number;
  }> {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('confirmed','completed')) AS confirmed,
        COUNT(*) FILTER (WHERE status = 'pending_payment') AS pending,
        COALESCE(SUM(total_price) FILTER (WHERE status IN ('confirmed','completed')), 0) AS revenue
      FROM reservations
    `);
    const { total, confirmed, pending, revenue } = rows[0];
    const confirmedN = Number(confirmed), rev = Number(revenue);
    return {
      totalBookings: Number(total), confirmedBookings: confirmedN,
      pendingBookings: Number(pending), totalRevenue: rev,
      averageBookingValue: confirmedN > 0 ? Math.round((rev / confirmedN) * 100) / 100 : 0,
    };
  }

  static async searchBookings(query: {
    guestName?: string; guestEmail?: string; bookingNumber?: string;
    status?: BookingStatus; dateFrom?: Date; dateTo?: Date;
  }): Promise<Reservation[]> {
    const conditions: string[] = [], params: any[] = [];
    if (query.bookingNumber) { params.push(`%${query.bookingNumber}%`); conditions.push(`r.reservation_number ILIKE $${params.length}`); }
    if (query.status)        { params.push(query.status); conditions.push(`r.status = $${params.length}::booking_status`); }
    if (query.dateFrom)      { params.push(query.dateFrom); conditions.push(`r.check_in >= $${params.length}`); }
    if (query.dateTo)        { params.push(query.dateTo); conditions.push(`r.check_in <= $${params.length}`); }
    if (query.guestName)     { params.push(`%${query.guestName}%`); conditions.push(`g.full_name ILIKE $${params.length}`); }
    if (query.guestEmail)    { params.push(`%${query.guestEmail}%`); conditions.push(`g.email ILIKE $${params.length}`); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT r.* FROM reservations r JOIN guests g ON g.id = r.guest_id ${where} ORDER BY r.created_at DESC LIMIT 50`,
      params
    );
    return rows;
  }
}
