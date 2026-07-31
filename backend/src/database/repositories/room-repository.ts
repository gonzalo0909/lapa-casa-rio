// lapa-casa-hostel/backend/src/database/repositories/room-repository.ts

import { PrismaClient, Room, RoomType, RoomStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class RoomRepository {
  async findAll(): Promise<Room[]> {
    return await prisma.room.findMany({
      where: { status: RoomStatus.ACTIVE },
      orderBy: { capacity: 'desc' }
    });
  }

  async findById(id: string): Promise<Room | null> {
    return await prisma.room.findUnique({
      where: { id }
    });
  }

  async findByCode(roomCode: string): Promise<Room | null> {
    return await prisma.room.findUnique({
      where: { roomCode }
    });
  }

  async findByType(type: RoomType): Promise<Room[]> {
    return await prisma.room.findMany({
      where: {
        type,
        status: RoomStatus.ACTIVE
      },
      orderBy: { capacity: 'desc' }
    });
  }

  async findFlexibleRoom(): Promise<Room | null> {
    return await prisma.room.findFirst({
      where: {
        isFlexible: true,
        status: RoomStatus.ACTIVE
      }
    });
  }

  async findWithAvailability(checkInDate: Date, checkOutDate: Date, minimumBeds: number): Promise<Room[]> {
    const rooms = await prisma.room.findMany({
      where: { status: RoomStatus.ACTIVE },
      include: {
        availability: {
          where: {
            date: { gte: checkInDate, lt: checkOutDate },
            isAvailable: true
          }
        }
      }
    });

    return rooms.filter(room => {
      if (room.availability.length === 0) return false;
      const minAvailable = Math.min(...room.availability.map(a => a.availableBeds));
      return minAvailable >= minimumBeds;
    });
  }

  async create(data: {
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
    metadata?: any;
  }): Promise<Room> {
    return await prisma.room.create({
      data: {
        ...data,
        status: RoomStatus.ACTIVE
      }
    });
  }

  async update(id: string, data: Partial<Room>): Promise<Room> {
    return await prisma.room.update({
      where: { id },
      data
    });
  }

  async updateStatus(id: string, status: RoomStatus): Promise<Room> {
    return await prisma.room.update({
      where: { id },
      data: { status }
    });
  }

  async updateType(id: string, type: RoomType): Promise<Room> {
    return await prisma.room.update({
      where: { id },
      data: { type }
    });
  }

  async updatePrice(id: string, basePrice: number): Promise<Room> {
    return await prisma.room.update({
      where: { id },
      data: { basePrice }
    });
  }

  async delete(id: string): Promise<Room> {
    return await prisma.room.update({
      where: { id },
      data: { status: RoomStatus.INACTIVE }
    });
  }

  async getAvailabilityForDateRange(id: string, checkInDate: Date, checkOutDate: Date): Promise<any[]> {
    return await prisma.roomAvailability.findMany({
      where: {
        roomId: id,
        date: { gte: checkInDate, lt: checkOutDate }
      },
      orderBy: { date: 'asc' }
    });
  }

  async checkCapacity(
    id: string,
    checkInDate: Date,
    checkOutDate: Date,
    requestedBeds: number
  ): Promise<{ available: boolean; availableBeds: number; message?: string }> {
    const availability = await this.getAvailabilityForDateRange(id, checkInDate, checkOutDate);

    if (availability.length === 0) {
      return { available: false, availableBeds: 0, message: 'No availability data' };
    }

    const minAvailable = Math.min(...availability.map(a => a.availableBeds));

    if (minAvailable < requestedBeds) {
      return {
        available: false,
        availableBeds: minAvailable,
        message: `Only ${minAvailable} beds available`
      };
    }

    return { available: true, availableBeds: minAvailable };
  }

  async getOccupiedBeds(id: string, checkInDate: Date, checkOutDate: Date): Promise<number> {
    const bookings = await prisma.booking.findMany({
      where: {
        roomId: id,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        OR: [
          { AND: [{ checkInDate: { lte: checkInDate } }, { checkOutDate: { gt: checkInDate } }] },
          { AND: [{ checkInDate: { lt: checkOutDate } }, { checkOutDate: { gte: checkOutDate } }] },
          { AND: [{ checkInDate: { gte: checkInDate } }, { checkOutDate: { lte: checkOutDate } }] }
        ]
      },
      select: { bedsCount: true }
    });

    return bookings.reduce((total, b) => total + b.bedsCount, 0);
  }

  async getBookingsForDateRange(id: string, checkInDate: Date, checkOutDate: Date): Promise<any[]> {
    return await prisma.booking.findMany({
      where: {
        roomId: id,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        OR: [
          { AND: [{ checkInDate: { lte: checkInDate } }, { checkOutDate: { gt: checkInDate } }] },
          { AND: [{ checkInDate: { lt: checkOutDate } }, { checkOutDate: { gte: checkOutDate } }] },
          { AND: [{ checkInDate: { gte: checkInDate } }, { checkOutDate: { lte: checkOutDate } }] }
        ]
      },
      include: { guest: true },
      orderBy: { checkInDate: 'asc' }
    });
  }

  async getStatistics(id: string): Promise<{
    totalBookings: number;
    totalRevenue: number;
    averageOccupancy: number;
    upcomingBookings: number;
  }> {
    const [totalBookings, revenue, upcomingBookings] = await Promise.all([
      prisma.booking.count({
        where: { roomId: id, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } }
      }),
      prisma.booking.aggregate({
        where: { roomId: id, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
        _sum: { totalPrice: true }
      }),
      prisma.booking.count({
        where: { roomId: id, status: 'CONFIRMED', checkInDate: { gte: new Date() } }
      })
    ]);

    const room = await this.findById(id);
    const capacity = room?.capacity || 1;

    const bookings = await prisma.booking.findMany({
      where: { roomId: id, status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] } },
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

  async bulkUpdateAvailability(updates: Array<{
    roomId: string;
    date: Date;
    availableBeds: number;
    isAvailable: boolean;
  }>): Promise<void> {
    for (const update of updates) {
      await prisma.roomAvailability.updateMany({
        where: {
          roomId: update.roomId,
          date: update.date
        },
        data: {
          availableBeds: update.availableBeds,
          isAvailable: update.isAvailable
        }
      });
    }
  }
}

export default new RoomRepository();
