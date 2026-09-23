//
// Bloqueo manual de fechas por habitación (mantenimiento/evento privado).
// Envuelve date-blocker.ts (ya corregido para usar room_types/room_blocks).
// Montado bajo /admin (routes/index.ts ya aplica authenticateToken +
// requireRole(['admin']) a todo ese prefijo).

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { createDateBlocker } from '../../lib/ical/date-blocker';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';
import redisClient from '../../cache/redis-client';

const router = Router();
const dateBlocker = createDateBlocker();

const BlockDatesSchema = z.object({
  roomTypeId: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  blockType: z.enum(['maintenance', 'owner', 'seasonal', 'other']).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

/** GET /admin/blocked-dates?propertyType=hostel|apartment — bloqueos, con nombre de habitación.
 *  Sin propertyType devuelve todos (uso interno); las pantallas de hostel y
 *  apartamentos ya mandan el filtro para no mezclar bloqueos de una unidad
 *  con los de la otra. */
router.get('/', async (req, res, next) => {
  try {
    const propertyType = req.query.propertyType;
    const params: string[] = [];
    let sql = `
      SELECT rb.id, rb.room_type_id AS "roomTypeId", rt.name AS "roomName",
             rb.start_date::text AS "startDate", rb.end_date::text AS "endDate",
             rb.block_type AS "blockType", rb.reason, rb.notes
      FROM room_blocks rb
      JOIN room_types rt ON rt.id = rb.room_type_id`;
    if (propertyType === 'hostel' || propertyType === 'apartment') {
      params.push(propertyType);
      sql += ` WHERE rt.property_type = $1`;
    }
    sql += ` ORDER BY rb.start_date`;

    const { rows } = await query(sql, params);
    res.status(200).json(ApiResponse.success({ blocks: rows }));
  } catch (error) {
    next(error);
  }
});

/** POST /admin/blocked-dates — bloquea un rango de fechas para una habitación */
router.post('/', validate(BlockDatesSchema), async (req, res, next) => {
  try {
    const { roomTypeId, startDate, endDate, blockType, reason, notes } =
      req.body as z.infer<typeof BlockDatesSchema>;

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

    redisClient.invalidateCache('availability:*').catch(() => {});
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
