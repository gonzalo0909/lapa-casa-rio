// lapa-casa-hostel/backend/src/routes/admin/guests.routes.ts
//
// Gestión de huéspedes: listado, búsqueda, bloqueo y desbloqueo.
// Montado bajo /admin/guests (admin.routes.ts).

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';

const router = Router();

const BlockGuestSchema = z.object({
  reason: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /admin/guests
 * Listado paginado con búsqueda por nombre/email y filtro de bloqueados.
 * Query params: search, blocked (true|false|all), page, limit
 */
router.get('/', async (req, res, next) => {
  try {
    const { search, blocked, page, limit } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(g.full_name ILIKE $${params.length} OR g.email ILIKE $${params.length})`);
    }

    if (blocked === 'true') {
      conditions.push(`g.blocked = true`);
    } else if (blocked === 'false') {
      conditions.push(`g.blocked = false`);
    }
    // si blocked === 'all' o no se pasa, no filtramos

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const pageNum  = Math.max(1, parseInt(page  || '1',  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50));
    const offset   = (pageNum - 1) * limitNum;

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT g.id, g.full_name, g.email, g.phone, g.country,
                g.blocked, g.blocked_at, g.blocked_reason, g.block_notes,
                g.created_at,
                COUNT(r.id)::int AS reservation_count
         FROM guests g
         LEFT JOIN reservations r ON r.guest_id = g.id
         ${where}
         GROUP BY g.id
         ORDER BY g.blocked DESC, g.full_name ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM guests g ${where}`,
        params
      ),
    ]);

    res.json(ApiResponse.success({
      guests: dataResult.rows,
      pagination: { page: pageNum, limit: limitNum, total: countResult.rows[0]!.total },
    }));
  } catch (err) { next(err); }
});

/**
 * GET /admin/guests/document-photos
 * Fotos de documento (DNI/pasaporte) subidas automáticamente por los
 * huéspedes al reservar (guests.document_photo_url, ver migración
 * 0029_guest_document_photo.sql) -- reemplaza el flujo manual que existía
 * antes acá, en el que el admin subía fotos a mano. El admin solo mira,
 * nunca sube nada en esta pantalla.
 * Query params: page, limit
 */
router.get('/document-photos', async (req, res, next) => {
  try {
    const { page, limit } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, parseInt(page  || '1',  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50));
    const offset   = (pageNum - 1) * limitNum;

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT g.id, g.full_name, g.email, g.country,
                g.document_photo_url, g.document_photo_uploaded_at,
                r.reservation_number, r.check_in_date, r.check_out_date
         FROM guests g
         LEFT JOIN LATERAL (
           SELECT reservation_number, check_in_date, check_out_date
           FROM reservations
           WHERE guest_id = g.id
           ORDER BY created_at DESC
           LIMIT 1
         ) r ON true
         WHERE g.document_photo_url IS NOT NULL
         ORDER BY g.document_photo_uploaded_at DESC NULLS LAST
         LIMIT $1 OFFSET $2`,
        [limitNum, offset]
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM guests WHERE document_photo_url IS NOT NULL`
      ),
    ]);

    res.json(ApiResponse.success({
      guests: dataResult.rows,
      pagination: { page: pageNum, limit: limitNum, total: countResult.rows[0]!.total },
    }));
  } catch (err) { next(err); }
});

/**
 * PATCH /admin/guests/:id/block
 * Body: { reason, notes }
 */
router.patch('/:id/block', validate(BlockGuestSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body as z.infer<typeof BlockGuestSchema>;

    const { rows } = await query(
      `UPDATE guests
       SET blocked = true,
           blocked_at = now(),
           blocked_reason = $2,
           block_notes = $3,
           updated_at = now()
       WHERE id = $1
       RETURNING id, full_name, email, blocked, blocked_at, blocked_reason, block_notes`,
      [id, reason?.trim() || null, notes?.trim() || null]
    );

    if (!rows.length) {
      res.status(404).json(ApiResponse.error('Huesped no encontrado'));
      return;
    }

    await auditLogService.log({
      entity_type: 'guest', entity_id: id, operation: 'ADMIN_BLOCK_GUEST',
      new_data: { blocked: true, reason, notes }
    });

    res.json(ApiResponse.success(rows[0], 'Huesped bloqueado'));
  } catch (err) { next(err); }
});

/**
 * PATCH /admin/guests/:id/unblock
 */
router.patch('/:id/unblock', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `UPDATE guests
       SET blocked = false,
           blocked_at = null,
           blocked_reason = null,
           block_notes = null,
           updated_at = now()
       WHERE id = $1
       RETURNING id, full_name, email, blocked`,
      [id]
    );

    if (!rows.length) {
      res.status(404).json(ApiResponse.error('Huesped no encontrado'));
      return;
    }

    await auditLogService.log({
      entity_type: 'guest', entity_id: id, operation: 'ADMIN_UNBLOCK_GUEST',
      new_data: { blocked: false }
    });

    res.json(ApiResponse.success(rows[0], 'Huesped desbloqueado'));
  } catch (err) { next(err); }
});

export { router as guestsRouter };
