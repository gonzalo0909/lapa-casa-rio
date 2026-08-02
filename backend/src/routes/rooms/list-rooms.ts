/**
 * File: lapa-casa-hostel/backend/src/routes/rooms/list-rooms.ts
 * List Rooms Handler
 * Lapa Casa Hostel Channel Manager
 *
 * Devuelve las 5 habitaciones reales desde room_types (id UUID real,
 * capacidad, precio base, genero). Antes tenia 4 habitaciones
 * hardcodeadas (faltaba Mixto 7C) con IDs ficticios tipo
 * "room_mixto_12a" que no existen en la base -- ninguna ruta que
 * dependiera de esos IDs (ej. crear una reserva con ese roomId) podia
 * funcionar. El contenido descriptivo (amenities, textos) no vive en la
 * base, asi que se mergea por `code` con la config real.
 *
 * @module routes/rooms/list
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const ROOM_CONTENT: Record<string, {
  description: { en: string; pt: string; es: string };
  amenities: string[];
  floor: number;
  features: { windowView: boolean; ensuiteBathroom: boolean; balcony: boolean };
  flexibleRoomPolicy?: {
    defaultType: string;
    autoConvertType: string;
    autoConvertHours: number;
    description: { en: string; pt: string; es: string };
  };
}> = {
  mixto_12a: {
    description: {
      en: 'Mixed dormitory with 12 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 12 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 12 camas, aire acondicionado y casilleros'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 1,
    features: { windowView: true, ensuiteBathroom: false, balcony: false }
  },
  mixto_12b: {
    description: {
      en: 'Mixed dormitory with 12 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 12 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 12 camas, aire acondicionado y casilleros'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 1,
    features: { windowView: true, ensuiteBathroom: false, balcony: false }
  },
  mixto_7: {
    description: {
      en: 'Mixed dormitory with 7 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 7 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 7 camas, aire acondicionado y casilleros'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 2,
    features: { windowView: true, ensuiteBathroom: false, balcony: false }
  },
  mixto_7c: {
    description: {
      en: 'Mixed dormitory with 7 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 7 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 7 camas, aire acondicionado y casilleros'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 2,
    features: { windowView: true, ensuiteBathroom: false, balcony: false }
  },
  flexible_7: {
    description: {
      en: 'Female dormitory with 7 beds (converts to mixed 48h before if no female bookings)',
      pt: 'Dormitório feminino com 7 camas (converte para misto 48h antes se sem reservas femininas)',
      es: 'Dormitorio femenino con 7 camas (convierte a mixto 48h antes si sin reservas femeninas)'
    },
    amenities: ['Air conditioning', 'Individual lockers', 'Reading lights', 'Power outlets', 'Free Wi-Fi', 'Shared bathroom'],
    floor: 2,
    features: { windowView: true, ensuiteBathroom: false, balcony: true },
    flexibleRoomPolicy: {
      defaultType: 'female',
      autoConvertType: 'mixed',
      autoConvertHours: 48,
      description: {
        en: 'Automatically converts to mixed dormitory 48 hours before check-in if no female bookings',
        pt: 'Converte automaticamente para dormitório misto 48 horas antes do check-in se sem reservas femininas',
        es: 'Convierte automáticamente a dormitorio mixto 48 horas antes del check-in si sin reservas femeninas'
      }
    }
  }
};

export const listRoomsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Listing all rooms');

    const { rows } = await query<{
      id: string; code: string; name: string; capacity: number;
      default_gender: string; is_flexible: boolean; base_price: string;
    }>(`SELECT id, code, name, capacity, default_gender, is_flexible, base_price FROM room_types ORDER BY capacity, code`);

    const ROOMS = rows.map((r) => {
      const content = ROOM_CONTENT[r.code] ?? { description: { en: '', pt: '', es: '' }, amenities: [], floor: 1, features: { windowView: true, ensuiteBathroom: false, balcony: false } };
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        type: r.default_gender,
        capacity: r.capacity,
        isFlexible: r.is_flexible,
        basePrice: parseFloat(r.base_price),
        currency: 'BRL',
        ...content
      };
    });

    const totalCapacity = ROOMS.reduce((sum, room) => sum + room.capacity, 0);
    const totalRooms = ROOMS.length;

    const roomsByType = ROOMS.reduce((acc, room) => {
      const type = room.isFlexible ? 'flexible' : room.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(room);
      return acc;
    }, {} as Record<string, typeof ROOMS>);

    res.status(200).json(
      ApiResponse.success({
        hostel: {
          name: 'Lapa Casa Hostel',
          location: 'Santa Teresa, Rio de Janeiro',
          totalRooms,
          totalCapacity
        },
        rooms: ROOMS,
        summary: {
          byType: {
            mixed: roomsByType.mixed?.length || 0,
            female: roomsByType.female?.length || 0,
            flexible: roomsByType.flexible?.length || 0
          },
          totalBeds: totalCapacity,
          largestRoom: Math.max(...ROOMS.map(r => r.capacity)),
          smallestRoom: Math.min(...ROOMS.map(r => r.capacity))
        },
        pricing: {
          basePrice: 60.0,
          currency: 'BRL',
          groupDiscounts: [
            { minBeds: 7, discount: 10, description: '10% off for 7-15 beds' },
            { minBeds: 16, discount: 15, description: '15% off for 16-25 beds' },
            { minBeds: 26, discount: 20, description: '20% off for 26+ beds' }
          ],
          seasonalAdjustments: {
            high: { multiplier: 1.5, months: 'Dec-Mar', description: '+50%' },
            medium: { multiplier: 1.0, months: 'Apr-May, Oct-Nov', description: 'Base price' },
            low: { multiplier: 0.8, months: 'Jun-Sep', description: '-20%' },
            carnival: { multiplier: 2.0, month: 'February', description: '+100% (min 5 nights)' }
          }
        },
        sharedAmenities: [
          'Fully equipped kitchen',
          'Common lounge area',
          'Rooftop terrace with city views',
          'TV room',
          'Laundry facilities',
          '24/7 reception',
          'Free breakfast',
          'Free Wi-Fi throughout',
          'Luggage storage',
          'Tour desk'
        ],
        policies: {
          checkIn: '14:00',
          checkOut: '11:00',
          cancellation: {
            free: 'More than 168 hours (7 days) before check-in',
            partial: '50% refund 48-168 hours before',
            none: 'No refund less than 48 hours before'
          },
          deposit: {
            standard: '30% of total booking',
            largeGroups: '50% for groups of 15+ people'
          },
          minimumStay: {
            standard: 1,
            carnival: 5
          }
        }
      }, 'Rooms retrieved successfully')
    );
  } catch (error) {
    logger.error('Error listing rooms', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};
