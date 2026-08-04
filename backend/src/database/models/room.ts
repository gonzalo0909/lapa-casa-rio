// lapa-casa-hostel/backend/src/database/models/room.ts

import { prisma } from '../../config/prisma';
import { RoomType as Room, BedGender } from '../../types/database';

function toRoom(row: any): Room {
  return row as unknown as Room;
}

export class RoomModel {
  static async getAllRooms(): Promise<Room[]> {
    const rows = await prisma.room_types.findMany({
      orderBy: { capacity: 'desc' },
    });
    return rows.map(toRoom);
  }

  static async getRoomById(id: string): Promise<Room | null> {
    const r = await prisma.room_types.findUnique({ where: { id } });
    return r ? toRoom(r) : null;
  }

  static async getFlexibleRoom(): Promise<Room | null> {
    const r = await prisma.room_types.findFirst({ where: { is_flexible: true } });
    return r ? toRoom(r) : null;
  }

  static async checkRoomCapacity(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    requestedBeds: number
  ): Promise<{ available: boolean; availableBeds: number; message?: string }> {
    const rows = await prisma.$queryRaw<[{ capacity: number; occupied: number }]>`
      SELECT rt.capacity,
             COUNT(rb.id) FILTER (WHERE rb.id IS NOT NULL)::int AS occupied
      FROM room_types rt
      LEFT JOIN beds b ON b.room_type_id = rt.id
      LEFT JOIN reservation_beds rb ON rb.bed_id = b.id
        AND rb.check_in < ${checkOut}::date AND rb.check_out > ${checkIn}::date
        AND EXISTS (
          SELECT 1 FROM reservations res WHERE res.id = rb.reservation_id
            AND res.status IN ('confirmed','pending_payment')
        )
      WHERE rt.id = ${roomId}::uuid
      GROUP BY rt.capacity
    `;
    if (rows.length === 0) return { available: false, availableBeds: 0, message: 'Room not found' };
    const available = rows[0].capacity - Number(rows[0].occupied);
    if (available < requestedBeds) {
      return { available: false, availableBeds: available, message: `Only ${available} beds available. Requested: ${requestedBeds}` };
    }
    return { available: true, availableBeds: available };
  }

  static async getOccupiedBeds(roomId: string, checkIn: Date, checkOut: Date): Promise<number> {
    const rows = await prisma.$queryRaw<[{ occupied: number }]>`
      SELECT COUNT(rb.id)::int AS occupied
      FROM reservation_beds rb
      JOIN beds b ON b.id = rb.bed_id
      JOIN reservations r ON r.id = rb.reservation_id
      WHERE b.room_type_id = ${roomId}::uuid
        AND r.status IN ('confirmed','pending_payment')
        AND rb.check_in < ${checkOut}::date AND rb.check_out > ${checkIn}::date
    `;
    return Number(rows[0].occupied);
  }

  static async setRoomGender(roomId: string, gender: BedGender): Promise<Room> {
    const r = await prisma.room_types.update({
      where: { id: roomId },
      data: { default_gender: gender as any, updated_at: new Date() },
    });
    return toRoom(r);
  }

  static async getFlexibleRoomStatus(roomId: string, checkIn: Date): Promise<any> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT * FROM get_flexible_room_status(${roomId}::uuid, ${checkIn}::date)
    `;
    return rows[0] || null;
  }

  static async getRoomStats(roomId: string): Promise<{
    totalBookings: number;
    totalRevenue: number;
    upcomingBookings: number;
  }> {
    const rows = await prisma.$queryRaw<[{ total: number; revenue: number; upcoming: number }]>`
      SELECT
        COUNT(DISTINCT r.id)::int AS total,
        COALESCE(SUM(r.final_price) FILTER (WHERE r.status IN ('confirmed','completed')), 0)::float8 AS revenue,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'confirmed' AND r.check_in_date >= NOW())::int AS upcoming
      FROM reservations r
      JOIN reservation_beds rb ON rb.reservation_id = r.id
      JOIN beds b ON b.id = rb.bed_id
      WHERE b.room_type_id = ${roomId}::uuid
    `;
    return {
      totalBookings: Number(rows[0].total),
      totalRevenue: Number(rows[0].revenue),
      upcomingBookings: Number(rows[0].upcoming),
    };
  }
}
