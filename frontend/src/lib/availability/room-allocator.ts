// lapa-casa-hostel/frontend/src/lib/availability/room-allocator.ts

/**
 * Room Allocator Library
 * 
 * Intelligent room allocation algorithm for Lapa Casa Hostel.
 * Finds optimal room combinations for group bookings.
 * 
 * @module lib/availability/room-allocator
 */

import { ROOMS } from './availability-checker';

/**
 * Room allocation interface
 */
interface RoomAllocation {
  roomId: string;
  roomName: string;
  bedsAllocated: number;
  capacity: number;
  type: 'mixed' | 'female';
}

/**
 * Allocation result interface
 */
interface AllocationResult {
  success: boolean;
  allocations: RoomAllocation[];
  totalBedsAllocated: number;
  remainingBeds: number;
  message?: string;
}

/**
 * Available room info
 */
interface AvailableRoom {
  roomId: string;
  roomName: string;
  availableBeds: number;
  totalBeds: number;
  type: 'mixed' | 'female';
  isFlexible: boolean;
}

/**
 * Allocate beds across available rooms optimally
 * 
 * Strategy:
 * 1. Try to fill complete rooms first (better for operations)
 * 2. Minimize number of rooms used (easier management)
 * 3. Prefer larger rooms for larger groups
 * 
 * @param availableRooms - Array of available rooms with capacity
 * @param requestedBeds - Number of beds to allocate
 * @returns Allocation result
 * 
 * @example
 * ```ts
 * const result = allocateRooms([
 *   { roomId: 'room_mixto_12a', availableBeds: 12, ... },
 *   { roomId: 'room_mixto_7', availableBeds: 7, ... }
 * ], 15);
 * ```
 */
export function allocateRooms(
  availableRooms: AvailableRoom[],
  requestedBeds: number
): AllocationResult {
  if (requestedBeds <= 0) {
    return {
      success: false,
      allocations: [],
      totalBedsAllocated: 0,
      remainingBeds: 0,
      message: 'Invalid number of beds requested'
    };
  }

  const totalAvailable = availableRooms.reduce(
    (sum, room) => sum + room.availableBeds,
    0
  );

  if (totalAvailable < requestedBeds) {
    return {
      success: false,
      allocations: [],
      totalBedsAllocated: 0,
      remainingBeds: requestedBeds,
      message: `Insufficient beds: ${totalAvailable} available, ${requestedBeds} requested`
    };
  }

  const sortedRooms = [...availableRooms].sort((a, b) => {
    if (a.availableBeds === requestedBeds) return -1;
    if (b.availableBeds === requestedBeds) return 1;
    return b.availableBeds - a.availableBeds;
  });

  const allocations: RoomAllocation[] = [];
  let remainingBeds = requestedBeds;

  for (const room of sortedRooms) {
    if (remainingBeds <= 0) break;

    const bedsToAllocate = Math.min(room.availableBeds, remainingBeds);

    if (bedsToAllocate > 0) {
      allocations.push({
        roomId: room.roomId,
        roomName: room.roomName,
        bedsAllocated: bedsToAllocate,
        capacity: room.totalBeds,
        type: room.type
      });

      remainingBeds -= bedsToAllocate;
    }
  }

  return {
    success: remainingBeds === 0,
    allocations,
    totalBedsAllocated: requestedBeds - remainingBeds,
    remainingBeds,
    message: remainingBeds === 0
      ? `Successfully allocated ${requestedBeds} beds across ${allocations.length} room(s)`
      : `Could only allocate ${requestedBeds - remainingBeds} beds`
  };
}

/**
 * Find best room combination for group booking
 * 
 * @param availableRooms - Available rooms
 * @param requestedBeds - Requested beds
 * @returns Best allocation or null
 * 
 * @example
 * ```ts
 * const best = findBestRoomCombination(rooms, 20);
 * ```
 */
export function findBestRoomCombination(
  availableRooms: AvailableRoom[],
  requestedBeds: number
): AllocationResult | null {
  const result = allocateRooms(availableRooms, requestedBeds);
  return result.success ? result : null;
}

/**
 * Check if entire hostel can be booked
 * 
 * @param availableRooms - Available rooms
 * @returns True if all 45 beds are available
 * 
 * @example
 * ```ts
 * if (canBookEntireHostel(rooms)) {
 *   console.log('Private hostel booking available!');
 * }
 * ```
 */
export function canBookEntireHostel(availableRooms: AvailableRoom[]): boolean {
  const totalAvailable = availableRooms.reduce(
    (sum, room) => sum + room.availableBeds,
    0
  );
  return totalAvailable === 45;
}

/**
 * Suggest optimal room configuration for group size
 * 
 * @param groupSize - Number of people in group
 * @param availableRooms - Available rooms
 * @returns Suggested room configuration
 * 
 * @example
 * ```ts
 * const suggestion = suggestRoomConfiguration(25, availableRooms);
 * console.log(suggestion.message);
 * ```
 */
export function suggestRoomConfiguration(
  groupSize: number,
  availableRooms: AvailableRoom[]
): {
  suggestion: string;
  allocation?: AllocationResult;
  alternatives?: string[];
} {
  if (groupSize >= 45) {
    return {
      suggestion: 'Book entire hostel (all 4 rooms, 45 beds)',
      allocation: canBookEntireHostel(availableRooms)
        ? allocateRooms(availableRooms, 45)
        : undefined
    };
  }

  if (groupSize >= 26) {
    return {
      suggestion: 'Book 3 rooms (2x Mixto 12 + 1x Mixto 7 = 31 beds minimum)',
      allocation: allocateRooms(availableRooms, groupSize),
      alternatives: [
        'Add Flexible 7 for total 38 beds',
        'Book entire hostel for exclusive use'
      ]
    };
  }

  if (groupSize >= 16) {
    return {
      suggestion: 'Book 2 large rooms (2x Mixto 12 = 24 beds)',
      allocation: allocateRooms(availableRooms, groupSize),
      alternatives: ['Add Mixto 7 for total 31 beds']
    };
  }

  if (groupSize >= 12) {
    return {
      suggestion: 'Book 1 Mixto 12 room',
      allocation: allocateRooms(availableRooms, groupSize),
      alternatives: ['Add Mixto 7 for total 19 beds']
    };
  }

  if (groupSize >= 7) {
    return {
      suggestion: 'Book 1 Mixto 7 or Flexible 7 room',
      allocation: allocateRooms(availableRooms, groupSize),
      alternatives: ['Book Mixto 12 for more space']
    };
  }

  return {
    suggestion: 'Book beds in any available room',
    allocation: allocateRooms(availableRooms, groupSize)
  };
}

/**
 * Calculate allocation efficiency
 * 
 * @param allocation - Room allocation result
 * @returns Efficiency metrics
 * 
 * @example
 * ```ts
 * const metrics = calculateAllocationEfficiency(allocation);
 * console.log(`${metrics.utilizationRate}% utilization`);
 * ```
 */
export function calculateAllocationEfficiency(allocation: AllocationResult): {
  roomsUsed: number;
  totalCapacity: number;
  bedsAllocated: number;
  utilizationRate: number;
  wastedBeds: number;
} {
  const roomsUsed = allocation.allocations.length;
  const totalCapacity = allocation.allocations.reduce(
    (sum, alloc) => sum + alloc.capacity,
    0
  );
  const bedsAllocated = allocation.totalBedsAllocated;
  const wastedBeds = totalCapacity - bedsAllocated;
  const utilizationRate = totalCapacity > 0
    ? Math.round((bedsAllocated / totalCapacity) * 100)
    : 0;

  return {
    roomsUsed,
    totalCapacity,
    bedsAllocated,
    utilizationRate,
    wastedBeds
  };
}

/**
 * Group allocation by room type
 * 
 * @param allocation - Allocation result
 * @returns Grouped allocations
 * 
 * @example
 * ```ts
 * const grouped = groupAllocationsByType(allocation);
 * console.log(`Mixed: ${grouped.mixed.beds} beds`);
 * ```
 */
export function groupAllocationsByType(allocation: AllocationResult): {
  mixed: { rooms: number; beds: number };
  female: { rooms: number; beds: number };
} {
  const result = {
    mixed: { rooms: 0, beds: 0 },
    female: { rooms: 0, beds: 0 }
  };

  allocation.allocations.forEach((alloc) => {
    if (alloc.type === 'mixed') {
      result.mixed.rooms++;
      result.mixed.beds += alloc.bedsAllocated;
    } else {
      result.female.rooms++;
      result.female.beds += alloc.bedsAllocated;
    }
  });

  return result;
}
