//
// Chat del admin con los administradores de apartamentos. Montado bajo
// /admin/owner-messages (admin.routes.ts, con auth de admin ya aplicada).

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';

const router = Router();

const SendSchema = z.object({ body: z.string().trim().min(1).max(2000) });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /admin/owner-messages — una fila por owner: último mensaje y no leídos.
// Primero los que tienen mensajes sin leer, después por actividad reciente.
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.id, o.full_name, o.email, o.is_active,
              lm.body AS last_body, lm.sender AS last_sender, lm.created_at AS last_at,
              COALESCE(u.n, 0)::int AS unread
       FROM apartment_owners o
       LEFT JOIN LATERAL (
         SELECT body, sender, created_at FROM owner_messages m
         WHERE m.owner_id = o.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS n FROM owner_messages m
         WHERE m.owner_id = o.id AND m.sender = 'owner' AND m.read_at IS NULL
       ) u ON true
       ORDER BY (COALESCE(u.n, 0) > 0) DESC, lm.created_at DESC NULLS LAST, o.full_name ASC`,
    );
    res.status(200).json(
      ApiResponse.success({
        conversations: rows.map((r: any) => ({
          ownerId: r.id,
          fullName: r.full_name,
          email: r.email,
          isActive: r.is_active,
          lastBody: r.last_body,
          lastSender: r.last_sender,
          lastAt: r.last_at,
          unread: r.unread,
        })),
      }),
    );
  } catch (error) {
    next(error);
  }
});

// GET /admin/owner-messages/unread-count — total para el badge del menú
router.get('/unread-count', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM owner_messages WHERE sender = 'owner' AND read_at IS NULL`,
    );
    res.status(200).json(ApiResponse.success({ unread: rows[0]?.n ?? 0 }));
  } catch (error) {
    next(error);
  }
});

// GET /admin/owner-messages/:ownerId — hilo; marca como leídos los del owner
router.get('/:ownerId', async (req, res, next) => {
  try {
    const { ownerId } = req.params;
    if (!ownerId || !UUID_RE.test(ownerId)) {
      res.status(400).json(ApiResponse.error('ownerId inválido'));
      return;
    }
    const { rows } = await query(
      `SELECT id, sender, body, created_at, read_at
       FROM (
         SELECT id, sender, body, created_at, read_at
         FROM owner_messages WHERE owner_id = $1
         ORDER BY created_at DESC LIMIT 200
       ) t ORDER BY created_at ASC`,
      [ownerId],
    );
    await query(
      `UPDATE owner_messages SET read_at = now()
       WHERE owner_id = $1 AND sender = 'owner' AND read_at IS NULL`,
      [ownerId],
    );
    res.status(200).json(ApiResponse.success({ messages: rows }));
  } catch (error) {
    next(error);
  }
});

// POST /admin/owner-messages/:ownerId
router.post('/:ownerId', validate(SendSchema), async (req, res, next) => {
  try {
    const { ownerId } = req.params;
    if (!ownerId || !UUID_RE.test(ownerId)) {
      res.status(400).json(ApiResponse.error('ownerId inválido'));
      return;
    }
    const { rows: owners } = await query(`SELECT id FROM apartment_owners WHERE id = $1`, [ownerId]);
    if (owners.length === 0) {
      res.status(404).json(ApiResponse.error('Administrador no encontrado'));
      return;
    }
    const { body } = req.body as z.infer<typeof SendSchema>;
    const { rows } = await query(
      `INSERT INTO owner_messages (owner_id, sender, body) VALUES ($1, 'admin', $2)
       RETURNING id, sender, body, created_at, read_at`,
      [ownerId, body],
    );
    res.status(201).json(ApiResponse.success(rows[0], 'Mensaje enviado'));
  } catch (error) {
    next(error);
  }
});

export const adminOwnerMessagesRouter = router;
