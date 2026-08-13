// lapa-casa-hostel/backend/src/routes/availability/apartment-availability.ts
//
// Disponibilidad de apartamentos. Cada apartamento es una unidad completa
// (1 cama en la tabla beds = la unidad entera). El precio es por noche
// sin multiplicadores por persona.

import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { AvailabilityService } from '../../services/availability-service';
import { pricingService } from '../../services/pricing-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const availabilityService = new AvailabilityService();

export const checkApartmentAvailabilityHandler = async (
  req: Request<{}, {}, {}, { checkIn?: string; checkOut?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      res.status(400).json(ApiResponse.error('checkIn y checkOut son requeridos (YYYY-MM-DD)'));
      return;
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      res.status(400).json(ApiResponse.error('Fechas inválidas'));
      return;
    }

    if (checkInDate < now) {
      res.status(400).json(ApiResponse.error('La fecha de check-in no puede ser en el pasado'));
      return;
    }

    if (checkOutDate <= checkInDate) {
      res.status(400).json(ApiResponse.error('El check-out debe ser posterior al check-in'));
      return;
    }

    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const { rows: apartments } = await query<{
      id: string; code: string; name: string; capacity: number; base_price: string;
    }>(
      `SELECT id, code, name, capacity, base_price
       FROM room_types WHERE property_type = 'apartment' ORDER BY base_price, name`
    );

    const apartmentsWithAvailability = await Promise.all(
      apartments.map(async (apt) => {
        const avail = await availabilityService.checkRoomAvailability(apt.id, checkIn, checkOut);
        const basePrice = parseFloat(apt.base_price);

        // Un apartamento es 1 room con 1 "cama" (la unidad completa) --
        // reusa el mismo motor de precios que ya usa el hostel via
        // /availability/quote, en vez de recalcular temporada a mano
        // (ver REQUISITO CRITICO #6 en pricing-service.ts).
        try {
          const pricing = await pricingService.calculateTotalPrice({
            checkInDate: checkIn,
            checkOutDate: checkOut,
            rooms: [{ roomId: apt.id, bedsCount: 1 }],
            totalBeds: 1,
          });
          return {
            id: apt.id,
            code: apt.code,
            name: apt.name,
            capacity: apt.capacity,
            basePrice,
            priceTotal: pricing.totalPrice,
            seasonMultiplier: pricing.seasonMultiplier,
            seasonType: pricing.seasonType,
            depositAmount: pricing.depositAmount,
            available: avail.availableBeds > 0,
          };
        } catch (pricingError) {
          // p.ej. Carnaval con menos noches del minimo -- no tumbar todo
          // el listado por un apartamento no elegible en estas fechas.
          logger.warn('Apartment pricing unavailable for date range', {
            apartmentId: apt.id,
            checkIn, checkOut,
            error: pricingError instanceof Error ? pricingError.message : 'Unknown error',
          });
          return {
            id: apt.id,
            code: apt.code,
            name: apt.name,
            capacity: apt.capacity,
            basePrice,
            priceTotal: basePrice * nights,
            seasonMultiplier: 1,
            seasonType: 'media' as const,
            depositAmount: 0,
            available: false,
          };
        }
      })
    );

    logger.info('Apartment availability checked', {
      checkIn, checkOut, nights,
      total: apartments.length,
      available: apartmentsWithAvailability.filter(a => a.available).length,
    });

    res.status(200).json(ApiResponse.success({
      checkIn,
      checkOut,
      nights,
      apartments: apartmentsWithAvailability,
    }, 'Disponibilidad de apartamentos consultada'));
  } catch (error) {
    logger.error('Error checking apartment availability', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
};
