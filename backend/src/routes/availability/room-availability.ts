// lapa-casa-hostel/backend/src/routes/availability/room-availability.ts

import { Request, Response, NextFunction } from 'express';
import { AvailabilityService } from '../../services/availability-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const availabilityService = new AvailabilityService();

const ROOM_CONFIGS: Record<string, { name: string; type: string; capacity: number; isFlexible: boolean }> = {
  room_mixto_12a:  { name: 'Mixto 12A',  type: 'mixed',  capacity: 12, isFlexible: false },
  room_mixto_12b:  { name: 'Mixto 12B',  type: 'mixed',  capacity: 12, isFlexible: false },
  room_mixto_7:    { name: 'Mixto 7',    type: 'mixed',  capacity: 7,  isFlexible: false },
  room_flexible_7: { name: 'Flexible 7', type: 'female', capacity: 7,  isFlexible: true  }
};

export const roomAvailabilityHandler = async (
  req: Request<{ roomId: string }, {}, {}, { checkIn: string; checkOut: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { checkIn, checkOut } = req.query;

    logger.info('Checking room availability', { roomId, checkIn, checkOut });

    const roomConfig = ROOM_CONFIGS[roomId];
    if (!roomConfig) {
      res.status(404).json(ApiResponse.error('Room not found', { roomId }));
      return;
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();

    if (checkInDate < now) {
      res.status(400).json(ApiResponse.error('Check-in date cannot be in the past'));
      return;
    }
    if (checkOutDate <= checkInDate) {
      res.status(400).json(ApiResponse.error('Check-out date must be after check-in date'));
      return;
    }

    const avail = await availabilityService.checkRoomAvailability(roomId, checkIn, checkOut);

    const availableBeds = avail.availableBeds;
    const occupiedBeds = avail.occupiedBeds ?? (roomConfig.capacity - availableBeds);

    // Fetch bookings for the room (method may not exist — degrade gracefully)
    let bookings: any[] = [];
    try {
      if (typeof (availabilityService as any).getBookingsForRoom === 'function') {
        bookings = await (availabilityService as any).getBookingsForRoom(roomId, checkIn, checkOut);
      }
    } catch {
      bookings = [];
    }

    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const occupancyByDate = calculateDailyOccupancy(checkInDate, checkOutDate, bookings, roomConfig.capacity);

    let flexibleRoomStatus = null;
    if (roomConfig.isFlexible) {
      const hoursUntilCheckIn = Math.ceil(
        (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      flexibleRoomStatus = {
        currentType: roomConfig.type,
        autoConvertEnabled: true,
        hoursUntilCheckIn,
        willAutoConvert: hoursUntilCheckIn <= 48 && occupiedBeds === 0,
        convertedType: 'mixed',
        autoConvertThreshold: 48
      };
    }

    res.status(200).json(
      ApiResponse.success({
        room: {
          id: roomId,
          name: roomConfig.name,
          type: roomConfig.type,
          capacity: roomConfig.capacity,
          isFlexible: roomConfig.isFlexible
        },
        period: { checkIn, checkOut, nights },
        availability: {
          availableBeds,
          occupiedBeds,
          capacity: roomConfig.capacity,
          availabilityPercentage: Math.round((availableBeds / roomConfig.capacity) * 100)
        },
        occupancyByDate,
        bookings: bookings.map((b: any) => ({
          id: b.id,
          checkIn: b.check_in_date ?? b.checkIn ?? b.check_in,
          checkOut: b.check_out_date ?? b.checkOut ?? b.check_out,
          bedsOccupied: b.total_beds ?? b.bedsCount ?? 1,
          status: b.status
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

function calculateDailyOccupancy(
  checkIn: Date,
  checkOut: Date,
  bookings: any[],
  capacity: number
): Array<{ date: string; available: number; occupied: number; capacity: number; bookingsCount: number }> {
  const occupancy = [];
  const current = new Date(checkIn);

  while (current < checkOut) {
    const dateStr = current.toISOString().split('T')[0];
    let occupied = 0;
    let bookingsCount = 0;

    for (const b of bookings) {
      if (b.status !== 'confirmed') continue;
      const bIn  = new Date(b.check_in_date  ?? b.checkIn  ?? b.check_in);
      const bOut = new Date(b.check_out_date ?? b.checkOut ?? b.check_out);
      if (current >= bIn && current < bOut) {
        occupied += b.total_beds ?? b.bedsCount ?? 1;
        bookingsCount++;
      }
    }

    occupancy.push({ date: dateStr, available: capacity - occupied, occupied, capacity, bookingsCount });
    current.setDate(current.getDate() + 1);
  }

  return occupancy;
}
