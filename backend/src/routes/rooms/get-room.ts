/**
 * File: lapa-casa-hostel/backend/src/routes/rooms/get-room.ts
 * Get Room Handler
 * Lapa Casa Hostel Channel Manager
 * 
 * Returns detailed information for a specific room
 * Includes configuration, amenities, pricing, and availability
 * 
 * @module routes/rooms/get
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

/**
 * Get Room Handler
 * 
 * Returns complete details for a specific room
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
export const getRoomHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Get room details', { roomId: id });

    // Get room configuration
    const room = getRoomConfig(id);

    if (!room) {
      res.status(404).json(
        ApiResponse.error('Room not found', { roomId: id })
      );
      return;
    }

    res.status(200).json(
      ApiResponse.success(room, 'Room retrieved successfully')
    );

  } catch (error) {
    logger.error('Error getting room', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    next(error);
  }
};

/**
 * Get Room Configuration
 * 
 * Returns complete room configuration by ID
 * 
 * @param {string} roomId - Room identifier
 * @returns {object | null} Room configuration or null if not found
 */
function getRoomConfig(roomId: string): any {
  const rooms: Record<string, any> = {
    room_mixto_12a: {
      id: 'room_mixto_12a',
      name: 'Mixto 12A',
      type: 'mixed',
      capacity: 12,
      isFlexible: false,
      basePrice: 60.0,
      currency: 'BRL',
      description: {
        en: 'Spacious mixed dormitory with 12 beds, featuring air conditioning, individual lockers, and comfortable bunk beds. Perfect for groups and solo travelers looking for an affordable stay in Santa Teresa.',
        pt: 'Dormitório misto espaçoso com 12 camas, com ar condicionado, armários individuais e beliches confortáveis. Perfeito para grupos e viajantes solo que procuram uma estadia acessível em Santa Teresa.',
        es: 'Amplio dormitorio mixto con 12 camas, con aire acondicionado, casilleros individuales y literas cómodas. Perfecto para grupos y viajeros solitarios que buscan una estadía económica en Santa Teresa.'
      },
      amenities: [
        'Air conditioning',
        'Individual lockers',
        'Reading lights',
        'Power outlets',
        'Free Wi-Fi',
        'Shared bathroom',
        'Bed linens included',
        'Towels provided'
      ],
      bedConfiguration: {
        bunkBeds: 6,
        totalBeds: 12,
        mattressType: 'Orthopedic',
        bedSize: 'Single (90x200cm)'
      },
      floor: 1,
      roomSize: '35m²',
      features: {
        windowView: true,
        viewDescription: 'Santa Teresa neighborhood',
        ensuiteBathroom: false,
        balcony: false,
        soundproofing: true
      },
      photos: [
        '/images/rooms/mixto_12a_1.jpg',
        '/images/rooms/mixto_12a_2.jpg',
        '/images/rooms/mixto_12a_3.jpg'
      ]
    },
    room_mixto_12b: {
      id: 'room_mixto_12b',
      name: 'Mixto 12B',
      type: 'mixed',
      capacity: 12,
      isFlexible: false,
      basePrice: 60.0,
      currency: 'BRL',
      description: {
        en: 'Spacious mixed dormitory with 12 beds, featuring air conditioning, individual lockers, and comfortable bunk beds. Perfect for groups and solo travelers looking for an affordable stay in Santa Teresa.',
        pt: 'Dormitório misto espaçoso com 12 camas, com ar condicionado, armários individuais e beliches confortáveis. Perfeito para grupos e viajantes solo que procuram uma estadia acessível em Santa Teresa.',
        es: 'Amplio dormitorio mixto con 12 camas, con aire acondicionado, casilleros individuales y literas cómodas. Perfecto para grupos y viajeros solitarios que buscan una estadía económica en Santa Teresa.'
      },
      amenities: [
        'Air conditioning',
        'Individual lockers',
        'Reading lights',
        'Power outlets',
        'Free Wi-Fi',
        'Shared bathroom',
        'Bed linens included',
        'Towels provided'
      ],
      bedConfiguration: {
        bunkBeds: 6,
        totalBeds: 12,
        mattressType: 'Orthopedic',
        bedSize: 'Single (90x200cm)'
      },
      floor: 1,
      roomSize: '35m²',
      features: {
        windowView: true,
        viewDescription: 'Street view',
        ensuiteBathroom: false,
        balcony: false,
        soundproofing: true
      },
      photos: [
        '/images/rooms/mixto_12b_1.jpg',
        '/images/rooms/mixto_12b_2.jpg',
        '/images/rooms/mixto_12b_3.jpg'
      ]
    },
    room_mixto_7: {
      id: 'room_mixto_7',
      name: 'Mixto 7',
      type: 'mixed',
      capacity: 7,
      isFlexible: false,
      basePrice: 60.0,
      currency: 'BRL',
      description: {
        en: 'Cozy mixed dormitory with 7 beds, ideal for smaller groups. Features air conditioning, individual lockers, and a more intimate atmosphere while maintaining all the comfort of our larger dorms.',
        pt: 'Dormitório misto aconchegante com 7 camas, ideal para grupos menores. Com ar condicionado, armários individuais e uma atmosfera mais íntima, mantendo todo o conforto dos nossos dormitórios maiores.',
        es: 'Acogedor dormitorio mixto con 7 camas, ideal para grupos más pequeños. Cuenta con aire acondicionado, casilleros individuales y un ambiente más íntimo manteniendo toda la comodidad de nuestros dormitorios más grandes.'
      },
      amenities: [
        'Air conditioning',
        'Individual lockers',
        'Reading lights',
        'Power outlets',
        'Free Wi-Fi',
        'Shared bathroom',
        'Bed linens included',
        'Towels provided'
      ],
      bedConfiguration: {
        bunkBeds: 3,
        singleBeds: 1,
        totalBeds: 7,
        mattressType: 'Orthopedic',
        bedSize: 'Single (90x200cm)'
      },
      floor: 2,
      roomSize: '25m²',
      features: {
        windowView: true,
        viewDescription: 'City skyline',
        ensuiteBathroom: false,
        balcony: false,
        soundproofing: true
      },
      photos: [
        '/images/rooms/mixto_7_1.jpg',
        '/images/rooms/mixto_7_2.jpg',
        '/images/rooms/mixto_7_3.jpg'
      ]
    },
    room_flexible_7: {
      id: 'room_flexible_7',
      name: 'Flexible 7',
      type: 'female',
      capacity: 7,
      isFlexible: true,
      basePrice: 60.0,
      currency: 'BRL',
      description: {
        en: 'Female-only dormitory with 7 beds and private balcony. This room automatically converts to a mixed dormitory 48 hours before check-in if there are no female bookings, maximizing availability for all guests.',
        pt: 'Dormitório exclusivo feminino com 7 camas e varanda privativa. Este quarto converte automaticamente para dormitório misto 48 horas antes do check-in se não houver reservas femininas, maximizando a disponibilidade para todos os hóspedes.',
        es: 'Dormitorio exclusivo femenino con 7 camas y balcón privado. Esta habitación se convierte automáticamente en dormitorio mixto 48 horas antes del check-in si no hay reservas femeninas, maximizando la disponibilidad para todos los huéspedes.'
      },
      amenities: [
        'Air conditioning',
        'Individual lockers',
        'Reading lights',
        'Power outlets',
        'Free Wi-Fi',
        'Shared bathroom',
        'Bed linens included',
        'Towels provided',
        'Private balcony'
      ],
      bedConfiguration: {
        bunkBeds: 3,
        singleBeds: 1,
        totalBeds: 7,
        mattressType: 'Orthopedic',
        bedSize: 'Single (90x200cm)'
      },
      floor: 2,
      roomSize: '28m²',
      features: {
        windowView: true,
        viewDescription: 'Panoramic city view',
        ensuiteBathroom: false,
        balcony: true,
        balconyDescription: 'Private balcony with seating area',
        soundproofing: true
      },
      flexibleRoomPolicy: {
        defaultType: 'female',
        autoConvertType: 'mixed',
        autoConvertHours: 48,
        description: {
          en: 'This room is reserved for female guests by default. If there are no female bookings 48 hours before check-in, it automatically converts to a mixed dormitory to maximize availability.',
          pt: 'Este quarto é reservado para hóspedes do sexo feminino por padrão. Se não houver reservas femininas 48 horas antes do check-in, ele converte automaticamente para dormitório misto para maximizar a disponibilidade.',
          es: 'Esta habitación está reservada para huéspedes femeninas por defecto. Si no hay reservas femeninas 48 horas antes del check-in, se convierte automáticamente en dormitorio mixto para maximizar la disponibilidad.'
        }
      },
      photos: [
        '/images/rooms/flexible_7_1.jpg',
        '/images/rooms/flexible_7_2.jpg',
        '/images/rooms/flexible_7_3.jpg',
        '/images/rooms/flexible_7_balcony.jpg'
      ]
    }
  };

  return rooms[roomId] || null;
}
