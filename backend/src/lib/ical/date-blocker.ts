// lapa-casa-hostel/backend/src/lib/ical/date-blocker.ts
//
// Bloqueo manual de fechas por habitación (mantenimiento/evento privado).
// Usa la tabla room_blocks (migración 0016), que check_availability ya
// lee para que un bloqueo también le impida reservar a un huésped -- no
// es solo informativo para el panel admin.

import { pool } from '../../config/database';

export interface BlockDateOptions {
  roomId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  notes?: string;
  blockType?: 'maintenance' | 'owner' | 'seasonal' | 'other';
}

export interface BlockedPeriod {
  id: string;
  roomId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  notes?: string;
  blockType: string;
  createdAt: Date;
}

export class DateBlocker {
  async blockDates(options: BlockDateOptions): Promise<string> {
    const { roomId, startDate, endDate, reason, notes, blockType = 'other' } = options;
    this.validateDates(startDate, endDate);

    const { rows: roomRows } = await pool.query(`SELECT id FROM room_types WHERE id = $1`, [roomId]);
    if (roomRows.length === 0) {throw new Error(`Room not found: ${roomId}`);}

    const conflicts = await this.findConflicts(roomId, startDate, endDate);
    if (conflicts.length > 0) {
      const details = conflicts.map((c: any) =>
        `${c.guest_name} (${c.check_in.toISOString().split('T')[0]} - ${c.check_out.toISOString().split('T')[0]})`
      ).join(', ');
      throw new Error(`Cannot block dates: conflicts with existing bookings: ${details}`);
    }

    const { rows } = await pool.query(
      `INSERT INTO room_blocks (room_type_id, start_date, end_date, block_type, reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [roomId, startDate, endDate, blockType, reason ?? null, notes ?? null]
    );
    return rows[0].id;
  }

  async blockMultipleRanges(roomId: string, ranges: Array<{ startDate: Date; endDate: Date }>, reason?: string): Promise<string[]> {
    const ids: string[] = [];
    for (const range of ranges) {ids.push(await this.blockDates({ roomId, startDate: range.startDate, endDate: range.endDate, reason }));}
    return ids;
  }

  async unblockDates(blockId: string): Promise<void> {
    const { rowCount } = await pool.query(`DELETE FROM room_blocks WHERE id = $1`, [blockId]);
    if (rowCount === 0) {throw new Error(`Block not found: ${blockId}`);}
  }

  async unblockDateRange(roomId: string, startDate: Date, endDate: Date): Promise<number> {
    this.validateDates(startDate, endDate);
    const { rowCount } = await pool.query(
      `DELETE FROM room_blocks
       WHERE room_type_id = $1 AND daterange(start_date, end_date, '[)') && daterange($2::date, $3::date, '[)')`,
      [roomId, startDate, endDate]
    );
    return rowCount ?? 0;
  }

  async getBlockedDates(roomId: string, startDate?: Date, endDate?: Date): Promise<BlockedPeriod[]> {
    const conditions = ['room_type_id = $1'];
    const params: any[] = [roomId];
    if (startDate && endDate) {
      params.push(startDate, endDate);
      conditions.push(`daterange(start_date, end_date, '[)') && daterange($2::date, $3::date, '[)')`);
    }
    const { rows } = await pool.query(
      `SELECT id, room_type_id AS "roomId", start_date AS "startDate", end_date AS "endDate",
              block_type AS "blockType", reason, notes, created_at AS "createdAt"
       FROM room_blocks WHERE ${conditions.join(' AND ')}`,
      params
    );
    return rows as BlockedPeriod[];
  }

  /** Todos los bloqueos de todas las habitaciones (para el panel admin). */
  async getAllBlockedDates(): Promise<BlockedPeriod[]> {
    const { rows } = await pool.query(
      `SELECT id, room_type_id AS "roomId", start_date AS "startDate", end_date AS "endDate",
              block_type AS "blockType", reason, notes, created_at AS "createdAt"
       FROM room_blocks ORDER BY start_date`
    );
    return rows as BlockedPeriod[];
  }

  async isDateBlocked(roomId: string, date: Date): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM room_blocks WHERE room_type_id = $1 AND start_date <= $2 AND end_date > $2 LIMIT 1`,
      [roomId, date]
    );
    return rows.length > 0;
  }

  async blockWeekdays(roomId: string, startDate: Date, endDate: Date, weekdays: number[], reason?: string): Promise<string[]> {
    this.validateDates(startDate, endDate);
    if (!weekdays.length) {throw new Error('Weekdays array is required');}
    const ids: string[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    while (current < endDate) {
      if (weekdays.includes(current.getDay())) {
        const next = new Date(current);
        next.setDate(next.getDate() + 1);
        try {
          ids.push(await this.blockDates({ roomId, startDate: new Date(current), endDate: next, reason, blockType: 'seasonal' }));
        } catch {
          // intencional: si un día puntual falla (ej. ya bloqueado), se sigue con el resto del rango
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return ids;
  }

  private async findConflicts(roomId: string, startDate: Date, endDate: Date): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT g.full_name AS guest_name, rb.check_in, rb.check_out
       FROM reservations r
       JOIN guests g ON g.id = r.guest_id
       JOIN reservation_beds rb ON rb.reservation_id = r.id
       JOIN beds b ON b.id = rb.bed_id
       WHERE b.room_type_id = $1 AND r.status IN ('confirmed','pending_payment')
         AND rb.check_in < $3 AND rb.check_out > $2`,
      [roomId, startDate, endDate]
    );
    return rows;
  }

  private validateDates(startDate: Date, endDate: Date): void {
    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {throw new Error('Invalid start date');}
    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {throw new Error('Invalid end date');}
    if (endDate <= startDate) {throw new Error('End date must be after start date');}
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (startDate < oneYearAgo) {throw new Error('Cannot block dates more than 1 year in the past');}
    const twoYearsFromNow = new Date(); twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
    if (endDate > twoYearsFromNow) {throw new Error('Cannot block dates more than 2 years in the future');}
  }
}

export function createDateBlocker(): DateBlocker { return new DateBlocker(); }
