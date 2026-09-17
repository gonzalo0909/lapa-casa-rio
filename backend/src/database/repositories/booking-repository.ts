// lapa-casa-hostel/backend/src/database/repositories/booking-repository.ts
//
// FIX (auditoría 2026-08-30): reescrito de Prisma a SQL directo (pg) para
// no mantener dos capas de persistencia distintas sobre las mismas tablas
// -- el resto del código (booking-service.ts, migrations, triggers) ya
// trabaja 100% en SQL crudo contra el mismo pool de config/database.ts.
// Se eliminaron además 8 métodos sin ningún caller real (findByGuest,
// findByDateRange, findByStatus, findUpcoming, findPendingPayment,
// getStatistics, getOccupancyRate, getRevenueByDateRange) -- vestigios de
// una capa CRUD+analytics genérica que nadie llegó a usar (las stats reales
// las calcula booking-service.getBookingStats() con su propio SQL).

import { query } from '../../config/database';
import type { Reservation, BookingStatus } from '../../types/database';

const RESERVATION_WITH_GUEST =
  `SELECT r.*, to_jsonb(g) AS guest FROM reservations r JOIN guests g ON g.id = r.guest_id`;

export class BookingRepository {
  async findById(id: string): Promise<Reservation | null> {
    const { rows } = await query<Reservation>(`${RESERVATION_WITH_GUEST} WHERE r.id = $1`, [id]);
    return rows[0] ?? null;
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
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      const r = await this.findById(id);
      if (!r) {throw new Error('Reservation not found');}
      return r;
    }
    const values: any[] = [];
    const sets = entries.map(([key, value], i) => {
      if (key === 'metadata') {
        values.push(JSON.stringify(value));
        return `metadata = $${i + 1}::jsonb`;
      }
      values.push(value);
      return `${key} = $${i + 1}`;
    });
    values.push(id);
    const { rows } = await query<Reservation>(
      `UPDATE reservations SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows[0]) {throw new Error('Reservation not found');}
    return rows[0];
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Reservation> {
    const { rows } = await query<Reservation>(
      `UPDATE reservations SET status = $1::booking_status, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!rows[0]) {throw new Error('Reservation not found');}
    return rows[0];
  }

  async confirmReservation(id: string): Promise<Reservation> {
    return this.updateStatus(id, 'confirmed');
  }

  async cancelReservation(id: string, reason?: string): Promise<Reservation> {
    const { rows } = await query<Reservation>(
      `UPDATE reservations
       SET status = 'cancelled', cancelled_at = now(), cancellation_reason = $1, updated_at = now()
       WHERE id = $2 RETURNING *`,
      [reason ?? null, id]
    );
    if (!rows[0]) {throw new Error('Reservation not found');}
    return rows[0];
  }

  async search(filters: {
    guestName?: string;
    guestEmail?: string;
    status?: BookingStatus;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Reservation[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (filters.status)    { conditions.push(`r.status = $${i++}::booking_status`); values.push(filters.status); }
    if (filters.dateFrom)  { conditions.push(`r.check_in_date >= $${i++}::date`); values.push(filters.dateFrom); }
    if (filters.dateTo)    { conditions.push(`r.check_in_date <= $${i++}::date`); values.push(filters.dateTo); }
    if (filters.guestName)  { conditions.push(`g.full_name ILIKE $${i++}`); values.push(`%${filters.guestName}%`); }
    if (filters.guestEmail) { conditions.push(`g.email ILIKE $${i++}`); values.push(`%${filters.guestEmail}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const page  = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      query<Reservation>(
        `${RESERVATION_WITH_GUEST} ${where} ORDER BY r.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
        [...values, limit, offset]
      ),
      query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM reservations r JOIN guests g ON g.id = r.guest_id ${where}`,
        values
      ),
    ]);
    return { data: dataResult.rows, total: Number(countResult.rows[0].count) };
  }
}

export default new BookingRepository();
