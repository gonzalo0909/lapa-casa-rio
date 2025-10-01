// lapa-casa-hostel/backend/src/database/models/room.ts

import { PrismaClient, Room, RoomType, RoomStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class RoomModel {
  static async getAllRooms(): Promise<Room[]> {
    return await prisma.room.findMany({
      where: { status: RoomStatus.ACTIVE },
      orderBy: { capacity: 'desc' }
    });
  }

  static async getRoomById(roomId: string): Promise<Room | null> {
    return await prisma.room.findUnique({
      where: { id: roomId }
    });
  }

  static async getRoomByCode(roomCode: string): Promise<Room | null> {
    return await prisma.room.findUnique({
      where: { roomCode }
    });
  }

  static async getFlexibleRoom(): Promise<Room | null> {
    return await prisma.room.findFirst({
      where: { isFlexible: true, status: RoomStatus.ACTIVE }
    });
  }

  static async getRoomsByType(type: RoomType): Promise<Room[]> {
    return await prisma.room.findMany({
      where: { type, status: RoomStatus.ACTIVE },
      orderBy: { capacity: 'desc' }
    });
  }

  static async getRoomAvailability(roomId: string, checkInDate: Date, checkOutDate: Date): Promise<any[]> {
    return await prisma.roomAvailability.findMany({
      where: {
        roomId,
        date: { gte: checkInDate, lt: checkOutDate }
      },
      orderBy: { date: 'asc' }
    });
  }

  static async checkRoomCapacity(
    roomId: string,
    checkInDate: Date,
    checkOutDate: Date,
    requestedBeds: number
  ): Promise<{ available: boolean; availableBeds: number; message?: string }> {
    const availability = await this.getRoomAvailability(roomId, checkInDate, checkOutDate);

    if (availability.length === 0) {
      return { available: false, availableBeds: 0, message: 'No availability data for selected dates' };
    }

    const minAvailable = Math.min(...availability.map(a => a.availableBeds));

    if (minAvailable < requestedBeds) {
      return {
        available: false,
        availableBeds: minAvailable,
        message: `Only ${minAvailable} beds available. Requested: ${requestedBeds}`
      };
    }

    return { available: true, availableBeds: minAvailable };
  }

  static async getOccupiedBeds(roomId: string, checkInDate: Date, checkOutDate: Date): Promise<number> {
    const bookings = await prisma.booking.findMany({
      where: {
        roomId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        OR: [
          { AND: [{ checkInDate: { lte: checkInDate } }, { checkOutDate: { gt: checkInDate } }] },
          { AND: [{ checkInDate: { lt: checkOutDate } }, { checkOutDate: { gte: checkOutDate } }] },
          { AND: [{ checkInDate: { gte: checkInDate } }, { checkOutDate: { lte: checkOutDate } }] }
        ]
      },
      select: { bedsCount: true }
    });

    return bookings.reduce((total, booking) => total + booking.bedsCount, 0);
  }

  static async updateRoomStatus(roomId: string, status: RoomStatus): Promise<Room> {
    return await prisma.room.update({
      where: { id: roomId },
      data: { status }
    });
  }

  static async updateRoomType(roomId: string, type: RoomType): Promise<Room> {
    return await prisma.room.update({
      where: { id: roomId },
      data: { type }
    });
  }

  static async updateRoomPrice(roomId: string, basePrice: number): Promise<Room> {
    return await prisma.room.update({
      where: { id: roomId },
      data: { basePrice }
    });
  }

  static async checkFlexibleRoomConversion(
    roomId: string,
    checkInDate: Date
  ): Promise<{ shouldConvert: boolean; currentType: RoomType; hoursUntilCheckIn: number }> {
    const room = await this.getRoomById(roomId);

    if (!room || !room.isFlexible) {
      return { shouldConvert: false, currentType: RoomType.MIXED, hoursUntilCheckIn: 0 };
    }

    const now = new Date();
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilCheckIn > (room.autoConvertHours || 48)) {
      return { shouldConvert: false, currentType: room.type, hoursUntilCheckIn };
    }

    const femaleBookings = await prisma.booking.findMany({
      where: {
        roomId,
        checkInDate: { lte: checkInDate },
        checkOutDate: { gt: checkInDate },
        status: { in: ['CONFIRMED', 'CHECKED_IN'] }
      }
    });

    const shouldConvert = femaleBookings.length === 0 && room.type === RoomType.FEMALE;

    return { shouldConvert, currentType: room.type, hoursUntilCheckIn };
  }

  static async autoConvertFlexibleRoom(
    roomId: string,
    checkInDate: Date
  ): Promise<{ converted: boolean; newType?: RoomType }> {
    const conversionCheck = await this.checkFlexibleRoomConversion(roomId, checkInDate);

    if (!conversionCheck.shouldConvert) {
      return { converted: false };
    }

    const updatedRoom = await this.updateRoomType(roomId, RoomType.MIXED);

    return { converted: true, newType: updatedRoom.type };
  }

  static async getRoomStats(roomId: string): Promise<{
    totalBookings: number;
    totalRevenue: number;
    averageOccupancy: number;
    upcomingBookings: number;
  }> {
    const [totalBookings, revenue, upcomingBookings] = await Promise.all([
      prisma.booking.count({
        where: { roomId, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } }
      }),
      prisma.booking.aggregate({
        where: { roomId, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
        _sum: { totalPrice: true }
      }),
      prisma.booking.count({
        where: { roomId, status: 'CONFIRMED', checkInDate: { gte: new Date() } }
      })
    ]);

    const room = await this.getRoomById(roomId);
    const capacity = room?.capacity || 1;

    const bookings = await prisma.booking.findMany({
      where: { roomId, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
      select: { bedsCount: true, nightsCount: true }
    });

    const totalBedNights = bookings.reduce((sum, b) => sum + (b.bedsCount * b.nightsCount), 0);
    const totalNights = bookings.reduce((sum, b) => sum + b.nightsCount, 0);
    const averageOccupancy = totalNights > 0 ? (totalBedNights / (totalNights * capacity)) * 100 : 0;

    return {
      totalBookings,
      totalRevenue: Number(revenue._sum.totalPrice || 0),
      averageOccupancy: Math.round(averageOccupancy * 100) / 100,
      upcomingBookings
    };
  }

  static async createRoom(data: {
    roomCode: string;
    name: string;
    capacity: number;
    type: RoomType;
    isFlexible?: boolean;
    basePrice: number;
    description?: string;
    amenities?: any;
    images?: any;
    autoConvertHours?: number;
  }): Promise<Room> {
    return await prisma.room.create({
      data: { ...data, status: RoomStatus.ACTIVE }
    });
  }

  static async updateRoom(roomId: string, data: Partial<Prisma.RoomUpdateInput>): Promise<Room> {
    return await prisma.room.update({
      where: { id: roomId },
      data
    });
  }

  static async deleteRoom(roomId: string): Promise<Room> {
    return await prisma.room.update({
      where: { id: roomId },
      data: { status: RoomStatus.INACTIVE }
    });
  }
}
