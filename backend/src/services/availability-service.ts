// lapa-casa-hostel/backend/src/services/availability-service.ts

import { query } from '../config/database';
import { logger } from '../utils/logger';
import redisClient from '../cache/redis-client';

export class AvailabilityService {
  async checkAvailability(
    checkIn: string,
    checkOut: string,
    gender: 'mixed' | 'female' | 'male' = 'mixed'
  ): Promise<Array<{ bed_id: string; room_type_id: string; bed_code: string }>> {
    const result = await query<{ bed_id: string; room_type_id: string; bed_code: string }>(
      `SELECT b.id AS bed_id, b.room_type_id, b.bed_code
       FROM beds b
       JOIN room_types rt ON b.room_type_id = rt.id
       WHERE b.is_active = true
         AND b.id NOT IN (
           SELECT rb.bed_id FROM reservation_beds rb
           JOIN reservations r ON rb.reservation_id = r.id
           WHERE r.status IN ('confirmed','pending_payment','pending_ota_confirmation')
             AND r.check_in_date < $2::date
             AND r.check_out_date > $1::date
         )
       ORDER BY rt.capacity DESC, b.bed_code`,
      [checkIn, checkOut]
    );
    return result.rows;
  }

  async checkRoomAvailability(
    roomTypeId: string,
    checkIn: string,
    checkOut: string
  ): Promise<{ available: number; occupied: number }> {
    const totalResult = await query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM beds WHERE room_type_id = $1 AND is_active = true`,
      [roomTypeId]
    );
    const total = parseInt(totalResult.rows[0].total, 10);

    const occupiedResult = await query<{ occupied: string }>(
      `SELECT COUNT(DISTINCT rb.bed_id)::int AS occupied
       FROM reservation_beds rb
       JOIN reservations r ON rb.reservation_id = r.id
       JOIN beds b ON rb.bed_id = b.id
       WHERE b.room_type_id = $1
         AND r.status IN ('confirmed','pending_payment','pending_ota_confirmation')
         AND r.check_in_date < $3::date
         AND r.check_out_date > $2::date`,
      [roomTypeId, checkIn, checkOut]
    );
    const occupied = parseInt(occupiedResult.rows[0].occupied, 10);
    return { available: Math.max(0, total - occupied), occupied };
  }

  async findAlternativeDates(
    checkIn: string,
    checkOut: string,
    bedsNeeded: number
  ): Promise<Array<{ checkIn: string; checkOut: string; availableBeds: number }>> {
    const nights = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    );
    const alternatives: Array<{ checkIn: string; checkOut: string; availableBeds: number }> = [];
    const base = new Date(checkIn);

    for (let offset = 1; offset <= 14 && alternatives.length < 5; offset++) {
      const altIn = new Date(base);
      altIn.setDate(altIn.getDate() + offset);
      const altOut = new Date(altIn);
      altOut.setDate(altOut.getDate() + nights);

      const altInStr = altIn.toISOString().split('T')[0];
      const altOutStr = altOut.toISOString().split('T')[0];

      const beds = await this.checkAvailability(altInStr, altOutStr);
      if (beds.length >= bedsNeeded) {
        alternatives.push({ checkIn: altInStr, checkOut: altOutStr, availableBeds: beds.length });
      }
    }

    return alternatives;
  }

  async getDailyOccupancy(from: string, to: string): Promise<Array<{
    date: string;
    occupied: number;
    available: number;
    total: number;
  }>> {
    const result = await query<{ date: string; occupied: string; total: string }>(
      `WITH dates AS (
         SELECT generate_series($1::date, $2::date - 1, '1 day')::date AS date
       ),
       daily AS (
         SELECT d.date,
                COUNT(DISTINCT rb.bed_id)::int AS occupied
         FROM dates d
         LEFT JOIN reservations r ON r.check_in_date <= d.date AND r.check_out_date > d.date
           AND r.status IN ('confirmed','pending_payment')
         LEFT JOIN reservation_beds rb ON rb.reservation_id = r.id
         GROUP BY d.date
       ),
       total_beds AS (SELECT COUNT(*)::int AS total FROM beds WHERE is_active = true)
       SELECT daily.date::text, daily.occupied, total_beds.total
       FROM daily CROSS JOIN total_beds
       ORDER BY daily.date`,
      [from, to]
    );

    return result.rows.map(r => ({
      date: r.date,
      occupied: parseInt(r.occupied, 10),
      total: parseInt(r.total, 10),
      available: parseInt(r.total, 10) - parseInt(r.occupied, 10),
    }));
  }

  async clearCache(): Promise<void> {
    await redisClient.delPattern('availability:*');
    logger.info('Availability cache cleared');
  }
}

export const availabilityService = new AvailabilityService();
