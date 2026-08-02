// lapa-casa-hostel/backend/src/database/repositories/booking-repository.ts

import { query } from '../../config/database';
import type { Reservation, BookingStatus } from '../../types/database';

const TOTAL_BEDS = 45;

export class BookingRepository {
  async findById(id: string): Promise<Reservation | null> {
    const result = await query<Reservation>(
      `SELECT * FROM reservations WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findByGuest(guestId: string): Promise<Reservation[]> {
    const result = await query<Reservation>(
      `SELECT * FROM reservations WHERE guest_id = $1 ORDER BY created_at DESC`,
      [guestId]
    );
    return result.rows;
  }

  async findByDateRange(startDate: string, endDate: string): Promise<Reservation[]> {
    const result = await query<Reservation>(
      `SELECT * FROM reservations
       WHERE check_in_date < $2::date AND check_out_date > $1::date
       ORDER BY check_in_date ASC`,
      [startDate, endDate]
    );
    return result.rows;
  }

  async findByStatus(status: BookingStatus): Promise<Reservation[]> {
    const result = await query<Reservation>(
      `SELECT * FROM reservations WHERE status = $1::booking_status ORDER BY created_at DESC`,
      [status]
    );
    return result.rows;
  }

  async findUpcoming(limit: number = 10): Promise<Reservation[]> {
    const result = await query<Reservation>(
      `SELECT * FROM reservations
       WHERE status = 'confirmed' AND check_in_date >= CURRENT_DATE
       ORDER BY check_in_date ASC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async findPendingPayment(): Promise<Reservation[]> {
    const result = await query<Reservation>(
      `SELECT * FROM reservations
       WHERE status = 'pending_payment'
         AND created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  async update(id: string, data: Partial<{
    status: BookingStatus;
    special_requests: string;
    notes: string;
    cancelled_at: Date;
    cancellation_reason: string;
    deposit_paid: boolean;
    deposit_paid_at: Date;
    remaining_paid: boolean;
    remaining_paid_at: Date;
  }>): Promise<Reservation> {
    const fields = Object.keys(data);
    if (fields.length === 0) {
      const r = await this.findById(id);
      if (!r) throw new Error('Reservation not found');
      return r;
    }
    const sets = fields.map((f, i) => {
      if (f === 'status') return `${f} = $${i + 2}::booking_status`;
      return `${f} = $${i + 2}`;
    }).join(', ');
    const values = fields.map(f => (data as any)[f]);
    const result = await query<Reservation>(
      `UPDATE reservations SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Reservation> {
    const result = await query<Reservation>(
      `UPDATE reservations SET status = $2::booking_status, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return result.rows[0];
  }

  async confirmReservation(id: string): Promise<Reservation> {
    // `deposit_paid`/`deposit_paid_at` no existen en la tabla real
    // (0002_tables.sql) -- el estado de pago vive en `payments`
    // (payment_type, status, paid_at), no en `reservations`.
    const result = await query<Reservation>(
      `UPDATE reservations
       SET status = 'confirmed', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  async cancelReservation(id: string, reason?: string): Promise<Reservation> {
    const result = await query<Reservation>(
      `UPDATE reservations
       SET status = 'cancelled', cancelled_at = NOW(),
           cancellation_reason = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, reason ?? null]
    );
    return result.rows[0];
  }

  async markRemainingPaid(id: string): Promise<Reservation> {
    const result = await query<Reservation>(
      `UPDATE reservations
       SET remaining_paid = true, remaining_paid_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  async search(filters: {
    guestName?: string;
    guestEmail?: string;
    status?: BookingStatus;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Reservation[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.status) {
      conditions.push(`r.status = $${idx}::booking_status`);
      params.push(filters.status);
      idx++;
    }
    if (filters.dateFrom) {
      conditions.push(`r.check_in_date >= $${idx}::date`);
      params.push(filters.dateFrom);
      idx++;
    }
    if (filters.dateTo) {
      conditions.push(`r.check_in_date <= $${idx}::date`);
      params.push(filters.dateTo);
      idx++;
    }
    if (filters.guestName) {
      conditions.push(`g.full_name ILIKE $${idx}`);
      params.push(`%${filters.guestName}%`);
      idx++;
    }
    if (filters.guestEmail) {
      conditions.push(`g.email ILIKE $${idx}`);
      params.push(`%${filters.guestEmail}%`);
      idx++;
    }

    const hasGuestFilter = !!(filters.guestName || filters.guestEmail);
    const join = hasGuestFilter
      ? 'JOIN guests g ON r.guest_id = g.id'
      : 'LEFT JOIN guests g ON r.guest_id = g.id';
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query<Reservation>(
      `SELECT r.* FROM reservations r ${join} ${where} ORDER BY r.created_at DESC LIMIT 50`,
      params
    );
    return result.rows;
  }

  async getStatistics(): Promise<{
    totalBookings: number;
    confirmedBookings: number;
    pendingBookings: number;
    totalRevenue: number;
    averageBookingValue: number;
  }> {
    const result = await query<{
      total: string;
      confirmed: string;
      pending: string;
      revenue: string;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status IN ('confirmed','completed'))::int AS confirmed,
         COUNT(*) FILTER (WHERE status = 'pending_payment')::int AS pending,
         COALESCE(SUM(final_price) FILTER (WHERE status IN ('confirmed','completed')), 0) AS revenue
       FROM reservations`
    );
    const row = result.rows[0];
    const confirmed = parseInt(row.confirmed, 10);
    const revenue = parseFloat(row.revenue);
    return {
      totalBookings: parseInt(row.total, 10),
      confirmedBookings: confirmed,
      pendingBookings: parseInt(row.pending, 10),
      totalRevenue: revenue,
      averageBookingValue: confirmed > 0 ? Math.round((revenue / confirmed) * 100) / 100 : 0,
    };
  }

  async getOccupancyRate(startDate: string, endDate: string): Promise<number> {
    const result = await query<{ bed_nights: string }>(
      `SELECT COALESCE(SUM(
         beds_count * (
           LEAST(check_out_date, $2::date) - GREATEST(check_in_date, $1::date)
         )
       ), 0)::int AS bed_nights
       FROM reservations
       WHERE status IN ('confirmed','completed')
         AND check_in_date < $2::date
         AND check_out_date > $1::date`,
      [startDate, endDate]
    );
    const bedNights = parseInt(result.rows[0].bed_nights, 10);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalCapacity = TOTAL_BEDS * days;
    return totalCapacity > 0 ? (bedNights / totalCapacity) * 100 : 0;
  }

  async getRevenueByDateRange(startDate: string, endDate: string): Promise<number> {
    const result = await query<{ revenue: string }>(
      `SELECT COALESCE(SUM(final_price), 0) AS revenue
       FROM reservations
       WHERE status IN ('confirmed','completed')
         AND check_in_date >= $1::date AND check_in_date <= $2::date`,
      [startDate, endDate]
    );
    return parseFloat(result.rows[0].revenue);
  }
}

export default new BookingRepository();
