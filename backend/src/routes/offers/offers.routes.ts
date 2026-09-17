// lapa-casa-hostel/backend/src/routes/offers/offers.routes.ts
//
// Rutas PÚBLICAS de ofertas de apartamentos.
// No requieren autenticación — se llaman desde el motor de reservas del guest.
//
// POST /api/v1/offers/validate  → valida un código de descuento
//   body: { code, apartmentId, checkIn }
//   200: { valid: true, discount_percent, label, offer_id }
//   400: { valid: false, message }

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';

const router = Router();

const ValidateOfferSchema = z.object({
  code: z.string().trim().min(1),
  apartmentId: z.string().trim().optional(),
  checkIn: z.string().trim().optional(),
});

/**
 * POST /offers/validate
 * Valida un código de oferta y devuelve el porcentaje de descuento si aplica.
 * Público — llamado desde el motor de reservas de apartamentos.
 */
router.post('/validate', validate(ValidateOfferSchema), async (req, res, next) => {
  try {
    const { code, apartmentId, checkIn } = req.body as z.infer<typeof ValidateOfferSchema>;

    const today = checkIn ?? new Date().toISOString().slice(0, 10);

    const { rows } = await query(
      `SELECT id, code, label, discount_percent, apartment_ids, valid_from, valid_to
       FROM apartment_offers
       WHERE code = $1
         AND is_active = true
         AND (valid_from IS NULL OR valid_from <= $2::date)
         AND (valid_to   IS NULL OR valid_to   >= $2::date)
       LIMIT 1`,
      [code.trim().toUpperCase(), today]
    );

    if (rows.length === 0) {
      res.status(200).json(ApiResponse.success({
        valid: false,
        message: 'Código inválido o expirado',
      }));
      return;
    }

    const offer = rows[0];

    // Verificar si el apartamento está incluido en la oferta
    // Si apartment_ids es null o vacío → aplica a todos
    if (apartmentId && offer.apartment_ids && offer.apartment_ids.length > 0) {
      if (!offer.apartment_ids.includes(apartmentId)) {
        res.status(200).json(ApiResponse.success({
          valid: false,
          message: 'Este código no aplica a este apartamento',
        }));
        return;
      }
    }

    res.status(200).json(ApiResponse.success({
      valid: true,
      offer_id: offer.id,
      code: offer.code,
      label: offer.label,
      discount_percent: offer.discount_percent,
    }));
  } catch (error) {
    next(error);
  }
});

export { router as offersRouter };
