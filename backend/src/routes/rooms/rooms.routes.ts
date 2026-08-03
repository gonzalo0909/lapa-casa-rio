// lapa-casa-hostel/backend/src/routes/rooms/rooms.routes.ts
// ventana3

import { Router } from 'express';
import { listRoomsHandler } from './list-rooms';
import { getRoomHandler } from './get-room';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { roomService } from '../../services/room-service';
import { availabilityService } from '../../services/availability-service';
import { query } from '../../config/database';

const router = Router();

router.get('/', listRoomsHandler);

router.get('/flexible/status', async (req, res, next) => {
  try {
    const { date } = req.query as { date?: string };

    const { rows: flexibleRows } = await query<{ id: string }>(
      `SELECT id FROM room_types WHERE is_flexible = true LIMIT 1`
    );

    if (flexibleRows.length === 0) {
      res.status(404).json(ApiResponse.error('No flexible room found'));
      return;
    }

    const flexibleRoomId = flexibleRows[0].id;

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json(ApiResponse.error('date must be YYYY-MM-DD'));
        return;
      }
      const status = await availabilityService.getFlexibleRoomStatus(flexibleRoomId, date);
      res.status(200).json(ApiResponse.success({
        roomId: flexibleRoomId,
        date,
        ...status
      }, 'Flexible room status retrieved'));
    } else {
      const prediction = await roomService.getFlexibleRoomPrediction();
      res.status(200).json(ApiResponse.success({
        roomId: flexibleRoomId,
        prediction
      }, 'Flexible room prediction retrieved'));
    }
  } catch (error) {
    logger.error('Error getting flexible room status', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

router.get('/:id', getRoomHandler);

router.get('/:id/amenities', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info('Get room amenities', { roomId: id });
    res.status(200).json({
      roomId: id,
      included: ['Air conditioning', 'Free Wi-Fi', 'Lockers', 'Bed linens', 'Towels', 'Reading lights', 'Power outlets', 'Shared bathroom'],
      shared: ['Kitchen', 'Common area', 'Terrace', 'TV room', 'Laundry facilities']
    });
  } catch (error) { next(error); }
});

router.get('/:id/photos', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info('Get room photos', { roomId: id });
    res.status(200).json({
      roomId: id,
      photos: [
        { url: `/images/rooms/${id}/photo1.jpg`, caption: 'Room overview', isPrimary: true },
        { url: `/images/rooms/${id}/photo2.jpg`, caption: 'Beds detail', isPrimary: false }
      ]
    });
  } catch (error) { next(error); }
});

export const roomsRouter = router;
