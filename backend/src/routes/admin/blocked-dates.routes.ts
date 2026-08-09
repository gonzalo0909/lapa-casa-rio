// lapa-casa-hostel/backend/src/routes/admin/blocked-dates.routes.ts
//
// Bloqueo manual de fechas por habitación (mantenimiento/evento privado).
// Envuelve date-blocker.ts (ya corregido para usar room_types/room_blocks).
// Montado bajo /admin (routes/index.ts ya aplica authenticateToken +
// requireRole(['admin']) a todo ese prefijo).

import { Router } from 'express';
import { query } from '../../config/database';
import { createDateBlocker } from '../../lib/ical/date-blocker';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';

const router = Router();
const dateBlocker = createDateBlocker();

/** GET /admin/blocked-dates — todos los bloqueos, con nombre de habitación */
router.get('/', async (_req, res, next) => {
  try {
    const [blocks, roomTypes] = await Promise.all([
      dateBlocker.getAllBlockedDates(),
      query<{ id: string; name: string }>(`SELECT id, name FROM room_types`)
    ]);
    const roomNames = new Map(roomTypes.rows.map((r) => [r.id, r.name]));

    res.status(200).json(
      ApiResponse.success({
        blocks: blocks.map((b) => ({
          id: b.id,
          roomTypeId: b.roomId,
          roomName: roomNames.get(b.roomId) ?? 'Desconocido',
          startDate: b.startDate.toISOString().slice(0, 10),
          endDate: b.endDate.toISOString().slice(0, 10),
          blockType: b.blockType,
          reason: b.reason ?? null,
          notes: b.notes ?? null
        }))
      })
    );
  } catch (error) {
    next(error);
  }
});

/** POST /admin/blocked-dates — bloquea un rango de fechas para una habitación */
router.post('/', async (req, res, next) => {
  try {
    const { roomTypeId, startDate, endDate, blockType, reason, notes } = req.body as {
      roomTypeId?: string;
      startDate?: string;
      endDate?: string;
      blockType?: 'maintenance' | 'owner' | 'seasonal' | 'other';
      reason?: string;
      notes?: string;
    };

    if (!roomTypeId || !startDate || !endDate) {
      res.status(400).json(ApiResponse.error('roomTypeId, startDate y endDate son obligatorios'));
      return;
    }

    const blockId = await dateBlocker.blockDates({
      roomId: roomTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      notes,
      blockType: blockType ?? 'other'
    });

    await auditLogService.log({
      entity_type: 'room_block',
      entity_id: blockId,
      operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: { roomTypeId, startDate, endDate, reason }
    });

    res.status(201).json(ApiResponse.success({ id: blockId }, 'Fechas bloqueadas'));
  } catch (error: any) {
    if (
      error instanceof Error &&
      (error.message.startsWith('Cannot block dates') ||
        error.message.startsWith('Room not found') ||
        error.message.includes('date'))
    ) {
      res.status(400).json(ApiResponse.error(error.message));
      return;
    }
    next(error);
  }
});

/** DELETE /admin/blocked-dates/:id — quita un bloqueo */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await dateBlocker.unblockDates(id);
    await auditLogService.log({ entity_type: 'room_block', entity_id: id, operation: 'ADMIN_DELETE' });
    res.status(200).json(ApiResponse.success(null, 'Bloqueo eliminado'));
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Block not found')) {
      res.status(404).json(ApiResponse.error(error.message));
      return;
    }
    next(error);
  }
});

export { router as adminBlockedDatesRouter };
