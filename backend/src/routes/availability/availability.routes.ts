/**
 * File: lapa-casa-hostel/backend/src/routes/availability/availability.routes.ts
 * Availability Routes Module
 * Lapa Casa Hostel Channel Manager
 * 
 * Handles availability checking and room allocation endpoints
 * Implements anti-overbooking logic and flexible room conversion
 * 
 * @module routes/availability
 * @requires express
 */

import { Router } from 'express';
import { checkAvailabilityHandler } from './check-availability';
import { roomAvailabilityHandler } from './room-availability';
import { validationMiddleware } from '../../middleware/validation';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Check General Availability
 * @route GET /availability/check
 * @group Availability - Availability checking operations
 * @param {string} checkIn.query.required - Check-in date (YYYY-MM-DD)
 * @param {string} checkOut.query.required - Check-out date (YYYY-MM-DD)
 * @param {number} beds.query.required - Number of beds needed
 * @returns {object} 200 - Availability details with room options
 * @returns {Error} 400 - Invalid date format or parameters
 * @returns {Error} 500 - Server error
 */
router.get(
  '/check',
  validationMiddleware('checkAvailability'),
  checkAvailabilityHandler
);

/**
 * Check Room-Specific Availability
 * @route GET /availability/room/:roomId
 * @group Availability - Availability checking operations
 * @param {string} roomId.path.required - Room ID
 * @param {string} checkIn.query.required - Check-in date (YYYY-MM-DD)
 * @param {string} checkOut.query.required - Check-out date (YYYY-MM-DD)
 * @returns {object} 200 - Room availability details
 * @returns {Error} 400 - Invalid parameters
 * @returns {Error} 404 - Room not found
 * @returns {Error} 500 - Server error
 */
router.get(
  '/room/:roomId',
  validationMiddleware('checkRoomAvailability'),
  roomAvailabilityHandler
);

/**
 * Get Calendar View
 * @route GET /availability/calendar
 * @group Availability - Availability checking operations
 * @param {string} month.query.required - Month (YYYY-MM)
 * @param {string} roomId.query - Filter by specific room
 * @returns {object} 200 - Calendar with availability data
 * @returns {Error} 400 - Invalid parameters
 * @returns {Error} 500 - Server error
 */
router.get(
  '/calendar',
  validationMiddleware('getCalendar'),
  async (req, res, next) => {
    try {
      const { month, roomId } = req.query;
      
      logger.info('Calendar availability request', { month, roomId });

      // This would call AvailabilityService.getCalendarAvailability()
      res.status(200).json({
        month,
        roomId: roomId || 'all',
        days: []
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get Availability Summary
 * @route GET /availability/summary
 * @group Availability - Availability checking operations
 * @param {string} from.query.required - Start date (YYYY-MM-DD)
 * @param {string} to.query.required - End date (YYYY-MM-DD)
 * @returns {object} 200 - Availability summary by date
 * @returns {Error} 400 - Invalid parameters
 * @returns {Error} 500 - Server error
 */
router.get(
  '/summary',
  validationMiddleware('getAvailabilitySummary'),
  async (req, res, next) => {
    try {
      const { from, to } = req.query;
      
      logger.info('Availability summary request', { from, to });

      res.status(200).json({
        period: { from, to },
        summary: {
          totalBeds: 38,
          averageOccupancy: 0,
          highDemandDates: [],
          lowDemandDates: []
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export const availabilityRouter = router;
