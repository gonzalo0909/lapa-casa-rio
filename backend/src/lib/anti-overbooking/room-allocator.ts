// lapa-casa-hostel/backend/src/lib/anti-overbooking/room-allocator.ts

import { availabilityChecker } from './availability-checker';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';

interface RoomAllocation {
  roomId: string;
  roomName: string;
  bedsCount: number;
  capacity: number;
  type: 'mixed' | 'female';
  isFlexible: boolean;
}

interface AllocationResult {
  success: boolean;
  allocations: RoomAllocation[];
  totalBeds: number;
  requestedBeds: number;
  strategy: 'single' | 'multi' | 'optimal';
  score: number;
  alternatives?: AllocationResult[];
  errors?: string[];
}

interface AllocationPreferences {
  preferSingleRoom?: boolean;
  roomTypePreference?: 'mixed' | 'female';
  allowSplit?: boolean;
  maxRooms?: number;
}

interface AllocationLock {
  bookingId: string;
  roomId: string;
  bedsCount: number;
  expiresAt: Date;
}

export class RoomAllocator {
  private readonly LOCK_TTL = 600;
  private readonly MAX_ALLOCATION_ATTEMPTS = 3;

  async findOptimalAllocation(
    requestedBeds: number,
    checkInDate: Date,
    checkOutDate: Date,
    preferences: AllocationPreferences = {}
  ): Promise<AllocationResult> {
    const availability = await availabilityChecker.checkAvailability(checkInDate, checkOutDate, requestedBeds);

    if (!availability.isAvailable) {
      return {
        success: false,
        allocations: [],
        totalBeds: 0,
        requestedBeds,
        strategy: 'single',
        score: 0,
        errors: availability.conflicts
      };
    }

    const strategies: AllocationResult[] = [];

    const singleRoomAllocation = this.findSingleRoomAllocation(requestedBeds, availability.availableRooms, preferences);
    if (singleRoomAllocation.success) {
      strategies.push(singleRoomAllocation);
    }

    if (preferences.allowSplit !== false) {
      const multiRoomAllocation = this.findMultiRoomAllocation(requestedBeds, availability.availableRooms, preferences);
      if (multiRoomAllocation.success) {
        strategies.push(multiRoomAllocation);
      }
    }

    if (strategies.length === 0) {
      return {
        success: false,
        allocations: [],
        totalBeds: 0,
        requestedBeds,
        strategy: 'single',
        score: 0,
        errors: ['No suitable room allocation found']
      };
    }

    strategies.sort((a, b) => b.score - a.score);
    const best = strategies[0];
    best.alternatives = strategies.slice(1);

    return best;
  }

  private findSingleRoomAllocation(
    requestedBeds: number,
    availableRooms: any[],
    preferences: AllocationPreferences
  ): AllocationResult {
    let eligibleRooms = availableRooms.filter(room => room.available >= requestedBeds);

    if (preferences.roomTypePreference) {
      const preferredRooms = eligibleRooms.filter(r => r.type === preferences.roomTypePreference);
      if (preferredRooms.length > 0) {
        eligibleRooms = preferredRooms;
      }
    }

    if (eligibleRooms.length === 0) {
      return {
        success: false,
        allocations: [],
        totalBeds: 0,
        requestedBeds,
        strategy: 'single',
        score: 0
      };
    }

    eligibleRooms.sort((a, b) => {
      const aWaste = a.capacity - requestedBeds;
      const bWaste = b.capacity - requestedBeds;
      if (aWaste !== bWaste) return aWaste - bWaste;
      return b.capacity - a.capacity;
    });

    const selectedRoom = eligibleRooms[0];
    const waste = selectedRoom.capacity - requestedBeds;
    const score = 100 - (waste * 5) + (selectedRoom.capacity >= 12 ? 10 : 0);

    return {
      success: true,
      allocations: [
        {
          roomId: selectedRoom.roomId,
          roomName: selectedRoom.roomName,
          bedsCount: requestedBeds,
          capacity: selectedRoom.capacity,
          type: selectedRoom.type,
          isFlexible: selectedRoom.isFlexible
        }
      ],
      totalBeds: requestedBeds,
      requestedBeds,
      strategy: 'single',
      score
    };
  }

  private findMultiRoomAllocation(
    requestedBeds: number,
    availableRooms: any[],
    preferences: AllocationPreferences
  ): AllocationResult {
    const maxRooms = preferences.maxRooms || 4;
    const sortedRooms = [...availableRooms].sort((a, b) => b.available - a.available);

    const combinations = this.generateRoomCombinations(sortedRooms, requestedBeds, maxRooms);

    if (combinations.length === 0) {
      return {
        success: false,
        allocations: [],
        totalBeds: 0,
        requestedBeds,
        strategy: 'multi',
        score: 0
      };
    }

    const best = combinations[0];
    const totalCapacity = best.reduce((sum, r) => sum + r.capacity, 0);
    const waste = totalCapacity - requestedBeds;
    const score = 80 - (waste * 3) - (best.length * 5);

    const allocations: RoomAllocation[] = [];
    let remaining = requestedBeds;

    for (const room of best) {
      const bedsToAllocate = Math.min(remaining, room.available);
      allocations.push({
        roomId: room.roomId,
        roomName: room.roomName,
        bedsCount: bedsToAllocate,
        capacity: room.capacity,
        type: room.type,
        isFlexible: room.isFlexible
      });
      remaining -= bedsToAllocate;
    }

    return {
      success: true,
      allocations,
      totalBeds: requestedBeds,
      requestedBeds,
      strategy: 'multi',
      score
    };
  }

  private generateRoomCombinations(rooms: any[], targetBeds: number, maxRooms: number): any[][] {
    const combinations: any[][] = [];

    const backtrack = (start: number, current: any[], currentBeds: number) => {
      if (currentBeds >= targetBeds) {
        combinations.push([...current]);
        return;
      }

      if (current.length >= maxRooms) return;

      for (let i = start; i < rooms.length; i++) {
        const room = rooms[i];
        if (room.available > 0) {
          current.push(room);
          backtrack(i + 1, current, currentBeds + room.available);
          current.pop();
        }
      }
    };

    backtrack(0, [], 0);

    return combinations.sort((a, b) => {
      const aTotalCapacity = a.reduce((sum, r) => sum + r.capacity, 0);
      const bTotalCapacity = b.reduce((sum, r) => sum + r.capacity, 0);
      const aWaste = aTotalCapacity - targetBeds;
      const bWaste = bTotalCapacity - targetBeds;
      if (aWaste !== bWaste) return aWaste - bWaste;
      return a.length - b.length;
    });
  }

  async lockRooms(
    bookingId: string,
    allocations: RoomAllocation[],
    checkInDate: Date,
    checkOutDate: Date
  ): Promise<boolean> {
    const locks: AllocationLock[] = [];
    const expiresAt = new Date(Date.now() + this.LOCK_TTL * 1000);

    try {
      for (const allocation of allocations) {
        const lockKey = this.getLockKey(allocation.roomId, checkInDate, checkOutDate);
        const lockData: AllocationLock = {
          bookingId,
          roomId: allocation.roomId,
          bedsCount: allocation.bedsCount,
          expiresAt
        };

        const locked = await redis.set(lockKey, JSON.stringify(lockData), 'EX', this.LOCK_TTL, 'NX');

        if (!locked) {
          await this.releaseLocks(locks);
          return false;
        }

        locks.push(lockData);
      }

      return true;
    } catch (error) {
      await this.releaseLocks(locks);
      throw error;
    }
  }

  async releaseLocks(locks: AllocationLock[]): Promise<void> {
    for (const lock of locks) {
      const lockKey = this.getLockKey(lock.roomId, new Date(), new Date());
      await redis.del(lockKey);
    }
  }

  async validateAllocation(
    allocations: RoomAllocation[],
    checkInDate: Date,
    checkOutDate: Date,
    excludeBookingId?: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const allocation of allocations) {
      const validation = await availabilityChecker.validateBooking(
        allocation.roomId,
        allocation.bedsCount,
        checkInDate,
        checkOutDate,
        excludeBookingId
      );

      if (!validation.isValid) {
        errors.push(...validation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async reallocateBooking(
    currentBookingId: string,
    newBedsCount: number,
    checkInDate: Date,
    checkOutDate: Date
  ): Promise<AllocationResult> {
    const currentBooking = await prisma.booking.findUnique({
      where: { id: currentBookingId }
    });

    if (!currentBooking) {
      return {
        success: false,
        allocations: [],
        totalBeds: 0,
        requestedBeds: newBedsCount,
        strategy: 'single',
        score: 0,
        errors: ['Booking not found']
      };
    }

    return this.findOptimalAllocation(newBedsCount, checkInDate, checkOutDate, {
      allowSplit: true
    });
  }

  private getLockKey(roomId: string, checkInDate: Date, checkOutDate: Date): string {
    const checkInStr = checkInDate.toISOString().split('T')[0];
    const checkOutStr = checkOutDate.toISOString().split('T')[0];
    return `lock:room:${roomId}:${checkInStr}:${checkOutStr}`;
  }

  async getActiveLocks(roomId: string): Promise<AllocationLock[]> {
    const pattern = `lock:room:${roomId}:*`;
    const keys = await redis.keys(pattern);
    const locks: AllocationLock[] = [];

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const lock = JSON.parse(data);
        if (new Date(lock.expiresAt) > new Date()) {
          locks.push(lock);
        }
      }
    }

    return locks;
  }

  async cleanExpiredLocks(): Promise<number> {
    const pattern = 'lock:room:*';
    const keys = await redis.keys(pattern);
    let cleaned = 0;

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const lock = JSON.parse(data);
        if (new Date(lock.expiresAt) <= new Date()) {
          await redis.del(key);
          cleaned++;
        }
      }
    }

    return cleaned;
  }
}

export const roomAllocator = new RoomAllocator();
