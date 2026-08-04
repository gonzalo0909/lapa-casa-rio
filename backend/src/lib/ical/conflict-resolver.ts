// lapa-casa-hostel/backend/src/lib/ical/conflict-resolver.ts

import { pool } from '../../config/database';
import { ParsedBooking } from '../../integrations/ical/ical-parser';

export interface ConflictingBooking {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  platform: string;
  source: string;
  createdAt: Date;
}

export interface ConflictResolution {
  canProceed: boolean;
  action: 'keep_existing' | 'replace' | 'merge' | 'skip' | 'block';
  reason: string;
  conflictsResolved: number;
  bookingsModified: string[];
}

export type ResolutionStrategy = 'platform_priority' | 'newest_wins' | 'oldest_wins' | 'manual' | 'ical_priority';

const PLATFORM_PRIORITY: Record<string, number> = {
  direct: 100, airbnb: 80, booking: 80, expedia: 70,
  vrbo: 70, hostelworld: 60, internal: 50, unknown: 10,
};

export class ConflictResolver {
  private strategy: ResolutionStrategy;

  constructor(strategy: ResolutionStrategy = 'platform_priority') {
    this.strategy = strategy;
  }

  async findConflicts(roomId: string, checkIn: Date, checkOut: Date, excludeId?: string): Promise<ConflictingBooking[]> {
    let sql = `
      SELECT r.id, g.full_name AS "guestName", rb.check_in AS "checkIn", rb.check_out AS "checkOut",
             r.status, c.code AS platform, r.channel_code AS source, r.created_at AS "createdAt"
      FROM reservations r
      JOIN guests g ON g.id = r.guest_id
      JOIN reservation_beds rb ON rb.reservation_id = r.id
      JOIN channels c ON c.id = r.channel_id
      WHERE r.status IN ('confirmed','pending_payment')
        AND rb.check_in < $2 AND rb.check_out > $1
    `;
    const params: any[] = [checkIn, checkOut];
    if (excludeId) { params.push(excludeId); sql += ` AND r.id != $${params.length}`; }
    const { rows } = await pool.query(sql, params);
    return rows;
  }

  async resolveConflicts(conflicts: ConflictingBooking[], newBooking: ParsedBooking, platform: string): Promise<ConflictResolution> {
    if (conflicts.length === 0) return { canProceed: true, action: 'keep_existing', reason: 'No conflicts found', conflictsResolved: 0, bookingsModified: [] };
    switch (this.strategy) {
      case 'platform_priority': return this.resolveByPlatformPriority(conflicts, newBooking, platform);
      case 'newest_wins': return this.resolveByNewest(conflicts);
      case 'oldest_wins': return { canProceed: false, action: 'skip', reason: 'Older booking takes precedence', conflictsResolved: 0, bookingsModified: [] };
      case 'ical_priority': return this.resolveByICalPriority(conflicts);
      case 'manual': return { canProceed: false, action: 'skip', reason: 'Manual resolution required', conflictsResolved: 0, bookingsModified: [] };
      default: return this.resolveByPlatformPriority(conflicts, newBooking, platform);
    }
  }

  private async resolveByPlatformPriority(conflicts: ConflictingBooking[], newBooking: ParsedBooking, platform: string): Promise<ConflictResolution> {
    const newPriority = PLATFORM_PRIORITY[platform.toLowerCase()] || PLATFORM_PRIORITY.unknown;
    const bookingsModified: string[] = [];
    let conflictsResolved = 0;
    for (const conflict of conflicts) {
      const existingPriority = PLATFORM_PRIORITY[conflict.platform.toLowerCase()] || PLATFORM_PRIORITY.unknown;
      if (newPriority > existingPriority) {
        await pool.query(`UPDATE reservations SET status = 'cancelled' WHERE id = $1`, [conflict.id]);
        bookingsModified.push(conflict.id);
        conflictsResolved++;
      } else if (newPriority < existingPriority) {
        return { canProceed: false, action: 'skip', reason: `Existing ${conflict.platform} booking has higher priority`, conflictsResolved: 0, bookingsModified: [] };
      } else if (conflict.source === 'ical') {
        return { canProceed: false, action: 'skip', reason: 'Identical priority booking already exists', conflictsResolved: 0, bookingsModified: [] };
      }
    }
    return { canProceed: true, action: conflictsResolved > 0 ? 'replace' : 'keep_existing', reason: `Resolved ${conflictsResolved} conflicts based on platform priority`, conflictsResolved, bookingsModified };
  }

  private async resolveByNewest(conflicts: ConflictingBooking[]): Promise<ConflictResolution> {
    const bookingsModified: string[] = [];
    for (const conflict of conflicts) {
      await pool.query(`UPDATE reservations SET status = 'cancelled' WHERE id = $1`, [conflict.id]);
      bookingsModified.push(conflict.id);
    }
    return { canProceed: true, action: 'replace', reason: 'Newer booking takes precedence', conflictsResolved: conflicts.length, bookingsModified };
  }

  private async resolveByICalPriority(conflicts: ConflictingBooking[]): Promise<ConflictResolution> {
    const bookingsModified: string[] = [];
    for (const conflict of conflicts) {
      if (conflict.source === 'ical' || conflict.platform === 'direct') {
        return { canProceed: false, action: 'skip', reason: `Cannot override ${conflict.source} booking`, conflictsResolved: 0, bookingsModified: [] };
      }
      await pool.query(`UPDATE reservations SET status = 'cancelled' WHERE id = $1`, [conflict.id]);
      bookingsModified.push(conflict.id);
    }
    return { canProceed: true, action: 'replace', reason: 'iCal import takes precedence over manual bookings', conflictsResolved: conflicts.length, bookingsModified };
  }

  async findPotentialDuplicates(roomId: string, booking: ParsedBooking): Promise<ConflictingBooking[]> {
    const { rows } = await pool.query(
      `SELECT r.id, g.full_name AS "guestName", rb.check_in AS "checkIn", rb.check_out AS "checkOut",
              r.status, c.code AS platform, r.channel_code AS source, r.created_at AS "createdAt"
       FROM reservations r
       JOIN guests g ON g.id = r.guest_id
       JOIN reservation_beds rb ON rb.reservation_id = r.id
       JOIN channels c ON c.id = r.channel_id
       WHERE r.status IN ('confirmed','pending_payment')
         AND rb.check_in = $1 AND rb.check_out = $2`,
      [booking.checkIn, booking.checkOut]
    );
    return rows;
  }

  analyzeConflict(existing: ConflictingBooking, newBooking: ParsedBooking, platform: string) {
    const overlapStart = new Date(Math.max(existing.checkIn.getTime(), newBooking.checkIn.getTime()));
    const overlapEnd = new Date(Math.min(existing.checkOut.getTime(), newBooking.checkOut.getTime()));
    const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / 86400000));
    const totalDays = Math.ceil((newBooking.checkOut.getTime() - newBooking.checkIn.getTime()) / 86400000);
    const newPriority = PLATFORM_PRIORITY[platform.toLowerCase()] || PLATFORM_PRIORITY.unknown;
    const existingPriority = PLATFORM_PRIORITY[existing.platform.toLowerCase()] || PLATFORM_PRIORITY.unknown;
    const priorityDifference = newPriority - existingPriority;
    return {
      overlap: { days: overlapDays, percentage: Math.round((overlapDays / totalDays) * 100) },
      priorityDifference,
      recommendation: priorityDifference > 0 ? 'Replace existing booking with new import'
        : priorityDifference < 0 ? 'Keep existing booking, skip import'
        : 'Equal priority - use secondary criteria'
    };
  }

  setStrategy(strategy: ResolutionStrategy): void { this.strategy = strategy; }
  getStrategy(): ResolutionStrategy { return this.strategy; }
}

export function createConflictResolver(strategy?: ResolutionStrategy): ConflictResolver {
  return new ConflictResolver(strategy);
}
