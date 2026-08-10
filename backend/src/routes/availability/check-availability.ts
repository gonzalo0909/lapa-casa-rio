// lapa-casa-hostel/backend/src/routes/availability/check-availability.ts
//
// Antes usaba un ROOMS_CONFIG hardcodeado con roomId ficticios
// ("room_mixto_12a") que no existen en la base (room_types.id es UUID) y
// le faltaba Mixto 7C -- ninguna asignacion real podia funcionar con esos
// IDs. Ahora lee las 5 habitaciones reales de room_types.

import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { AvailabilityService } from '../../services/availability-service';
import { PricingService } from '../../services/pricing-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const availabilityService = new AvailabilityService();
const pricingService = new PricingService();

export const checkAvailabilityHandler = async (
  req: Request<{}, {}, {}, { checkIn: string; checkOut: string; beds: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checkIn, checkOut, beds } = req.query;
    const bedsNeeded = parseInt(beds, 10);

    logger.info('Checking availability', { checkIn, checkOut, bedsNeeded });

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
    if (isNaN(bedsNeeded) || bedsNeeded < 1 || bedsNeeded > 45) {
      res.status(400).json(ApiResponse.error('Beds requested must be between 1 and 45'));
      return;
    }

    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Solo habitaciones del hostel (category='hostel') — los apartamentos
    // tienen su propio endpoint: GET /availability/apartments
    const { rows: roomTypes } = await query<{
      id: string; code: string; name: string; capacity: number;
      default_gender: string; is_flexible: boolean; base_price: string;
    }>(
      `SELECT id, code, name, capacity, default_gender, is_flexible, base_price
       FROM room_types WHERE category = 'hostel' ORDER BY base_price, code`
    );

    const { rows: discountTiers } = await query<{ min_beds: number; percentage: string }>(
      `SELECT min_beds, percentage FROM group_discount_tiers ORDER BY min_beds`
    );

    const roomsAvailability = await Promise.all(
      roomTypes.map(async (rt) => {
        const avail = await availabilityService.checkRoomAvailability(rt.id, checkIn, checkOut);
        return {
          roomId: rt.id,
          name: rt.name,
          type: rt.default_gender,
          capacity: rt.capacity,
          isFlexible: rt.is_flexible,
          basePrice: parseFloat(rt.base_price),
          availableBeds: avail.availableBeds,
          occupiedBeds: avail.occupiedBeds
        };
      })
    );

    const totalAvailable = roomsAvailability.reduce((sum, r) => sum + r.availableBeds, 0);

    const hoursUntilCheckIn = Math.ceil(
      (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    const flexibleRoom = roomsAvailability.find((r) => r.isFlexible);
    if (flexibleRoom && flexibleRoom.occupiedBeds === 0 && hoursUntilCheckIn <= 48) {
      flexibleRoom.type = 'mixed';
      logger.info('Flexible room auto-converted to mixed', { hoursUntilCheckIn });
    }

    const available = totalAvailable >= bedsNeeded;

    const allocationOptions = available
      ? generateAllocationOptions(bedsNeeded, roomsAvailability)
      : [];

    const pricedOptions = await Promise.all(
      allocationOptions.map(async (option) => {
        const pricing = await pricingService.calculateTotalPrice({
          checkInDate: checkIn,
          checkOutDate: checkOut,
          rooms: option.rooms.map(r => ({ roomId: r.roomId, bedsCount: r.bedsAllocated })),
          totalBeds: bedsNeeded
        });
        return {
          ...option,
          pricing: {
            subtotal: pricing.basePrice,
            groupDiscount: pricing.discountAmount,
            groupDiscountPercentage: pricing.groupDiscountPercent,
            seasonalAdjustment: pricing.priceAfterSeason - pricing.priceAfterDiscount,
            seasonalMultiplier: pricing.seasonMultiplier,
            total: pricing.totalPrice,
            deposit: pricing.depositAmount,
            pricePerBed: pricing.totalPrice / bedsNeeded,
            currency: 'BRL'
          }
        };
      })
    );

    let alternativeDates: any[] = [];
    if (!available) {
      alternativeDates = await availabilityService.findAlternativeDates(checkIn, checkOut, bedsNeeded);
    }

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
          availableBeds: room.availableBeds,
          isFlexible: room.isFlexible,
          basePrice: room.basePrice,
          autoConverted: room.isFlexible && room.type === 'mixed' && hoursUntilCheckIn <= 48
        })),
        groupDiscountTiers: discountTiers.map(t => ({ minBeds: t.min_beds, percentage: parseFloat(t.percentage) })),
        allocationOptions: pricedOptions,
        alternativeDates: alternativeDates.slice(0, 5),
        flexibleRoomInfo: {
          autoConvertEnabled: true,
          hoursUntilCheckIn,
          willAutoConvert: hoursUntilCheckIn <= 48 && (flexibleRoom?.occupiedBeds ?? 1) === 0
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

function generateAllocationOptions(
  bedsNeeded: number,
  rooms: Array<{ roomId: string; name: string; type: string; capacity: number; availableBeds: number; isFlexible: boolean }>
): Array<{ option: number; totalRooms: number; rooms: Array<{ roomId: string; name: string; bedsAllocated: number }> }> {
  const options: any[] = [];
  const sortedRooms = rooms.filter(r => r.availableBeds > 0).sort((a, b) => b.availableBeds - a.availableBeds);

  // Option 1: fill largest rooms first
  let remaining = bedsNeeded;
  const option1: any[] = [];
  for (const room of sortedRooms) {
    if (remaining <= 0) break;
    const allocated = Math.min(remaining, room.availableBeds);
    option1.push({ roomId: room.roomId, name: room.name, bedsAllocated: allocated });
    remaining -= allocated;
  }
  if (remaining === 0) options.push({ option: 1, totalRooms: option1.length, rooms: option1 });

  // Option 2: balanced allocation
  if (sortedRooms.length > 1) {
    const bedsPerRoom = Math.ceil(bedsNeeded / Math.min(sortedRooms.length, 3));
    remaining = bedsNeeded;
    const option2: any[] = [];
    for (const room of sortedRooms) {
      if (remaining <= 0) break;
      const allocated = Math.min(remaining, Math.min(bedsPerRoom, room.availableBeds));
      if (allocated > 0) {
        option2.push({ roomId: room.roomId, name: room.name, bedsAllocated: allocated });
        remaining -= allocated;
      }
    }
    if (remaining === 0 && option2.length > 0) options.push({ option: 2, totalRooms: option2.length, rooms: option2 });
  }

  return options.slice(0, 3);
}
