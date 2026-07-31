/**
 * File: lapa-casa-hostel/backend/src/routes/rooms/list-rooms.ts
 * List Rooms Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Returns complete list of all rooms with configuration
 * Includes capacity, type, pricing, and amenities
 * 
 * @module routes/rooms/list
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

/**
 * Lapa Casa Hostel Room Configuration
 */
const ROOMS = [
  {
    id: 'room_mixto_12a',
    name: 'Mixto 12A',
    type: 'mixed',
    capacity: 12,
    isFlexible: false,
    basePrice: 60.0,
    currency: 'BRL',
    description: {
      en: 'Mixed dormitory with 12 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 12 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 12 camas, aire acondicionado y casilleros'
    },
    amenities: [
      'Air conditioning',
      'Individual lockers',
      'Reading lights',
      'Power outlets',
      'Free Wi-Fi',
      'Shared bathroom'
    ],
    bedConfiguration: {
      bunkBeds: 6,
      totalBeds: 12
    },
    floor: 1,
    features: {
      windowView: true,
      ensuiteBathroom: false,
      balcony: false
    }
  },
  {
    id: 'room_mixto_12b',
    name: 'Mixto 12B',
    type: 'mixed',
    capacity: 12,
    isFlexible: false,
    basePrice: 60.0,
    currency: 'BRL',
    description: {
      en: 'Mixed dormitory with 12 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 12 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 12 camas, aire acondicionado y casilleros'
    },
    amenities: [
      'Air conditioning',
      'Individual lockers',
      'Reading lights',
      'Power outlets',
      'Free Wi-Fi',
      'Shared bathroom'
    ],
    bedConfiguration: {
      bunkBeds: 6,
      totalBeds: 12
    },
    floor: 1,
    features: {
      windowView: true,
      ensuiteBathroom: false,
      balcony: false
    }
  },
  {
    id: 'room_mixto_7',
    name: 'Mixto 7',
    type: 'mixed',
    capacity: 7,
    isFlexible: false,
    basePrice: 60.0,
    currency: 'BRL',
    description: {
      en: 'Mixed dormitory with 7 beds, air conditioning and lockers',
      pt: 'Dormitório misto com 7 camas, ar condicionado e armários',
      es: 'Dormitorio mixto con 7 camas, aire acondicionado y casilleros'
    },
    amenities: [
      'Air conditioning',
      'Individual lockers',
      'Reading lights',
      'Power outlets',
      'Free Wi-Fi',
      'Shared bathroom'
    ],
    bedConfiguration: {
      bunkBeds: 3,
      singleBeds: 1,
      totalBeds: 7
    },
    floor: 2,
    features: {
      windowView: true,
      ensuiteBathroom: false,
      balcony: false
    }
  },
  {
    id: 'room_flexible_7',
    name: 'Flexible 7',
    type: 'female',
    capacity: 7,
    isFlexible: true,
    basePrice: 60.0,
    currency: 'BRL',
    description: {
      en: 'Female dormitory with 7 beds (converts to mixed 48h before if no female bookings)',
      pt: 'Dormitório feminino com 7 camas (converte para misto 48h antes se sem reservas femininas)',
      es: 'Dormitorio femenino con 7 camas (convierte a mixto 48h antes si sin reservas femeninas)'
    },
    amenities: [
      'Air conditioning',
      'Individual lockers',
      'Reading lights',
      'Power outlets',
      'Free Wi-Fi',
      'Shared bathroom'
    ],
    bedConfiguration: {
      bunkBeds: 3,
      singleBeds: 1,
      totalBeds: 7
    },
    floor: 2,
    features: {
      windowView: true,
      ensuiteBathroom: false,
      balcony: true
    },
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
];

/**
 * List Rooms Handler
 * 
 * Returns all available rooms with complete information
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const listRoomsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Listing all rooms');

    // Calculate total capacity
    const totalCapacity = ROOMS.reduce((sum, room) => sum + room.capacity, 0);
    const totalRooms = ROOMS.length;

    // Group rooms by type
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
            free: 'More than 30 days before check-in',
            partial: '50% refund 15-30 days before',
            none: 'No refund less than 15 days before'
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
