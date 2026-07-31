// lapa-casa-hostel/backend/src/services/availability-service.ts

import { PrismaClient } from '@prisma/client';
import { parseISO, differenceInHours, addDays, eachDayOfInterval } from 'date-fns';
import { RoomRepository } from '../database/repositories/room-repository';
import { BookingRepository } from '../database/repositories/booking-repository';
import { RedisClient } from '../cache/redis-client';
import { logger } from '../utils/logger';
import { AppError } from '../utils/responses';

interface RoomAvailability {
  roomId: string;
  roomName: string;
  capacity: number;
  occupiedBeds: number;
  availableBeds: number;
  isFlexible: boolean;
  currentType: 'mixed' | 'female';
  willConvertToMixed: boolean;
  conversionHoursRemaining?: number;
}

interface AvailabilityResponse {
  available: boolean;
  totalBedsAvailable: number;
  roomsAvailable: RoomAvailability[];
  recommendedAllocation?: Array<{ roomId: string; bedsToBook: number }>;
  message?: string;
}

interface DailyOccupancy {
  date: string;
  rooms: {
    [roomId: string]: {
      occupied: number;
      capacity: number;
      bookings: string[];
    };
  };
}

export class AvailabilityService {
  private roomRepo: RoomRepository;
  private bookingRepo: BookingRepository;
  private redis: RedisClient;

  private readonly ROOMS_CONFIG = {
    room_mixto_12a: { capacity: 12, type: 'mixed', flexible: false },
    room_mixto_12b: { capacity: 12, type: 'mixed', flexible: false },
    room_mixto_7: { capacity: 7, type: 'mixed', flexible: false },
    room_flexible_7: { capacity: 7, type: 'female', flexible: true, autoConvertHours: 48 }
  };

  constructor(prisma: PrismaClient) {
    this.roomRepo = new RoomRepository(prisma);
    this.bookingRepo = new BookingRepository(prisma);
    this.redis = new RedisClient();
  }

  async checkAvailability(
    checkInDate: string,
    checkOutDate: string,
    bedsRequested: number,
    excludeBookingId?: number
  ): Promise<AvailabilityResponse> {
    try {
      const cacheKey = `availability:${checkInDate}:${checkOutDate}:${bedsRequested}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached && !excludeBookingId) {
        return JSON.parse(cached);
      }

      const bookings = await this.bookingRepo.findByDateRange(
        parseISO(checkInDate),
        parseISO(checkOutDate),
        ['CONFIRMED', 'PENDING']
      );

      const activeBookings = excludeBookingId 
        ? bookings.filter(b => b.id !== excludeBookingId)
        : bookings;

      const roomOccupancy = this.calculateRoomOccupancy(activeBookings);
      const flexibleRoomStatus = await this.checkFlexibleRoomConversion(checkInDate, roomOccupancy.room_flexible_7);

      const roomsAvailable: RoomAvailability[] = Object.entries(this.ROOMS_CONFIG).map(
        ([roomId, config]) => {
          const occupied = roomOccupancy[roomId] || 0;
          const available = config.capacity - occupied;

          let currentType = config.type as 'mixed' | 'female';
          let willConvert = false;
          let conversionHours = undefined;

          if (config.flexible && roomId === 'room_flexible_7') {
            currentType = flexibleRoomStatus.currentType;
            willConvert = flexibleRoomStatus.willConvert;
            conversionHours = flexibleRoomStatus.hoursRemaining;
          }

          return {
            roomId,
            roomName: this.getRoomName(roomId),
            capacity: config.capacity,
            occupiedBeds: occupied,
            availableBeds: available,
            isFlexible: config.flexible,
            currentType,
            willConvertToMixed: willConvert,
            conversionHoursRemaining: conversionHours
          };
        }
      );

      const totalBedsAvailable = roomsAvailable.reduce((sum, room) => sum + room.availableBeds, 0);
      const available = totalBedsAvailable >= bedsRequested;
      const recommendedAllocation = available ? this.generateOptimalAllocation(bedsRequested, roomsAvailable) : undefined;

      const response: AvailabilityResponse = {
        available,
        totalBedsAvailable,
        roomsAvailable,
        recommendedAllocation,
        message: available
          ? `${totalBedsAvailable} camas disponibles`
          : `Solo ${totalBedsAvailable} camas disponibles, se requieren ${bedsRequested}`
      };

      if (!excludeBookingId) {
        await this.redis.set(cacheKey, JSON.stringify(response), 300);
      }

      return response;
    } catch (error) {
      logger.error('Error verificando disponibilidad', error);
      throw error;
    }
  }

  async getDailyOccupancy(checkInDate: string, checkOutDate: string): Promise<DailyOccupancy[]> {
    const days = eachDayOfInterval({
      start: parseISO(checkInDate),
      end: parseISO(checkOutDate)
    });

    const dailyOccupancy: DailyOccupancy[] = [];

    for (const day of days) {
      const dayStr = day.toISOString().split('T')[0];
      const nextDay = addDays(day, 1).toISOString().split('T')[0];

      const bookings = await this.bookingRepo.findByDateRange(
        parseISO(dayStr),
        parseISO(nextDay),
        ['CONFIRMED', 'PENDING']
      );

      const roomData: DailyOccupancy['rooms'] = {};

      Object.keys(this.ROOMS_CONFIG).forEach(roomId => {
        const roomBookings = bookings.filter(b => b.rooms.some(r => r.roomId === roomId));
        const occupied = roomBookings.reduce((sum, booking) => {
          const room = booking.rooms.find(r => r.roomId === roomId);
          return sum + (room?.bedsCount || 0);
        }, 0);

        roomData[roomId] = {
          occupied,
          capacity: this.ROOMS_CONFIG[roomId].capacity,
          bookings: roomBookings.map(b => b.bookingId)
        };
      });

      dailyOccupancy.push({ date: dayStr, rooms: roomData });
    }

    return dailyOccupancy;
  }

  async checkRoomAvailability(
    roomId: string,
    checkInDate: string,
    checkOutDate: string,
    bedsRequested: number
  ): Promise<{ available: boolean; availableBeds: number }> {
    const bookings = await this.bookingRepo.findByDateRange(
      parseISO(checkInDate),
      parseISO(checkOutDate),
      ['CONFIRMED', 'PENDING']
    );

    const roomBookings = bookings.filter(b => b.rooms.some(r => r.roomId === roomId));
    const occupiedBeds = roomBookings.reduce((sum, booking) => {
      const room = booking.rooms.find(r => r.roomId === roomId);
      return sum + (room?.bedsCount || 0);
    }, 0);

    const roomConfig = this.ROOMS_CONFIG[roomId];
    if (!roomConfig) {
      throw new AppError(`Habitación ${roomId} no existe`, 404);
    }

    const availableBeds = roomConfig.capacity - occupiedBeds;
    return { available: availableBeds >= bedsRequested, availableBeds };
  }

  async getMonthlyCalendar(year: number, month: number): Promise<any[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const calendar = await this.getDailyOccupancy(startDate.toISOString(), endDate.toISOString());

    return calendar.map(day => {
      const totalCapacity = Object.values(this.ROOMS_CONFIG).reduce((sum, room) => sum + room.capacity, 0);
      const totalOccupied = Object.values(day.rooms).reduce((sum, room) => sum + room.occupied, 0);

      return {
        date: day.date,
        totalCapacity,
        totalOccupied,
        totalAvailable: totalCapacity - totalOccupied,
        occupancyRate: (totalOccupied / totalCapacity) * 100,
        rooms: day.rooms
      };
    });
  }

  async clearCache(): Promise<void> {
    await this.redis.delete('availability:*');
    logger.info('Cache de disponibilidad limpiado');
  }

  private calculateRoomOccupancy(bookings: any[]): { [roomId: string]: number } {
    const occupancy: { [roomId: string]: number } = {
      room_mixto_12a: 0,
      room_mixto_12b: 0,
      room_mixto_7: 0,
      room_flexible_7: 0
    };

    bookings.forEach(booking => {
      booking.rooms.forEach(room => {
        if (occupancy[room.roomId] !== undefined) {
          occupancy[room.roomId] += room.bedsCount;
        }
      });
    });

    return occupancy;
  }

  private async checkFlexibleRoomConversion(
    checkInDate: string,
    currentOccupancy: number
  ): Promise<{ currentType: 'mixed' | 'female'; willConvert: boolean; hoursRemaining?: number }> {
    const hoursUntilCheckIn = differenceInHours(parseISO(checkInDate), new Date());

    if (hoursUntilCheckIn <= 48 && currentOccupancy === 0) {
      return { currentType: 'mixed', willConvert: false, hoursRemaining: 0 };
    }

    if (currentOccupancy > 0) {
      return { currentType: 'female', willConvert: false };
    }

    if (hoursUntilCheckIn > 48) {
      return { currentType: 'female', willConvert: true, hoursRemaining: hoursUntilCheckIn - 48 };
    }

    return { currentType: 'female', willConvert: false };
  }

  private generateOptimalAllocation(
    bedsRequested: number,
    roomsAvailable: RoomAvailability[]
  ): Array<{ roomId: string; bedsToBook: number }> {
    const allocation: Array<{ roomId: string; bedsToBook: number }> = [];
    let remaining = bedsRequested;

    const sortedRooms = [...roomsAvailable]
      .filter(room => room.availableBeds > 0)
      .sort((a, b) => {
        if (b.availableBeds !== a.availableBeds) {
          return b.availableBeds - a.availableBeds;
        }
        return a.currentType === 'mixed' ? -1 : 1;
      });

    for (const room of sortedRooms) {
      if (remaining === 0) break;
      const bedsToBook = Math.min(remaining, room.availableBeds);
      if (bedsToBook > 0) {
        allocation.push({ roomId: room.roomId, bedsToBook });
        remaining -= bedsToBook;
      }
    }

    return allocation;
  }

  private getRoomName(roomId: string): string {
    const names: { [key: string]: string } = {
      room_mixto_12a: 'Mixto 12A',
      room_mixto_12b: 'Mixto 12B',
      room_mixto_7: 'Mixto 7',
      room_flexible_7: 'Flexible 7'
    };
    return names[roomId] || roomId;
  }
}
