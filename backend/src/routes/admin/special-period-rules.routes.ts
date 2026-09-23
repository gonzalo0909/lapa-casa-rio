//
// Reglas de período especial (0045): para una habitación y un rango de
// fechas, exige un mínimo de noches y fija un precio por noche propio,
// en vez del precio de temporada normal. Se lee desde pricing-service.ts
// en cada cálculo de precio real (creación y edición de reserva), no es
// solo informativo. Separado a propósito de blocked-dates.routes.ts:
// bloquear (disponibilidad) y este período (precio + mínimo de noches,
// sigue disponible) son cosas distintas.

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';

const router = Router();

const RuleSchema = z.object({
  roomTypeId: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  minNights: z.number().int().positive(),
  pricePerNight: z.number().positive(),
  label: z.string().optional(),
});

/** GET /admin/special-period-rules?propertyType=hostel|apartment */
router.get('/', async (req, res, next) => {
  try {
    const propertyType = req.query.propertyType;
    const params: string[] = [];
    let sql = `
      SELECT spr.id, spr.room_type_id AS "roomTypeId", rt.name AS "roomName",
             spr.start_date::text AS "startDate", spr.end_date::text AS "endDate",
             spr.min_nights AS "minNights", spr.price_per_night AS "pricePerNight", spr.label
      FROM special_period_rules spr
      JOIN room_types rt ON rt.id = spr.room_type_id`;
    if (propertyType === 'hostel' || propertyType === 'apartment') {
      params.push(propertyType);
      sql += ` WHERE rt.property_type = $1`;
    }
    sql += ` ORDER BY spr.start_date`;

    const { rows } = await query(sql, params);
    res.status(200).json(ApiResponse.success({ rules: rows }));
  } catch (error) {
    next(error);
  }
});

/** POST /admin/special-period-rules */
router.post('/', validate(RuleSchema), async (req, res, next) => {
  try {
    const { roomTypeId, startDate, endDate, minNights, pricePerNight, label } =
      req.body as z.infer<typeof RuleSchema>;

    const { rows } = await query(
      `INSERT INTO special_period_rules (room_type_id, start_date, end_date, min_nights, price_per_night, label)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, room_type_id AS "roomTypeId", start_date::text AS "startDate",
                 end_date::text AS "endDate", min_nights AS "minNights", price_per_night AS "pricePerNight", label`,
      [roomTypeId, startDate, endDate, minNights, pricePerNight, label ?? null]
    );

    await auditLogService.log({
      entity_type: 'special_period_rule',
      entity_id: rows[0].id,
      operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: { roomTypeId, startDate, endDate, minNights, pricePerNight, label }
    });

    res.status(201).json(ApiResponse.success(rows[0], 'Regla creada'));
  } catch (error: any) {
    if (error?.code === '23514') {
      res.status(400).json(ApiResponse.error('Fechas, noches mínimas o precio inválidos'));
      return;
    }
    next(error);
  }
});

/** PUT /admin/special-period-rules/:id */
router.put('/:id', validate(RuleSchema.omit({ roomTypeId: true })), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, minNights, pricePerNight, label } =
      req.body as Omit<z.infer<typeof RuleSchema>, 'roomTypeId'>;

    const { rows } = await query(
      `UPDATE special_period_rules
       SET start_date = $1, end_date = $2, min_nights = $3, price_per_night = $4, label = $5, updated_at = now()
       WHERE id = $6
       RETURNING id, room_type_id AS "roomTypeId", start_date::text AS "startDate",
                 end_date::text AS "endDate", min_nights AS "minNights", price_per_night AS "pricePerNight", label`,
      [startDate, endDate, minNights, pricePerNight, label ?? null, id]
    );

    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Regla no encontrada'));
      return;
    }

    await auditLogService.log({
      entity_type: 'special_period_rule',
      entity_id: id,
      operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: { startDate, endDate, minNights, pricePerNight, label }
    });

    res.status(200).json(ApiResponse.success(rows[0], 'Regla actualizada'));
  } catch (error: any) {
    if (error?.code === '23514') {
      res.status(400).json(ApiResponse.error('Fechas, noches mínimas o precio inválidos'));
      return;
    }
    next(error);
  }
});

/** DELETE /admin/special-period-rules/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await query(`DELETE FROM special_period_rules WHERE id = $1`, [id]);
    if (rowCount === 0) {
      res.status(404).json(ApiResponse.error('Regla no encontrada'));
      return;
    }
    await auditLogService.log({ entity_type: 'special_period_rule', entity_id: id, operation: 'ADMIN_DELETE' });
    res.status(200).json(ApiResponse.success(null, 'Regla eliminada'));
  } catch (error) {
    next(error);
  }
});

export { router as adminSpecialPeriodRulesRouter };
