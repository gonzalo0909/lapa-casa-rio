//
// Bloqueo masivo de feriados: un click bloquea el feriado elegido en TODAS
// las habitaciones/apartamentos que apliquen, reusando room_blocks (0016)
// vía DateBlocker -- mismo mecanismo que el bloqueo manual (blocked-dates),
// pero aplicado en batch. Un conflicto con una reserva existente en una
// unidad no aborta el resto del batch, se reporta por habitación.

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { createDateBlocker } from '../../lib/ical/date-blocker';
import { getHolidayBlockPresets } from '../../utils/brazil-holidays';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';
import redisClient from '../../cache/redis-client';

const router = Router();
const dateBlocker = createDateBlocker();

/** GET /admin/holiday-blocks/presets?year=YYYY — feriados del año con rango ±7 días ya calculado */
router.get('/presets', async (req, res, next) => {
  try {
    const year = parseInt(String(req.query.year), 10) || new Date().getFullYear();
    res.status(200).json(ApiResponse.success({ presets: getHolidayBlockPresets(year) }));
  } catch (error) {
    next(error);
  }
});

const ApplySchema = z.object({
  name: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  propertyType: z.enum(['all', 'hostel', 'apartment']).default('all'),
  notes: z.string().optional(),
});

/** POST /admin/holiday-blocks/apply — bloquea el rango dado en todas las unidades del tipo elegido */
router.post('/apply', validate(ApplySchema), async (req, res, next) => {
  try {
    const { name, startDate, endDate, propertyType, notes } =
      req.body as z.infer<typeof ApplySchema>;

    const params: any[] = [];
    let sql = `SELECT id, name FROM room_types`;
    if (propertyType !== 'all') {
      params.push(propertyType);
      sql += ` WHERE property_type = $1`;
    }
    sql += ' ORDER BY name';
    const { rows: roomTypes } = await query<{ id: string; name: string }>(sql, params);

    const results: Array<{ roomTypeId: string; roomName: string; status: 'blocked' | 'conflict'; error?: string }> = [];

    for (const rt of roomTypes) {
      try {
        const blockId = await dateBlocker.blockDates({
          roomId: rt.id,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          blockType: 'seasonal',
          reason: name,
          notes,
        });
        results.push({ roomTypeId: rt.id, roomName: rt.name, status: 'blocked' });
        await auditLogService.log({
          entity_type: 'room_block',
          entity_id: blockId,
          operation: 'ADMIN_UPDATE_SETTINGS',
          new_data: { roomTypeId: rt.id, startDate, endDate, reason: name, holidayBulk: true },
        });
      } catch (err: any) {
        results.push({ roomTypeId: rt.id, roomName: rt.name, status: 'conflict', error: err.message });
      }
    }

    redisClient.invalidateCache('availability:*').catch(() => {});

    const blockedCount = results.filter((r) => r.status === 'blocked').length;
    res.status(201).json(
      ApiResponse.success(
        { results, blockedCount, conflictCount: results.length - blockedCount },
        `${blockedCount} habitación(es) bloqueada(s) para ${name}`
      )
    );
  } catch (error) {
    next(error);
  }
});

const RemoveSchema = z.object({
  name: z.string().trim().min(1),
  propertyType: z.enum(['all', 'hostel', 'apartment']).default('all'),
});

/** POST /admin/holiday-blocks/remove — el "desbloquear todo": saca el bloqueo
 *  del feriado elegido de todas las unidades del tipo elegido (busca por
 *  reason exacto, el mismo texto que graba /apply y las migraciones de
 *  siembra por default). */
router.post('/remove', validate(RemoveSchema), async (req, res, next) => {
  try {
    const { name, propertyType } = req.body as z.infer<typeof RemoveSchema>;

    const params: any[] = [name];
    let sql = `
      DELETE FROM room_blocks rb
      USING room_types rt
      WHERE rb.room_type_id = rt.id AND rb.reason = $1`;
    if (propertyType !== 'all') {
      params.push(propertyType);
      sql += ` AND rt.property_type = $2`;
    }
    sql += ` RETURNING rb.id`;

    const { rows } = await query(sql, params);

    if (rows.length > 0) {
      await auditLogService.log({
        entity_type: 'room_block',
        entity_id: rows[0].id,
        operation: 'ADMIN_DELETE',
        new_data: { reason: name, propertyType, count: rows.length },
      });
    }

    redisClient.invalidateCache('availability:*').catch(() => {});
    res.status(200).json(
      ApiResponse.success({ removedCount: rows.length }, `${rows.length} bloqueo(s) removido(s) de ${name}`)
    );
  } catch (error) {
    next(error);
  }
});

export { router as adminHolidayBlocksRouter };
