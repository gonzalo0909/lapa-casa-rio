/**
 * File: lapa-casa-hostel/backend/src/routes/rooms/list-rooms.ts
 * List Rooms Handler
 * Lapa Casa Hostel Channel Manager
 *
 * Delegado a room-service.ts (Ventana 2, entregable 5) -- esta ruta
 * solo arma el envelope de respuesta con contenido estatico (amenities
 * compartidos, politicas) que no vive en la base.
 *
 * @module routes/rooms/list
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { roomService } from '../../services/room-service';

export const listRoomsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Listing all rooms');

    const ROOMS = await roomService.getRooms();

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
