// lapa-casa-hostel/backend/src/database/repositories/room-repository.ts

import { query } from '../../config/database';
import type { RoomType, Bed } from '../../types/database';

export class RoomRepository {
  async findAllRoomTypes(): Promise<RoomType[]> {
    const result = await query<RoomType>(
      `SELECT * FROM room_types ORDER BY capacity DESC`
    );
    return result.rows;
  }

  async findRoomTypeById(id: string): Promise<RoomType | null> {
    const result = await query<RoomType>(
      `SELECT * FROM room_types WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findRoomTypeByCode(code: string): Promise<RoomType | null> {
    const result = await query<RoomType>(
      `SELECT * FROM room_types WHERE code = $1`,
      [code]
    );
    return result.rows[0] ?? null;
  }

  async findFlexibleRoom(): Promise<RoomType | null> {
    const result = await query<RoomType>(
      `SELECT * FROM room_types WHERE is_flexible = true LIMIT 1`
    );
    return result.rows[0] ?? null;
  }

  async findBedsByRoomType(roomTypeId: string): Promise<Bed[]> {
    const result = await query<Bed>(
      `SELECT * FROM beds WHERE room_type_id = $1 AND is_active = true ORDER BY bed_code`,
      [roomTypeId]
    );
    return result.rows;
  }

  async getOccupancyStats(
    roomTypeId: string,
    checkIn: string,
    checkOut: string
  ): Promise<{ totalBeds: number; availableBeds: number; occupiedBeds: number }> {
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

    return {
      totalBeds: total,
      availableBeds: Math.max(0, total - occupied),
      occupiedBeds: occupied,
    };
  }

  async getAvailableBeds(
    roomTypeId: string,
    checkIn: string,
    checkOut: string
  ): Promise<Bed[]> {
    const result = await query<Bed>(
      `SELECT b.* FROM beds b
       WHERE b.room_type_id = $1
         AND b.is_active = true
         AND b.id NOT IN (
           SELECT rb.bed_id FROM reservation_beds rb
           JOIN reservations r ON rb.reservation_id = r.id
           WHERE r.status IN ('confirmed','pending_payment','pending_ota_confirmation')
             AND r.check_in_date < $3::date
             AND r.check_out_date > $2::date
         )
       ORDER BY b.bed_code`,
      [roomTypeId, checkIn, checkOut]
    );
    return result.rows;
  }

  async updateRoomTypePrice(id: string, basePrice: number): Promise<RoomType> {
    const result = await query<RoomType>(
      `UPDATE room_types SET base_price = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, basePrice]
    );
    return result.rows[0];
  }

  async updateFlexibleRoomGender(id: string, gender: 'mixed' | 'female' | 'male'): Promise<RoomType> {
    const result = await query<RoomType>(
      `UPDATE room_types SET default_gender = $2::bed_gender, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, gender]
    );
    return result.rows[0];
  }

  async getStatistics(): Promise<{
    totalRooms: number;
    totalBeds: number;
    activeBeds: number;
  }> {
    const result = await query<{ rooms: string; total_beds: string; active_beds: string }>(
      `SELECT
         COUNT(DISTINCT rt.id)::int AS rooms,
         COUNT(b.id)::int AS total_beds,
         COUNT(b.id) FILTER (WHERE b.is_active = true)::int AS active_beds
       FROM room_types rt
       LEFT JOIN beds b ON b.room_type_id = rt.id`
    );
    const row = result.rows[0];
    return {
      totalRooms: parseInt(row.rooms, 10),
      totalBeds: parseInt(row.total_beds, 10),
      activeBeds: parseInt(row.active_beds, 10),
    };
  }
}

export default new RoomRepository();
