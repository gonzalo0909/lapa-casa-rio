// lapa-casa-hostel/backend/src/database/models/room.ts

import { pool } from '../../config/database';
import { Room, BedGender } from '../../types/database';

export class RoomModel {
  static async getAllRooms(): Promise<Room[]> {
    const { rows } = await pool.query(`SELECT * FROM rooms WHERE is_active = true ORDER BY capacity DESC`);
    return rows;
  }

  static async getRoomById(id: string): Promise<Room | null> {
    const { rows } = await pool.query(`SELECT * FROM rooms WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  static async getFlexibleRoom(): Promise<Room | null> {
    const { rows } = await pool.query(`SELECT * FROM rooms WHERE is_flexible = true AND is_active = true LIMIT 1`);
    return rows[0] || null;
  }

  static async checkRoomCapacity(
    roomId: string, checkIn: Date, checkOut: Date, requestedBeds: number
  ): Promise<{ available: boolean; availableBeds: number; message?: string }> {
    const { rows } = await pool.query(
      `SELECT r.capacity,
              COUNT(rb.id) FILTER (WHERE rb.id IS NOT NULL) AS occupied
       FROM rooms r
       LEFT JOIN beds b ON b.room_id = r.id
       LEFT JOIN reservation_beds rb ON rb.bed_id = b.id
         AND rb.check_in < $3 AND rb.check_out > $2
         AND EXISTS (
           SELECT 1 FROM reservations res WHERE res.id = rb.reservation_id
             AND res.status IN ('confirmed','pending_payment')
         )
       WHERE r.id = $1
       GROUP BY r.capacity`,
      [roomId, checkIn, checkOut]
    );
    if (rows.length === 0) return { available: false, availableBeds: 0, message: 'Room not found' };
    const available = rows[0].capacity - Number(rows[0].occupied);
    if (available < requestedBeds) return { available: false, availableBeds: available, message: `Only ${available} beds available. Requested: ${requestedBeds}` };
    return { available: true, availableBeds: available };
  }

  static async getOccupiedBeds(roomId: string, checkIn: Date, checkOut: Date): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COUNT(rb.id) AS occupied
       FROM reservation_beds rb
       JOIN beds b ON b.id = rb.bed_id
       JOIN reservations r ON r.id = rb.reservation_id
       WHERE b.room_id = $1
         AND r.status IN ('confirmed','pending_payment')
         AND rb.check_in < $3 AND rb.check_out > $2`,
      [roomId, checkIn, checkOut]
    );
    return Number(rows[0].occupied);
  }

  static async setRoomGender(roomId: string, gender: BedGender): Promise<Room> {
    const { rows } = await pool.query(
      `UPDATE rooms SET gender = $1::bed_gender, updated_at = NOW() WHERE id = $2 RETURNING *`, [gender, roomId]
    );
    return rows[0];
  }

  static async setRoomActive(roomId: string, isActive: boolean): Promise<Room> {
    const { rows } = await pool.query(
      `UPDATE rooms SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [isActive, roomId]
    );
    return rows[0];
  }

  static async getFlexibleRoomStatus(roomId: string, checkIn: Date): Promise<any> {
    const { rows } = await pool.query(
      `SELECT * FROM get_flexible_room_status($1, $2::date)`, [roomId, checkIn]
    );
    return rows[0] || null;
  }

  static async getRoomStats(roomId: string): Promise<{
    totalBookings: number; totalRevenue: number; upcomingBookings: number;
  }> {
    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT r.id) AS total,
        COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('confirmed','completed')), 0) AS revenue,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'confirmed' AND r.check_in >= NOW()) AS upcoming
      FROM reservations r
      JOIN reservation_beds rb ON rb.reservation_id = r.id
      JOIN beds b ON b.id = rb.bed_id
      WHERE b.room_id = $1`,
      [roomId]
    );
    return { totalBookings: Number(rows[0].total), totalRevenue: Number(rows[0].revenue), upcomingBookings: Number(rows[0].upcoming) };
  }
}
