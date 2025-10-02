// lapa-casa-hostel/backend/src/lib/anti-overbooking/availability-checker.ts

import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { addDays, differenceInHours, parseISO } from 'date-fns';

/**
 * Room configuration with capacity and type
 */
interface RoomConfig {
  id: string;
  name: string;
  capacity: number;
  type: 'mixed' | 'female';
  isFlexible: boolean;
  autoConvertHours?: number;
}

/**
 * Room occupancy status
 */
interface RoomOccupancy {
  roomId: string;
  roomName: string;
  capacity: number;
  occupied: number;
  available: number;
  type: 'mixed' | 'female';
  isFlexible: boolean;
}

/**
 * Availability check result
 */
interface AvailabilityResult {
  isAvailable: boolean;
  availableRooms: RoomOccupancy[];
  totalAvailableBeds: number;
  requestedBeds: number;
  checkInDate: Date;
  checkOutDate: Date;
  conflicts?: string[];
  suggestions?: string[];
}

/**
 * Booking data for overlap checking
 */
interface BookingData {
  id: string;
  roomId: string;
  bedsCount: number;
  checkInDate: Date;
  checkOutDate: Date;
  status: string;
}

/**
 * Room configurations for Lapa Casa Hostel
 */
const ROOM_CONFIGS: RoomConfig[] = [
  {
    id: 'room_mixto_12a',
    name: 'Mixto 12A',
    capacity: 12,
    type: 'mixed',
    isFlexible: false
  },
  {
    id: 'room_mixto_12b',
    name: 'Mixto 12B',
    capacity: 12,
    type: 'mixed',
    isFlexible: false
  },
  {
    id: 'room_mixto_7',
    name: 'Mixto 7',
    capacity: 7,
    type: 'mixed',
    isFlexible: false
  },
  {
    id: 'room_flexible_7',
    name: 'Flexible 7',
    capacity: 7,
    type: 'female',
    isFlexible: true,
    autoConvertHours: 48
  }
];

/**
 * AvailabilityChecker class
 * Core anti-overbooking system for Lapa Casa Hostel
 */
export class AvailabilityChecker {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CONFIRMED_STATUSES = ['CONFIRMED', 'CHECKED_IN', 'PENDING_PAYMENT'];

  /**
   * Check availability for a date range and number of beds
   * @param checkInDate - Check-in date (ISO string or Date)
   * @param checkOutDate - Check-out date (ISO string or Date)
   * @param requestedBeds - Number of beds requested
   * @param excludeBookingId - Optional booking ID to exclude (for updates)
   * @returns Availability result with detailed information
   */
  async checkAvailability(
    checkInDate: string | Date,
    checkOutDate: string | Date,
    requestedBeds: number,
    excludeBookingId?: string
  ): Promise<AvailabilityResult> {
    const checkIn = typeof checkInDate === 'string' ? parseISO(checkInDate) : checkInDate;
    const checkOut = typeof checkOutDate === 'string' ? parseISO(checkOutDate) : checkOutDate;

    // Validate dates
    if (checkIn >= checkOut) {
      return {
        isAvailable: false,
        availableRooms: [],
        totalAvailableBeds: 0,
        requestedBeds,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        conflicts: ['Check-out date must be after check-in date']
      };
    }

    if (checkIn < new Date()) {
      return {
        isAvailable: false,
        availableRooms: [],
        totalAvailableBeds: 0,
        requestedBeds,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        conflicts: ['Check-in date cannot be in the past']
      };
    }

    if (requestedBeds < 1 || requestedBeds > 38) {
      return {
        isAvailable: false,
        availableRooms: [],
        totalAvailableBeds: 0,
        requestedBeds,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        conflicts: ['Requested beds must be between 1 and 38']
      };
    }

    // Try cache first
    const cacheKey = this.getCacheKey(checkIn, checkOut, excludeBookingId);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      const result = this.processAvailability(cached, requestedBeds, checkIn, checkOut);
      return result;
    }

    // Fetch bookings from database
    const bookings = await this.fetchBookingsForDateRange(checkIn, checkOut, excludeBookingId);

    // Calculate occupancy
    const occupancy = await this.calculateOccupancy(bookings, checkIn);

    // Cache the occupancy
    await this.setCache(cacheKey, occupancy);

    // Process and return result
    return this.processAvailability(occupancy, requestedBeds, checkIn, checkOut);
  }

  /**
   * Fetch all confirmed bookings that overlap with the date range
   */
  private async fetchBookingsForDateRange(
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string
  ): Promise<BookingData[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        AND: [
          {
            status: {
              in: this.CONFIRMED_STATUSES
            }
          },
          {
            OR: [
              {
                AND: [
                  { checkInDate: { lt: checkOut } },
                  { checkOutDate: { gt: checkIn } }
                ]
              }
            ]
          },
          excludeBookingId ? { id: { not: excludeBookingId } } : {}
        ]
      },
      select: {
        id: true,
        roomId: true,
        bedsCount: true,
        checkInDate: true,
        checkOutDate: true,
        status: true
      }
    });

    return bookings;
  }

  /**
   * Calculate occupancy for each room
   */
  private async calculateOccupancy(
    bookings: BookingData[],
    checkInDate: Date
  ): Promise<RoomOccupancy[]> {
    const occupancy: Map<string, RoomOccupancy> = new Map();

    // Initialize occupancy for all rooms
    for (const room of ROOM_CONFIGS) {
      let roomType = room.type;

      // Handle flexible room auto-conversion
      if (room.isFlexible && room.autoConvertHours) {
        const hoursUntilCheckIn = differenceInHours(checkInDate, new Date());
        const femaleBookings = bookings.filter(
          b => b.roomId === room.id && b.status !== 'CANCELLED'
        );

        if (femaleBookings.length === 0 && hoursUntilCheckIn <= room.autoConvertHours) {
          roomType = 'mixed';
        }
      }

      occupancy.set(room.id, {
        roomId: room.id,
        roomName: room.name,
        capacity: room.capacity,
        occupied: 0,
        available: room.capacity,
        type: roomType,
        isFlexible: room.isFlexible
      });
    }

    // Count occupied beds
    for (const booking of bookings) {
      const room = occupancy.get(booking.roomId);
      if (room) {
        room.occupied += booking.bedsCount;
        room.available = Math.max(0, room.capacity - room.occupied);
      }
    }

    return Array.from(occupancy.values());
  }

  /**
   * Process availability and generate result
   */
  private processAvailability(
    occupancy: RoomOccupancy[],
    requestedBeds: number,
    checkInDate: Date,
    checkOutDate: Date
  ): AvailabilityResult {
    const totalAvailableBeds = occupancy.reduce((sum, room) => sum + room.available, 0);
    const availableRooms = occupancy.filter(room => room.available > 0);

    const isAvailable = totalAvailableBeds >= requestedBeds;

    const result: AvailabilityResult = {
      isAvailable,
      availableRooms,
      totalAvailableBeds,
      requestedBeds,
      checkInDate,
      checkOutDate
    };

    // Add conflicts if not available
    if (!isAvailable) {
      result.conflicts = [
        `Only ${totalAvailableBeds} beds available, but ${requestedBeds} beds requested`
      ];

      // Add suggestions for alternative dates
      result.suggestions = this.generateSuggestions(occupancy, requestedBeds);
    }

    return result;
  }

  /**
   * Generate suggestions for alternative options
   */
  private generateSuggestions(
    occupancy: RoomOccupancy[],
    requestedBeds: number
  ): string[] {
    const suggestions: string[] = [];

    // Suggest splitting across multiple rooms
    const sortedRooms = occupancy
      .filter(r => r.available > 0)
      .sort((a, b) => b.available - a.available);

    if (sortedRooms.length > 1) {
      const combinedCapacity = sortedRooms
        .slice(0, 2)
        .reduce((sum, room) => sum + room.available, 0);

      if (combinedCapacity >= requestedBeds) {
        suggestions.push(
          `Consider splitting the group across ${sortedRooms[0].roomName} (${sortedRooms[0].available} beds) and ${sortedRooms[1].roomName} (${sortedRooms[1].available} beds)`
        );
      }
    }

    // Suggest reducing group size
    const maxAvailable = Math.max(...occupancy.map(r => r.available));
    if (maxAvailable > 0 && maxAvailable < requestedBeds) {
      suggestions.push(
        `Maximum ${maxAvailable} beds available in a single room. Consider reducing group size or selecting different dates.`
      );
    }

    return suggestions;
  }

  /**
   * Check availability for multiple consecutive dates
   */
  async checkMultipleDates(
    startDate: Date,
    endDate: Date,
    requestedBeds: number,
    daysToCheck: number = 7
  ): Promise<Map<string, AvailabilityResult>> {
    const results = new Map<string, AvailabilityResult>();

    for (let i = 0; i < daysToCheck; i++) {
      const checkIn = addDays(startDate, i);
      const checkOut = addDays(endDate, i);

      const result = await this.checkAvailability(checkIn, checkOut, requestedBeds);
      const dateKey = checkIn.toISOString().split('T')[0];
      results.set(dateKey, result);
    }

    return results;
  }

  /**
   * Get detailed room availability
   */
  async getRoomAvailability(
    roomId: string,
    checkInDate: Date,
    checkOutDate: Date
  ): Promise<RoomOccupancy | null> {
    const result = await this.checkAvailability(checkInDate, checkOutDate, 1);
    return result.availableRooms.find(r => r.roomId === roomId) || null;
  }

  /**
   * Validate booking against current availability
   */
  async validateBooking(
    roomId: string,
    bedsCount: number,
    checkInDate: Date,
    checkOutDate: Date,
    excludeBookingId?: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check if room exists
    const roomConfig = ROOM_CONFIGS.find(r => r.id === roomId);
    if (!roomConfig) {
      errors.push('Invalid room ID');
      return { isValid: false, errors };
    }

    // Check beds count
    if (bedsCount > roomConfig.capacity) {
      errors.push(`Room ${roomConfig.name} has capacity of ${roomConfig.capacity} beds`);
    }

    // Check availability
    const availability = await this.checkAvailability(
      checkInDate,
      checkOutDate,
      bedsCount,
      excludeBookingId
    );

    const roomAvailability = availability.availableRooms.find(r => r.roomId === roomId);
    
    if (!roomAvailability || roomAvailability.available < bedsCount) {
      errors.push(
        `Room ${roomConfig.name} only has ${roomAvailability?.available || 0} beds available`
      );
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear cache for specific dates
   */
  async clearCache(checkInDate?: Date, checkOutDate?: Date): Promise<void> {
    if (checkInDate && checkOutDate) {
      const cacheKey = this.getCacheKey(checkInDate, checkOutDate);
      await redis.del(cacheKey);
    } else {
      // Clear all availability cache
      const keys = await redis.keys('availability:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(checkIn: Date, checkOut: Date, excludeBookingId?: string): string {
    const checkInStr = checkIn.toISOString().split('T')[0];
    const checkOutStr = checkOut.toISOString().split('T')[0];
    const excludeStr = excludeBookingId ? `:exclude:${excludeBookingId}` : '';
    return `availability:${checkInStr}:${checkOutStr}${excludeStr}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<RoomOccupancy[] | null> {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Cache read error:', error);
    }
    return null;
  }

  /**
   * Set cache
   */
  private async setCache(key: string, data: RoomOccupancy[]): Promise<void> {
    try {
      await redis.setex(key, this.CACHE_TTL, JSON.stringify(data));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  /**
   * Get room configurations
   */
  static getRoomConfigs(): RoomConfig[] {
    return ROOM_CONFIGS;
  }

  /**
   * Get total hostel capacity
   */
  static getTotalCapacity(): number {
    return ROOM_CONFIGS.reduce((sum, room) => sum + room.capacity, 0);
  }
}

// Export singleton instance
export const availabilityChecker = new AvailabilityChecker();
