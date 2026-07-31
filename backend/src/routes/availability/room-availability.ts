/**
 * File: lapa-casa-hostel/backend/src/routes/availability/room-availability.ts
 * Room-Specific Availability Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Checks availability for a specific room across date range
 * Provides detailed occupancy information and booking conflicts
 * 
 * @module routes/availability/room
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { AvailabilityService } from '../../services/availability-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const availabilityService = new AvailabilityService();

/**
 * Room Availability Handler
 * 
 * Returns detailed availability information for a specific room:
 * - Available beds by date
 * - Occupied beds by date
 * - Booking conflicts
 * - Flexible room status
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const roomAvailabilityHandler = async (
  req: Request<{ roomId: string }, {}, {}, { checkIn: string; checkOut: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { checkIn, checkOut } = req.query;

    logger.info('Checking room availability', { roomId, checkIn, checkOut });

    // Validate room exists
    const validRooms = [
      'room_mixto_12a',
      'room_mixto_12b',
      'room_mixto_7',
      'room_flexible_7'
    ];

    if (!validRooms.includes(roomId)) {
      res.status(404).json(
        ApiResponse.error('Room not found', { roomId })
      );
      return;
    }

    // Get room configuration
    const roomConfig = getRoomConfig(roomId);

    // Validate dates
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

    // Check room availability
    const availability = await availabilityService.checkRoomAvailability(
      roomId,
      checkIn,
      checkOut
    );

    // Get existing bookings for this room
    const bookings = await availabilityService.getBookingsForRoom(
      roomId,
      checkIn,
      checkOut
    );

    // Calculate occupancy by date
    const occupancyByDate = calculateDailyOccupancy(
      checkInDate,
      checkOutDate,
      bookings,
      roomConfig.capacity
    );

    // Handle flexible room status
    let flexibleRoomStatus = null;
    if (roomConfig.isFlexible) {
      const hoursUntilCheckIn = Math.ceil(
        (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      );

      flexibleRoomStatus = {
        currentType: roomConfig.type,
        autoConvertEnabled: true,
        hoursUntilCheckIn,
        willAutoConvert: hoursUntilCheckIn <= 48 && availability.occupied === 0,
        convertedType: 'mixed',
        autoConvertThreshold: 48
      };
    }

    // Return availability response
    res.status(200).json(
      ApiResponse.success({
        room: {
          id: roomId,
          name: roomConfig.name,
          type: roomConfig.type,
          capacity: roomConfig.capacity,
          isFlexible: roomConfig.isFlexible
        },
        period: {
          checkIn,
          checkOut,
          nights: Math.ceil(
            (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        },
        availability: {
          available: availability.available,
          occupied: availability.occupied,
          capacity: roomConfig.capacity,
          availabilityPercentage: (availability.available / roomConfig.capacity) * 100
        },
        occupancyByDate,
        bookings: bookings.map(booking => ({
          id: booking.id,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          bedsOccupied: booking.bedsCount,
          status: booking.status
        })),
        flexibleRoomStatus
      }, 'Room availability retrieved successfully')
    );

  } catch (error) {
    logger.error('Error checking room availability', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Get Room Configuration
 * 
 * @param {string} roomId - Room identifier
 * @returns {object} Room configuration
 */
function getRoomConfig(roomId: string): {
  name: string;
  type: string;
  capacity: number;
  isFlexible: boolean;
  basePrice: number;
} {
  const configs: Record<string, any> = {
    room_mixto_12a: {
      name: 'Mixto 12A',
      type: 'mixed',
      capacity: 12,
      isFlexible: false,
      basePrice: 60.0
    },
    room_mixto_12b: {
      name: 'Mixto 12B',
      type: 'mixed',
      capacity: 12,
      isFlexible: false,
      basePrice: 60.0
    },
    room_mixto_7: {
      name: 'Mixto 7',
      type: 'mixed',
      capacity: 7,
      isFlexible: false,
      basePrice: 60.0
    },
    room_flexible_7: {
      name: 'Flexible 7',
      type: 'female',
      capacity: 7,
      isFlexible: true,
      basePrice: 60.0
    }
  };

  return configs[roomId];
}

/**
 * Calculate Daily Occupancy
 * 
 * Generates day-by-day occupancy breakdown for the requested period
 * 
 * @param {Date} checkIn - Check-in date
 * @param {Date} checkOut - Check-out date
 * @param {Array} bookings - Existing bookings
 * @param {number} capacity - Room capacity
 * @returns {Array} Daily occupancy data
 */
function calculateDailyOccupancy(
  checkIn: Date,
  checkOut: Date,
  bookings: Array<{
    checkIn: string;
    checkOut: string;
    bedsCount: number;
    status: string;
  }>,
  capacity: number
): Array<{
  date: string;
  available: number;
  occupied: number;
  capacity: number;
  bookingsCount: number;
}> {
  const occupancy: Array<any> = [];
  const currentDate = new Date(checkIn);

  while (currentDate < checkOut) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Count occupied beds for this date
    let occupied = 0;
    let bookingsCount = 0;

    for (const booking of bookings) {
      if (booking.status !== 'CONFIRMED') continue;

      const bookingCheckIn = new Date(booking.checkIn);
      const bookingCheckOut = new Date(booking.checkOut);

      // Check if booking overlaps with this date
      if (currentDate >= bookingCheckIn && currentDate < bookingCheckOut) {
        occupied += booking.bedsCount;
        bookingsCount++;
      }
    }

    occupancy.push({
      date: dateStr,
      available: capacity - occupied,
      occupied,
      capacity,
      bookingsCount
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return occupancy;
}
