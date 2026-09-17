// lapa-casa-hostel/backend/src/routes/partners/partners.routes.ts
//
// FIX (auditoría 2026-08-30): el formulario de contacto de
// frontend/src/components/partners/partner-contract-page.tsx mostraba
// "Mensagem enviada!" sin enviar nada -- tenía un TODO explícito
// ("connect to real endpoint once backend route exists") y un
// setTimeout simulando la llamada. Esta es esa ruta real.
//
// POST /api/v1/partners/contact — público, sin autenticación (lo llama
// cualquier administrador de propiedad interesado, antes de tener
// cuenta). Envía un email al admin vía emailService.sendAdminAlert(),
// el mismo mecanismo ya usado para otras alertas internas.

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validation';
import { rateLimiter } from '../../middleware/rate-limiter';
import { emailService } from '../../services/email-service';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const router = Router();

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(50).optional(),
  property: z.string().trim().min(1).max(300),
  message: z.string().trim().max(2000).optional(),
});

/**
 * POST /partners/contact
 * Formulario de contacto de la página pública de partners (administradores
 * de apartamentos interesados en asociarse). Rate limit estricto: es un
 * endpoint público sin login, potencial blanco de spam.
 */
router.post(
  '/contact',
  rateLimiter({ max: 5, windowMs: 60 * 60 * 1000, prefix: 'partners-contact' }),
  validate(ContactSchema),
  async (req, res, next) => {
    try {
      const { name, email, phone, property, message } = req.body as z.infer<typeof ContactSchema>;

      await emailService.sendAdminAlert('Novo contato de parceiro (administrador de propriedade)', {
        Nome: name,
        Email: email,
        Telefone: phone || 'não informado',
        Propriedade: property,
        Mensagem: message || '—',
      });

      res.status(200).json(ApiResponse.success({ sent: true }, 'Mensagem enviada'));
    } catch (error) {
      logger.error('Error al enviar contacto de partner', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  }
);

export const partnersRouter = router;
export default router;
