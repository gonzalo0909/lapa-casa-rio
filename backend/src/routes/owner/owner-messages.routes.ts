//
// Chat del administrador de apartamentos con la plataforma. Montado bajo
// /owner/messages (owner.routes.ts); el ownerId sale SIEMPRE del token, nunca
// del body/query. Un hilo por owner (tabla owner_messages, 0064).

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';

const router = Router();

const SendSchema = z.object({ body: z.string().trim().min(1).max(2000) });

// GET /owner/messages — hilo completo; marca como leídos los mensajes del admin
router.get('/', async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    if (!ownerId) {
      res.status(401).json(ApiResponse.error('Acesso não autorizado. Faça login novamente.'));
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
       WHERE owner_id = $1 AND sender = 'admin' AND read_at IS NULL`,
      [ownerId],
    );
    res.status(200).json(ApiResponse.success({ messages: rows }));
  } catch (error) {
    next(error);
  }
});

// GET /owner/messages/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    if (!ownerId) {
      res.status(401).json(ApiResponse.error('Acesso não autorizado. Faça login novamente.'));
      return;
    }
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM owner_messages
       WHERE owner_id = $1 AND sender = 'admin' AND read_at IS NULL`,
      [ownerId],
    );
    res.status(200).json(ApiResponse.success({ unread: rows[0]?.n ?? 0 }));
  } catch (error) {
    next(error);
  }
});

// POST /owner/messages
router.post('/', validate(SendSchema), async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    if (!ownerId) {
      res.status(401).json(ApiResponse.error('Acesso não autorizado. Faça login novamente.'));
      return;
    }
    const { body } = req.body as z.infer<typeof SendSchema>;
    const { rows } = await query(
      `INSERT INTO owner_messages (owner_id, sender, body) VALUES ($1, 'owner', $2)
       RETURNING id, sender, body, created_at, read_at`,
      [ownerId, body],
    );
    res.status(201).json(ApiResponse.success(rows[0], 'Mensagem enviada'));
  } catch (error) {
    next(error);
  }
});

export const ownerMessagesRouter = router;
