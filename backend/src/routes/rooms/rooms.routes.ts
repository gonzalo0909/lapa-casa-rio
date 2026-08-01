import { Router } from 'express';
import { listRoomsHandler } from './list-rooms';
import { getRoomHandler } from './get-room';
import { validationMiddleware } from '../../middleware/validation';
import { logger } from '../../utils/logger';

const router = Router();

router.get('/', listRoomsHandler);

router.get('/:id', validationMiddleware('getRoom'), getRoomHandler);

router.get('/:id/amenities', validationMiddleware('getRoom'), async (req, res, next) => {
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

router.get('/:id/photos', validationMiddleware('getRoom'), async (req, res, next) => {
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
