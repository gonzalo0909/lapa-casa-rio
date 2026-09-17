/**
 * File: lapa-casa-hostel/backend/src/routes/rooms/list-rooms.ts
 * List Rooms Handler
 * Lapa Casa Channel Manager
 *
 * Delegado a room-service.ts (ver room-service.ts) -- esta ruta
 * solo arma el envelope de respuesta con contenido estatico (amenities
 * compartidos, politicas) que no vive en la base.
 *
 * @module routes/rooms/list
 * @requires express
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { roomService } from '../../services/room-service';
import { query } from '../../config/database';

interface LuggageStorageConfig {
  price: number;
  currency: string;
  days: string;
  start_time: string;
  end_time: string;
}

const DEFAULT_LUGGAGE_STORAGE: LuggageStorageConfig = {
  price: 30,
  currency: 'BRL',
  days: 'Todos los días',
  start_time: '08:00',
  end_time: '22:00',
};

export const listRoomsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    logger.info('Listing all rooms');

    const [ROOMS, luggageStorageConfig] = await Promise.all([
      roomService.getRooms(),
      query<{ value: LuggageStorageConfig }>(
        `SELECT value FROM system_config WHERE key = 'luggage_storage'`,
      ),
    ]);
    const luggageStorage = luggageStorageConfig.rows[0]?.value ?? DEFAULT_LUGGAGE_STORAGE;

    const totalCapacity = ROOMS.reduce((sum, room) => sum + room.capacity, 0);
    const totalRooms = ROOMS.length;

    const roomsByType = ROOMS.reduce(
      (acc, room) => {
        const type = room.isFlexible ? 'flexible' : room.type;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(room);
        return acc;
      },
      {} as Record<string, typeof ROOMS>,
    );

    res.status(200).json(
      ApiResponse.success(
        {
          hostel: {
            name: 'Lapa Casa',
            location: 'Santa Teresa, Rio de Janeiro',
            totalRooms,
            totalCapacity,
          },
          rooms: ROOMS,
          summary: {
            byType: {
              mixed: roomsByType.mixed?.length || 0,
              female: roomsByType.female?.length || 0,
              flexible: roomsByType.flexible?.length || 0,
            },
            totalBeds: totalCapacity,
            largestRoom: Math.max(...ROOMS.map((r) => r.capacity)),
            smallestRoom: Math.min(...ROOMS.map((r) => r.capacity)),
          },
          pricing: {
            currency: 'BRL',
            // El descuento por grupo es global (se evalua sobre el total de
            // camas de toda la reserva, no por cuarto) -- ver
            // GET /api/v1/availability/check para los tramos reales
            // (group_discount_tiers, editable desde /admin/pricing.html).
            seasonalAdjustments: {
              high: { multiplier: 1.5, months: 'Dec-Mar', description: '+50%' },
              medium: { multiplier: 1.0, months: 'Apr-May, Oct-Nov', description: 'Base price' },
              low: { multiplier: 0.8, months: 'Jun-Sep', description: '-20%' },
              carnival: { multiplier: 2.0, month: 'February', description: '+100% (min 5 nights)' },
            },
          },
          sharedAmenities: [
            'Fully equipped kitchen',
            'Common lounge area',
            'Rooftop terrace with city views',
            'TV room',
            'Laundry facilities',
            'Reception until 10 PM',
            'Free Wi-Fi throughout',
            'Luggage storage',
            'Tour desk',
          ],
          policies: {
            checkIn: '14:00',
            checkOut: '12:00',
            // El depósito no es reembolsable bajo ninguna circunstancia --
            // cancelación en cualquier momento o no-show, sin importar la
            // anticipación (mismo texto que /termos-hospede y el FAQ, las
            // dos fuentes visibles para el huésped; este campo tenía una
            // política vieja, con tramos de reembolso parcial, que ya no
            // rige y contradecía a las otras dos).
            cancellation: {
              policy:
                'Non-refundable under any circumstance, regardless of notice (cancellation or no-show)',
            },
            deposit: {
              standard: '30% of total booking',
              largeGroups: '50% for groups of 15+ people',
            },
            minimumStay: {
              standard: 1,
              carnival: 5,
            },
            // Editable desde /admin/pricing.html (system_config.luggage_storage) -- también usado en /guardavolumes
            luggageStorage: {
              price: luggageStorage.price,
              currency: luggageStorage.currency,
              days: luggageStorage.days,
              startTime: luggageStorage.start_time,
              endTime: luggageStorage.end_time,
            },
          },
        },
        'Rooms retrieved successfully',
      ),
    );
  } catch (error) {
    logger.error('Error listing rooms', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    next(error);
  }
};
