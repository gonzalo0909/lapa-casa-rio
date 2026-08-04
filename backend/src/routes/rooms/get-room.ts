/**
 * File: lapa-casa-hostel/backend/src/routes/rooms/get-room.ts
 * Get Room Handler
 * Lapa Casa Hostel Channel Manager
 *
 * Delegado a room-service.ts (Ventana 2, entregable 5). Antes usaba
 * `getRoomConfig()` local con 4 habitaciones hardcodeadas e IDs
 * ficticios ("room_mixto_12a") -- nunca matcheaba un UUID real de
 * room_types, asi que GET /api/rooms/:id con un id real siempre daba
 * 404. Mismo bug de fondo que tenia list-rooms.ts antes de corregirse.
 *
 * @module routes/rooms/get
 * @requires express
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { roomService } from '../../services/room-service';

export const getRoomHandler = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Get room details', { roomId: id });

    const room = await roomService.getRoom(id);

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
