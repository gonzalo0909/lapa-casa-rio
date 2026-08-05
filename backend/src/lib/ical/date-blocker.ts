// lapa-casa-hostel/backend/src/lib/ical/date-blocker.ts

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
    const { rows: roomRows } = await pool.query(`SELECT id FROM rooms WHERE id = $1`, [roomId]);
    if (roomRows.length === 0) throw new Error(`Room not found: ${roomId}`);
    const conflicts = await this.findConflicts(roomId, startDate, endDate);
    if (conflicts.length > 0) {
      const details = conflicts.map((c: any) =>
        `${c.guest_name} (${c.check_in.toISOString().split('T')[0]} - ${c.check_out.toISOString().split('T')[0]})`
      ).join(', ');
      throw new Error(`Cannot block dates: conflicts with existing bookings: ${details}`);
    }
    const blockKey = `block_${roomId}_${startDate.toISOString()}_${endDate.toISOString()}`;
    const { rows } = await pool.query(
      `INSERT INTO system_config (key, value, description)
       VALUES ($1, $2::jsonb, 'Date block')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
       RETURNING key`,
      [blockKey, JSON.stringify({ roomId, startDate, endDate, blockType, reason, notes })]
    );
    return rows[0].key;
  }

  async blockMultipleRanges(roomId: string, ranges: Array<{ startDate: Date; endDate: Date }>, reason?: string): Promise<string[]> {
    const ids: string[] = [];
    for (const range of ranges) ids.push(await this.blockDates({ roomId, startDate: range.startDate, endDate: range.endDate, reason }));
    return ids;
  }

  async unblockDates(blockKey: string): Promise<void> {
    const { rowCount } = await pool.query(`DELETE FROM system_config WHERE key = $1 AND key LIKE 'block_%'`, [blockKey]);
    if (rowCount === 0) throw new Error(`Block not found: ${blockKey}`);
  }

  async unblockDateRange(roomId: string, startDate: Date, endDate: Date): Promise<number> {
    this.validateDates(startDate, endDate);
    const { rows } = await pool.query(`SELECT key, value FROM system_config WHERE key LIKE 'block_%' AND value->>'roomId' = $1`, [roomId]);
    let count = 0;
    for (const row of rows) {
      const v = row.value;
      if (new Date(v.startDate) < endDate && new Date(v.endDate) > startDate) {
        await pool.query(`DELETE FROM system_config WHERE key = $1`, [row.key]);
        count++;
      }
    }
    return count;
  }

  async getBlockedDates(roomId: string, startDate?: Date, endDate?: Date): Promise<BlockedPeriod[]> {
    const { rows } = await pool.query(`SELECT key, value FROM system_config WHERE key LIKE 'block_%' AND value->>'roomId' = $1`, [roomId]);
    return rows.map((row: any) => {
      const v = row.value;
      const blockStart = new Date(v.startDate), blockEnd = new Date(v.endDate);
      if (startDate && endDate && !(blockStart < endDate && blockEnd > startDate)) return null;
      return { id: row.key, roomId: v.roomId, startDate: blockStart, endDate: blockEnd, blockType: v.blockType || 'other', reason: v.reason, notes: v.notes, createdAt: new Date() } as BlockedPeriod;
    }).filter(Boolean) as BlockedPeriod[];
  }

  async isDateBlocked(roomId: string, date: Date): Promise<boolean> {
    const blocks = await this.getBlockedDates(roomId);
    return blocks.some(b => b.startDate <= date && b.endDate > date);
  }

  async blockWeekdays(roomId: string, startDate: Date, endDate: Date, weekdays: number[], reason?: string): Promise<string[]> {
    this.validateDates(startDate, endDate);
    if (!weekdays.length) throw new Error('Weekdays array is required');
    const ids: string[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    while (current < endDate) {
      if (weekdays.includes(current.getDay())) {
        const next = new Date(current);
        next.setDate(next.getDate() + 1);
        try { ids.push(await this.blockDates({ roomId, startDate: new Date(current), endDate: next, reason, blockType: 'seasonal' })); } catch { }
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
       WHERE b.room_id = $1 AND r.status IN ('confirmed','pending_payment')
         AND rb.check_in < $3 AND rb.check_out > $2`,
      [roomId, startDate, endDate]
    );
    return rows;
  }

  private validateDates(startDate: Date, endDate: Date): void {
    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) throw new Error('Invalid start date');
    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) throw new Error('Invalid end date');
    if (endDate <= startDate) throw new Error('End date must be after start date');
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (startDate < oneYearAgo) throw new Error('Cannot block dates more than 1 year in the past');
    const twoYearsFromNow = new Date(); twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
    if (endDate > twoYearsFromNow) throw new Error('Cannot block dates more than 2 years in the future');
  }
}

export function createDateBlocker(): DateBlocker { return new DateBlocker(); }
