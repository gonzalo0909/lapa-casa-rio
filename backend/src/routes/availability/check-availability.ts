/**
 * File: lapa-casa-hostel/backend/src/routes/availability/check-availability.ts
 * Check Availability Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Checks overall availability across all rooms for requested dates
 * Implements intelligent room allocation and flexible room conversion
 * 
 * @module routes/availability/check
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { AvailabilityService } from '../../services/availability-service';
import { PricingService } from '../../services/pricing-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const availabilityService = new AvailabilityService();
const pricingService = new PricingService();

/**
 * Room Configuration - Lapa Casa Hostel
 */
const ROOMS_CONFIG = {
  room_mixto_12a: { capacity: 12, type: 'mixed', isFlexible: false, name: 'Mixto 12A' },
  room_mixto_12b: { capacity: 12, type: 'mixed', isFlexible: false, name: 'Mixto 12B' },
  room_mixto_7: { capacity: 7, type: 'mixed', isFlexible: false, name: 'Mixto 7' },
  room_flexible_7: { capacity: 7, type: 'female', isFlexible: true, name: 'Flexible 7' }
};

/**
 * Check Availability Handler
 * 
 * Availability check flow:
 * 1. Validate date parameters
 * 2. Query existing bookings for date range
 * 3. Calculate available beds per room
 * 4. Handle flexible room auto-conversion (48h rule)
 * 5. Generate optimal room allocation suggestions
 * 6. Calculate pricing with group discounts
 * 7. Return availability status with options
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const checkAvailabilityHandler = async (
  req: Request<{}, {}, {}, { checkIn: string; checkOut: string; beds: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checkIn, checkOut, beds } = req.query;
    const bedsNeeded = parseInt(beds, 10);

    logger.info('Checking availability', { checkIn, checkOut, bedsNeeded });

    // Step 1: Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();

    if (checkInDate < now) {
      res.status(400).json(
        ApiResponse.error('Check-in date cannot be in the past')
      );
      return;
    }

    if (checkOutDate <= checkInDate) {
      res.status(400).json(
        ApiResponse.error('Check-out date must be after check-in date')
      );
      return;
    }

    if (bedsNeeded < 1 || bedsNeeded > 38) {
      res.status(400).json(
        ApiResponse.error('Beds requested must be between 1 and 38')
      );
      return;
    }

    // Step 2: Calculate nights
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Step 3: Check availability for each room
    const roomsAvailability = await Promise.all(
      Object.entries(ROOMS_CONFIG).map(async ([roomId, config]) => {
        const availability = await availabilityService.checkRoomAvailability(
          roomId,
          checkIn,
          checkOut
        );

        return {
          roomId,
          name: config.name,
          type: config.type,
          capacity: config.capacity,
          isFlexible: config.isFlexible,
          available: availability.available,
          occupied: availability.occupied
        };
      })
    );

    // Step 4: Calculate total available beds
    const totalAvailable = roomsAvailability.reduce(
      (sum, room) => sum + room.available,
      0
    );

    // Step 5: Handle flexible room conversion (48h auto-convert rule)
    const hoursUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    const flexibleRoom = roomsAvailability.find(r => r.roomId === 'room_flexible_7');
    if (flexibleRoom && flexibleRoom.occupied === 0 && hoursUntilCheckIn <= 48) {
      flexibleRoom.type = 'mixed';
      logger.info('Flexible room auto-converted to mixed', { hoursUntilCheckIn });
    }

    // Step 6: Check if sufficient availability
    const available = totalAvailable >= bedsNeeded;

    // Step 7: Generate room allocation suggestions
    const allocationOptions = available
      ? generateAllocationOptions(bedsNeeded, roomsAvailability)
      : [];

    // Step 8: Calculate pricing for each allocation option
    const pricedOptions = await Promise.all(
      allocationOptions.map(async (option) => {
        const pricing = await pricingService.calculateBookingPrice({
          checkIn,
          checkOut,
          rooms: option.rooms.map(r => ({
            roomId: r.roomId,
            bedsCount: r.bedsAllocated
          })),
          totalBeds: bedsNeeded
        });

        return {
          ...option,
          pricing: {
            subtotal: pricing.subtotal,
            groupDiscount: pricing.groupDiscount,
            groupDiscountPercentage: pricing.groupDiscountPercentage,
            seasonalAdjustment: pricing.seasonalAdjustment,
            seasonalMultiplier: pricing.seasonalMultiplier,
            total: pricing.total,
            pricePerBed: pricing.total / bedsNeeded,
            currency: 'BRL'
          }
        };
      })
    );

    // Step 9: Find alternative dates if not available
    let alternativeDates = [];
    if (!available) {
      alternativeDates = await availabilityService.findAlternativeDates(
        checkIn,
        checkOut,
        bedsNeeded
      );
    }

    // Step 10: Return availability response
    res.status(200).json(
      ApiResponse.success({
        available,
        checkIn,
        checkOut,
        nights,
        bedsRequested: bedsNeeded,
        bedsAvailable: totalAvailable,
        rooms: roomsAvailability.map(room => ({
          roomId: room.roomId,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          available: room.available,
          isFlexible: room.isFlexible,
          autoConverted: room.roomId === 'room_flexible_7' && 
                         room.type === 'mixed' && 
                         hoursUntilCheckIn <= 48
        })),
        allocationOptions: pricedOptions,
        alternativeDates: alternativeDates.slice(0, 5),
        flexibleRoomInfo: {
          autoConvertEnabled: true,
          hoursUntilCheckIn,
          willAutoConvert: hoursUntilCheckIn <= 48 && flexibleRoom?.occupied === 0
        }
      }, available ? 'Rooms available' : 'Insufficient availability')
    );

  } catch (error) {
    logger.error('Error checking availability', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Generate Room Allocation Options
 * 
 * Creates multiple allocation strategies for requested beds
 * Prioritizes:
 * 1. Minimizing number of rooms used
 * 2. Filling larger rooms first
 * 3. Grouping by room type
 * 
 * @param {number} bedsNeeded - Total beds to allocate
 * @param {Array} rooms - Available rooms with capacity
 * @returns {Array} Allocation options
 */
function generateAllocationOptions(
  bedsNeeded: number,
  rooms: Array<{
    roomId: string;
    name: string;
    type: string;
    capacity: number;
    available: number;
    isFlexible: boolean;
  }>
): Array<{
  option: number;
  totalRooms: number;
  rooms: Array<{ roomId: string; name: string; bedsAllocated: number }>;
}> {
  const options: any[] = [];

  // Sort rooms by available beds (descending)
  const sortedRooms = rooms
    .filter(r => r.available > 0)
    .sort((a, b) => b.available - a.available);

  // Option 1: Fill largest rooms first (greedy)
  let remaining = bedsNeeded;
  const option1 = [];
  for (const room of sortedRooms) {
    if (remaining <= 0) break;
    const allocated = Math.min(remaining, room.available);
    option1.push({
      roomId: room.roomId,
      name: room.name,
      bedsAllocated: allocated
    });
    remaining -= allocated;
  }

  if (remaining === 0) {
    options.push({
      option: 1,
      totalRooms: option1.length,
      rooms: option1
    });
  }

  // Option 2: Balanced allocation (distribute evenly)
  if (sortedRooms.length > 1 && bedsNeeded < sortedRooms.reduce((sum, r) => sum + r.available, 0)) {
    const option2 = [];
    const bedsPerRoom = Math.ceil(bedsNeeded / Math.min(sortedRooms.length, 3));
    remaining = bedsNeeded;

    for (const room of sortedRooms) {
      if (remaining <= 0) break;
      const allocated = Math.min(remaining, Math.min(bedsPerRoom, room.available));
      if (allocated > 0) {
        option2.push({
          roomId: room.roomId,
          name: room.name,
          bedsAllocated: allocated
        });
        remaining -= allocated;
      }
    }

    if (remaining === 0 && option2.length > 0) {
      options.push({
        option: 2,
        totalRooms: option2.length,
        rooms: option2
      });
    }
  }

  // Option 3: Same room type preference
  const roomsByType = sortedRooms.reduce((acc, room) => {
    if (!acc[room.type]) acc[room.type] = [];
    acc[room.type].push(room);
    return acc;
  }, {} as Record<string, typeof sortedRooms>);

  for (const type in roomsByType) {
    const typeRooms = roomsByType[type];
    const typeTotal = typeRooms.reduce((sum, r) => sum + r.available, 0);
    
    if (typeTotal >= bedsNeeded) {
      const option3 = [];
      remaining = bedsNeeded;

      for (const room of typeRooms) {
        if (remaining <= 0) break;
        const allocated = Math.min(remaining, room.available);
        option3.push({
          roomId: room.roomId,
          name: room.name,
          bedsAllocated: allocated
        });
        remaining -= allocated;
      }

      if (remaining === 0) {
        options.push({
          option: options.length + 1,
          totalRooms: option3.length,
          rooms: option3
        });
      }
    }
  }

  return options.slice(0, 3); // Return max 3 options
}
