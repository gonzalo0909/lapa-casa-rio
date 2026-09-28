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
  specialPrice: z.number().positive().nullable().optional(),
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
             rb.block_type AS "blockType", rb.reason, rb.notes, rb.special_price AS "specialPrice"
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
    const { roomTypeId, startDate, endDate, blockType, reason, notes, specialPrice } =
      req.body as z.infer<typeof BlockDatesSchema>;

    const blockId = await dateBlocker.blockDates({
      roomId: roomTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      notes,
      blockType: blockType ?? 'other',
      specialPrice
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

const UpdateBlockSchema = z.object({
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  blockType: z.enum(['maintenance', 'owner', 'seasonal', 'other']).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  specialPrice: z.number().positive().nullable().optional(),
});

/** PUT /admin/blocked-dates/:id — edita fechas/motivo de un bloqueo existente
 *  (misma habitación; para cambiar de habitación hay que borrar y crear uno nuevo) */
router.put('/:id', validate(UpdateBlockSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, blockType, reason, notes, specialPrice } =
      req.body as z.infer<typeof UpdateBlockSchema>;

    const { rows: existing } = await query<{ room_type_id: string }>(
      `SELECT room_type_id FROM room_blocks WHERE id = $1`,
      [id]
    );
    if (existing.length === 0) {
      res.status(404).json(ApiResponse.error('Bloqueo no encontrado'));
      return;
    }
    const roomTypeId = existing[0].room_type_id;

    // Mismo criterio de conflicto que al crear: no permitir un rango que
    // pise una reserva real confirmada/pendiente.
    const { rows: conflicts } = await query(
      `SELECT g.full_name AS guest_name, rb.check_in::text, rb.check_out::text
       FROM reservations r
       JOIN guests g ON g.id = r.guest_id
       JOIN reservation_beds rb ON rb.reservation_id = r.id
       JOIN beds b ON b.id = rb.bed_id
       WHERE b.room_type_id = $1 AND r.status IN ('confirmed', 'pending_payment')
         AND rb.check_in < $3 AND rb.check_out > $2`,
      [roomTypeId, startDate, endDate]
    );
    if (conflicts.length > 0) {
      res.status(409).json(
        ApiResponse.error(`No se puede editar: hay ${conflicts.length} reserva(s) confirmada(s) en ese rango de fechas`)
      );
      return;
    }

    const { rows } = await query(
      `UPDATE room_blocks
       SET start_date = $1, end_date = $2, block_type = $3, reason = $4, notes = $5, special_price = $6, updated_at = now()
       WHERE id = $7
       RETURNING id, room_type_id AS "roomTypeId", start_date::text AS "startDate",
                 end_date::text AS "endDate", block_type AS "blockType", reason, notes, special_price AS "specialPrice"`,
      [startDate, endDate, blockType ?? 'other', reason ?? null, notes ?? null, specialPrice ?? null, id]
    );

    await auditLogService.log({
      entity_type: 'room_block',
      entity_id: id,
      operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: { startDate, endDate, reason }
    });

    redisClient.invalidateCache('availability:*').catch(() => {});
    res.status(200).json(ApiResponse.success(rows[0], 'Bloqueo actualizado'));
  } catch (error: any) {
    if (error?.code === '23514') {
      res.status(400).json(ApiResponse.error('La fecha de fin debe ser posterior a la de inicio'));
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
