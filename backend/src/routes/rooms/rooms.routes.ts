/**
 * File: lapa-casa-hostel/backend/src/routes/rooms/rooms.routes.ts
 * Rooms Routes Module
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles room information and configuration endpoints
 * Provides room details, amenities, and pricing information
 * 
 * @module routes/rooms
 * @requires express
 */

import { Router } from 'express';
import { listRoomsHandler } from './list-rooms';
import { getRoomHandler } from './get-room';
import { validationMiddleware } from '../../middleware/validation';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * File: lapa-casa-hostel/backend/src/routes/rooms/rooms.routes.ts
 * Rooms Routes Module
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles room information and configuration endpoints
 * Provides room details, amenities, and pricing information
 * 
 * @module routes/rooms
 * @requires express
 */

import { Router } from 'express';
import { listRoomsHandler } from './list-rooms';
import { getRoomHandler } from './get-room';
import { validationMiddleware } from '../../middleware/validation';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * List All Rooms
 * @route GET /rooms
 * @group Rooms - Room information operations
 * @returns {Array.<Room>} 200 - List of all rooms
 * @returns {Error} 500 - Server error
 */
router.get(
  '/',
  listRoomsHandler
);

/**
 * Get Room by ID
 * @route GET /rooms/:id
 * @group Rooms - Room information operations
 * @param {string} id.path.required - Room ID
 * @returns {Room.model} 200 - Room details
 * @returns {Error} 404 - Room not found
 * @returns {Error} 500 - Server error
 */
router.get(
  '/:id',
  validationMiddleware('getRoom'),
  getRoomHandler
);

/**
 * Get Room Amenities
 * @route GET /rooms/:id/amenities
 * @group Rooms - Room information operations
 * @param {string} id.path.required - Room ID
 * @returns {object} 200 - Room amenities
 * @returns {Error} 404 - Room not found
 * @returns {Error} 500 - Server error
 */
router.get(
  '/:id/amenities',
  validationMiddleware('getRoom'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      logger.info('Get room amenities', { roomId: id });

      const amenities = {
        roomId: id,
        included: [
          'Air conditioning',
          'Free Wi-Fi',
          'Lockers',
          'Bed linens',
          'Towels',
          'Reading lights',
          'Power outlets',
          'Shared bathroom'
        ],
        shared: [
          'Kitchen',
          'Common area',
          'Terrace',
          'TV room',
          'Laundry facilities'
        ]
      };

      res.status(200).json(amenities);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Room Photos
 * @route GET /rooms/:id/photos
 * @group Rooms - Room information operations
 * @param {string} id.path.required - Room ID
 * @returns {object} 200 - Room photos
 * @returns {Error} 404 - Room not found
 * @returns {Error} 500 - Server error
 */
router.get(
  '/:id/photos',
  validationMiddleware('getRoom'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      logger.info('Get room photos', { roomId: id });

      res.status(200).json({
        roomId: id,
        photos: [
          {
            url: `/images/rooms/${id}/photo1.jpg`,
            caption: 'Room overview',
            isPrimary: true
          },
          {
            url: `/images/rooms/${id}/photo2.jpg`,
            caption: 'Beds detail',
            isPrimary: false
          }
        ]
      });
    } catch (error) {
      next(error);
    }
  }
);

export const roomsRouter = router;
