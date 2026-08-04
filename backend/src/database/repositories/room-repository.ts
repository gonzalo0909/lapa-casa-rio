// lapa-casa-hostel/backend/src/database/repositories/room-repository.ts

import { prisma } from '../../config/prisma';
import type { RoomType, Bed } from '../../types/database';

export class RoomRepository {
  async findAllRoomTypes(): Promise<RoomType[]> {
    const rows = await prisma.room_types.findMany({
      orderBy: { capacity: 'desc' },
    });
    return rows as unknown as RoomType[];
  }

  async findRoomTypeById(id: string): Promise<RoomType | null> {
    const r = await prisma.room_types.findUnique({ where: { id } });
    return r ? (r as unknown as RoomType) : null;
  }

  async findRoomTypeByCode(code: string): Promise<RoomType | null> {
    const r = await prisma.room_types.findUnique({ where: { code } });
    return r ? (r as unknown as RoomType) : null;
  }

  async findFlexibleRoom(): Promise<RoomType | null> {
    const r = await prisma.room_types.findFirst({ where: { is_flexible: true } });
    return r ? (r as unknown as RoomType) : null;
  }

  async findBedsByRoomType(roomTypeId: string): Promise<Bed[]> {
    const rows = await prisma.beds.findMany({
      where: { room_type_id: roomTypeId, is_active: true },
      orderBy: { bed_code: 'asc' },
    });
    return rows as unknown as Bed[];
  }

  async getOccupancyStats(
    roomTypeId: string,
    checkIn: string,
    checkOut: string
  ): Promise<{ totalBeds: number; availableBeds: number; occupiedBeds: number }> {
    const [totalBeds, occupied] = await Promise.all([
      prisma.beds.count({ where: { room_type_id: roomTypeId, is_active: true } }),
      prisma.$queryRaw<[{ occupied: number }]>`
        SELECT COUNT(DISTINCT rb.bed_id)::int AS occupied
        FROM reservation_beds rb
        JOIN reservations r ON rb.reservation_id = r.id
        JOIN beds b ON rb.bed_id = b.id
        WHERE b.room_type_id = ${roomTypeId}::uuid
          AND r.status IN ('confirmed','pending_payment','pending_ota_confirmation')
          AND r.check_in_date < ${checkOut}::date
          AND r.check_out_date > ${checkIn}::date
      `,
    ]);
    const occupiedBeds = Number(occupied[0].occupied);
    return {
      totalBeds,
      availableBeds: Math.max(0, totalBeds - occupiedBeds),
      occupiedBeds,
    };
  }

  async getAvailableBeds(
    roomTypeId: string,
    checkIn: string,
    checkOut: string
  ): Promise<Bed[]> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT b.* FROM beds b
      WHERE b.room_type_id = ${roomTypeId}::uuid
        AND b.is_active = true
        AND b.id NOT IN (
          SELECT rb.bed_id FROM reservation_beds rb
          JOIN reservations r ON rb.reservation_id = r.id
          WHERE r.status IN ('confirmed','pending_payment','pending_ota_confirmation')
            AND r.check_in_date < ${checkOut}::date
            AND r.check_out_date > ${checkIn}::date
        )
      ORDER BY b.bed_code
    `;
    return rows as unknown as Bed[];
  }

  async updateRoomTypePrice(id: string, basePrice: number): Promise<RoomType> {
    const r = await prisma.room_types.update({
      where: { id },
      data: { base_price: basePrice, updated_at: new Date() },
    });
    return r as unknown as RoomType;
  }

  async updateFlexibleRoomGender(id: string, gender: 'mixed' | 'female' | 'male'): Promise<RoomType> {
    const r = await prisma.room_types.update({
      where: { id },
      data: { default_gender: gender as any, updated_at: new Date() },
    });
    return r as unknown as RoomType;
  }

  async getStatistics(): Promise<{
    totalRooms: number;
    totalBeds: number;
    activeBeds: number;
  }> {
    const [totalRooms, totalBeds, activeBeds] = await Promise.all([
      prisma.room_types.count(),
      prisma.beds.count(),
      prisma.beds.count({ where: { is_active: true } }),
    ]);
    return { totalRooms, totalBeds, activeBeds };
  }
}

export default new RoomRepository();
