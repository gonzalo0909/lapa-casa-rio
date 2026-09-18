//
// Aceite del Termo de Adesão por el administrador de apartamento.
// POST /owner/accept-terms guarda timestamp + IP + versión del término.
// El frontend lo llama desde /owner/accept-terms después de que el
// administrador lee el contrato completo y hace click en "Aceitar".
//
// El acceso al resto del panel (GET /owner/me, /owner/apartments, etc.)
// no está bloqueado aquí en el backend — el bloqueo es en el frontend
// (use-owner-auth.ts redirige si termAcceptedAt === null). El campo sí
// se expone en GET /owner/me para que el frontend tome esa decisión.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';
import { logger } from '../../utils/logger';

// Versión actual del término. Incrementar cuando se publique una nueva versión
// del Termo de Adesão para que quede registro de qué versión aceptó cada owner.
export const CURRENT_TERM_VERSION = '2.1';

const AcceptTermsSchema = z.object({
  version: z.string().min(1),
});

const router = Router();

// ─── POST /owner/accept-terms ─────────────────────────────────────────────────

router.post('/', validate(AcceptTermsSchema), async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    if (!ownerId) {
      res.status(401).json(ApiResponse.error('Access token required'));
      return;
    }

    const { version } = req.body as z.infer<typeof AcceptTermsSchema>;

    // Solo aceptar la versión actual del término para evitar que el frontend
    // mande una versión arbitraria
    if (version !== CURRENT_TERM_VERSION) {
      res.status(400).json(
        ApiResponse.error(`Versão do termo inválida. Versão esperada: ${CURRENT_TERM_VERSION}`)
      );
      return;
    }

    // IP real detrás de proxy/Fly.io (X-Forwarded-For) o la del socket
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    await prisma.apartmentOwner.update({
      where: { id: ownerId },
      data: {
        termAcceptedAt: new Date(),
        termAcceptedIp: ip,
        termVersion: version,
      },
    });

    logger.info('Administrador aceptou o Termo de Adesão', {
      ownerId,
      version,
      ip,
    });

    res.status(200).json(
      ApiResponse.success(
        { termAcceptedAt: new Date().toISOString(), termVersion: version },
        'Termo aceito com sucesso'
      )
    );
  } catch (error) {
    next(error);
  }
});

export const ownerTermsRouter = router;
