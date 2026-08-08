// lapa-casa-hostel/backend/src/routes/availability/room-availability.ts
//
// Antes usaba un mapa ROOM_CONFIGS local con 4 habitaciones e IDs
// ficticios ("room_mixto_12a", sin mixto_7c) -- nunca matcheaba un UUID
// real de room_types, mismo bug de fondo que tenian get-room.ts y
// list-rooms.ts antes de corregirse (ver room-service.ts). Se corrige
// aca con el mismo patron: roomService.getRoom() como unica fuente de
// verdad. De paso se corrige un segundo bug: el desglose diario usaba
// un metodo (getBookingsForRoom) que no existe en availability-service.ts
// -- el chequeo `typeof === 'function'` siempre daba falso, asi que el
// desglose mostraba 100% disponible todos los dias sin importar la
// realidad. Ahora usa availabilityService.getRoomDailyOccupancy(), que
// delega en check_availability() dia por dia.

import { Request, Response, NextFunction } from 'express';
import { AvailabilityService } from '../../services/availability-service';
import { roomService } from '../../services/room-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const availabilityService = new AvailabilityService();

export const roomAvailabilityHandler = async (
  req: Request<{ roomId: string }, {}, {}, { checkIn: string; checkOut: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const { checkIn, checkOut } = req.query;

    logger.info('Checking room availability', { roomId, checkIn, checkOut });

    const room = await roomService.getRoom(roomId);
    if (!room) {
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
    const occupancyByDate = await availabilityService.getRoomDailyOccupancy(roomId, checkIn, checkOut);
    const beds = await availabilityService.getRoomBeds(roomId, checkIn, checkOut);

    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let flexibleRoomStatus = null;
    if (room.isFlexible) {
      const status = await availabilityService.getFlexibleRoomStatus(roomId, checkIn);
      const hoursUntilCheckIn = Math.ceil(
        (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      flexibleRoomStatus = {
        currentType: status.effectiveGender,
        autoConvertEnabled: true,
        hoursUntilCheckIn,
        willAutoConvert: status.willConvertPrediction,
        convertedType: 'mixed',
        autoConvertThreshold: 48
      };
    }

    res.status(200).json(
      ApiResponse.success({
        room: {
          id: room.id,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          isFlexible: room.isFlexible
        },
        period: { checkIn, checkOut, nights },
        availability: {
          availableBeds: avail.availableBeds,
          occupiedBeds: avail.occupiedBeds,
          capacity: room.capacity,
          availabilityPercentage: Math.round((avail.availableBeds / room.capacity) * 100)
        },
        occupancyByDate,
        beds,
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
