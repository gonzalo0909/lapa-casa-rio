// lapa-casa-hostel/backend/src/routes/owner/owner-apartments.routes.ts
//
// Panel de administrador de apartamento: cada uno ve y edita solo sus
// propios apartamentos (room_types.owner_id = req.user.ownerId), nunca
// los de otro administrador. Montado bajo /owner (authenticateOwnerToken
// ya aplicado en routes/index.ts).
//
// Mismo split que el resto del backend: room_types/room_type_photos/
// apartment_reviews/room_blocks/dynamic_pricing_unit_config son tablas
// que ya usa el admin único vía SQL crudo (admin.routes.ts,
// room-type-photos.routes.ts, dynamic-pricing-service.ts) -- estas rutas
// reusan esas mismas queries/servicios con un filtro de propiedad
// encima, en vez de abrir un segundo camino con Prisma sobre las mismas
// tablas.
//
// Pendiente (no incluido acá): apartment_offers (una oferta puede cruzar
// apartamentos de más de un administrador -- necesita una decisión de
// producto antes de dejar que cada uno cree las suyas) y guest_reports
// (reportar un huésped problemático -- requiere validar que la reserva
// reportada sea de un apartamento del administrador).

import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query } from '../../config/database';
import { uploadApartmentPhoto, deleteApartmentPhoto } from '../../lib/cloudinary/cloudinary-client';
import { dynamicPricingService } from '../../services/dynamic-pricing-service';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';
import { ownsRoomType, ownsRoomTypeOf } from './owner-scope';

const router = Router();

function getOwnerId(req: Request): string | null {
  return req.user?.ownerId ?? null;
}

// Todas las rutas de este router requieren ownerId -- una sola guarda acá
// en vez de repetirla en cada handler.
router.use((req, res, next) => {
  if (!getOwnerId(req)) {
    res.status(401).json(ApiResponse.error('Access token required'));
    return;
  }
  next();
});

// Rutas con :id -- confirma que el apartamento sea del dueño antes de
// llegar al handler. Las rutas con :photoId/:reviewId/:blockId hacen su
// propio chequeo más abajo (no son room_type_id directamente).
router.param('id', async (req, res, next, id) => {
  try {
    const ownerId = getOwnerId(req)!;
    if (!(await ownsRoomType(ownerId, id))) {
      res.status(404).json(ApiResponse.error('Apartamento no encontrado'));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
});

const UpdateApartmentSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    neighborhood: z.string().optional(),
    bedrooms: z.number().int().nullable().optional(),
    bathrooms: z.number().int().nullable().optional(),
    amenities: z.any().optional(),
    address: z.string().optional(),
    address_number: z.string().max(20).optional(),
    cep: z.string().max(9).optional(),
    // Precio base editable por el administrador: entra en el cálculo de
    // precio de las reservas. Se acepta solo valores positivos.
    base_price: z.number().positive().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Nada para actualizar',
  });

const UploadPhotoSchema = z.object({ altText: z.string().optional() });

const PatchPhotoSchema = z
  .object({
    isPrimary: z.boolean().optional(),
    altText: z.string().optional(),
    displayOrder: z.number().int().optional(),
  })
  .refine(
    (v) => v.isPrimary !== undefined || v.altText !== undefined || v.displayOrder !== undefined,
    {
      message: 'Nada para actualizar',
    },
  );

const CreateReviewSchema = z.object({
  author_name: z.string().trim().min(1),
  platform: z.string().optional(),
  rating: z.number().min(1).max(5),
  comment: z.string().trim().min(1),
  review_date: z.string().optional(),
  is_published: z.boolean().optional(),
});

const UpdateReviewSchema = CreateReviewSchema.partial().refine(
  (v) => Object.values(v).some((x) => x !== undefined),
  { message: 'Nada para actualizar' },
);

const CreateBlockSchema = z.object({
  start_date: z.string().trim().min(1),
  end_date: z.string().trim().min(1),
  block_type: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const UnitConfigSchema = z.object({
  min_price_brl: z.number().nullable().optional(),
  max_price_brl: z.number().nullable().optional(),
  bot_enabled: z.boolean().optional(),
  notes: z.string().optional(),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Solo se aceptan archivos de imagen'));
      return;
    }
    cb(null, true);
  },
});

// ─── GET /owner/apartments — lista los apartamentos del dueño logueado ───────

router.get('/', async (req, res, next) => {
  try {
    const ownerId = getOwnerId(req)!;
    const { rows } = await query(
      `SELECT id, code, name, capacity, base_price, description, neighborhood,
              bedrooms, bathrooms, amenities, external_rating, external_review_count,
              external_rating_label, address, address_number, cep
       FROM room_types
       WHERE owner_id = $1
       ORDER BY name ASC`,
      [ownerId],
    );
    res.status(200).json(ApiResponse.success({ apartments: rows }));
  } catch (error) {
    next(error);
  }
});

// ─── GET /owner/apartments/:id ────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, code, name, capacity, base_price, description, neighborhood,
              bedrooms, bathrooms, amenities, external_rating, external_review_count,
              external_rating_label, address, address_number, cep
       FROM room_types WHERE id = $1`,
      [req.params.id],
    );
    res.status(200).json(ApiResponse.success(rows[0]));
  } catch (error) {
    next(error);
  }
});

// ─── PUT /owner/apartments/:id — solo campos editoriales ─────────────────────
// base_price y external_rating* quedan afuera a propósito: el primero
// entra directo en el cálculo de precio de una reserva real, el segundo
// se supone que refleja una puntuación verificada de Airbnb/Booking, no
// autodeclarada.

router.put('/:id', validate(UpdateApartmentSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, neighborhood, bedrooms, bathrooms, amenities, address, address_number, cep, base_price } = req.body as z.infer<
      typeof UpdateApartmentSchema
    >;

    const sets: string[] = [];
    const params: any[] = [];
    const p = () => `$${params.length}`;
    if (name !== undefined) {
      params.push(name.trim());
      sets.push(`name = ${p()}`);
    }
    if (description !== undefined) {
      params.push(description);
      sets.push(`description = ${p()}`);
    }
    if (neighborhood !== undefined) {
      params.push(neighborhood);
      sets.push(`neighborhood = ${p()}`);
    }
    if (bedrooms !== undefined) {
      params.push(bedrooms);
      sets.push(`bedrooms = ${p()}`);
    }
    if (bathrooms !== undefined) {
      params.push(bathrooms);
      sets.push(`bathrooms = ${p()}`);
    }
    if (amenities !== undefined) {
      params.push(JSON.stringify(amenities));
      sets.push(`amenities = ${p()}::jsonb`);
    }
    if (address !== undefined) {
      params.push(address || null);
      sets.push(`address = ${p()}`);
    }
    if (address_number !== undefined) {
      params.push(address_number || null);
      sets.push(`address_number = ${p()}`);
    }
    if (cep !== undefined) {
      params.push(cep || null);
      sets.push(`cep = ${p()}`);
    }
    if (base_price !== undefined) {
      params.push(base_price);
      sets.push(`base_price = ${p()}`);
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE room_types SET ${sets.join(', ')}, updated_at = now()
       WHERE id = ${p()}
       RETURNING id, code, name, description, neighborhood, bedrooms, bathrooms, amenities,
                 address, address_number, cep, base_price`,
      params,
    );

    await auditLogService.log({
      entity_type: 'room_type',
      entity_id: id,
      operation: 'OWNER_UPDATE_APARTMENT',
      new_data: req.body,
    });

    res.status(200).json(ApiResponse.success(rows[0], 'Apartamento actualizado'));
  } catch (error) {
    next(error);
  }
});

// ─── Fotos ────────────────────────────────────────────────────────────────────

router.get('/:id/photos', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, image_url, display_order, is_primary, alt_text, created_at
       FROM room_type_photos WHERE room_type_id = $1
       ORDER BY display_order ASC, created_at ASC`,
      [req.params.id],
    );
    res.status(200).json(ApiResponse.success({ photos: rows }));
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/photos',
  upload.single('photo'),
  validate(UploadPhotoSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!req.file) {
        res.status(400).json(ApiResponse.error('Falta el archivo de imagen (campo "photo")'));
        return;
      }
      const { altText } = req.body as z.infer<typeof UploadPhotoSchema>;

      const { rows: existing } = await query(
        `SELECT COUNT(*)::int AS total FROM room_type_photos WHERE room_type_id = $1`,
        [id],
      );
      const isPrimary = existing[0]!.total === 0;
      const displayOrder = existing[0]!.total;

      let uploaded: { url: string; publicId: string };
      try {
        uploaded = await uploadApartmentPhoto(req.file.buffer);
      } catch (uploadErr: any) {
        // Devolver el motivo real al cliente (evita que se enmascare como
        // "An unexpected error occurred" por el error handler de producción).
        // Se sanitiza: solo se expone el mensaje de la librería, no el stack.
        const msg: string = uploadErr?.message || 'Error al subir la foto. Inténtelo de nuevo.';
        res.status(422).json(ApiResponse.error(msg));
        return;
      }

      const { rows } = await query(
        `INSERT INTO room_type_photos
         (room_type_id, image_url, cloudinary_public_id, display_order, is_primary, alt_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, image_url, display_order, is_primary, alt_text, created_at`,
        [id, uploaded.url, uploaded.publicId, displayOrder, isPrimary, altText ?? null],
      );

      res.status(201).json(ApiResponse.success({ photo: rows[0] }, 'Foto subida'));
    } catch (error) {
      next(error);
    }
  },
);

router.patch('/photos/:photoId', validate(PatchPhotoSchema), async (req, res, next) => {
  try {
    const ownerId = getOwnerId(req)!;
    const { photoId } = req.params;
    const roomTypeId = await ownsRoomTypeOf('room_type_photos', photoId, ownerId);
    if (!roomTypeId) {
      res.status(404).json(ApiResponse.error('Foto no encontrada'));
      return;
    }

    const { isPrimary, altText, displayOrder } = req.body as z.infer<typeof PatchPhotoSchema>;

    if (isPrimary === true) {
      await query(
        `UPDATE room_type_photos SET is_primary = false, updated_at = now()
         WHERE room_type_id = $1 AND is_primary = true`,
        [roomTypeId],
      );
    }

    const sets: string[] = [];
    const params: any[] = [];
    if (isPrimary !== undefined) {
      params.push(isPrimary);
      sets.push(`is_primary = $${params.length}`);
    }
    if (altText !== undefined) {
      params.push(altText || null);
      sets.push(`alt_text = $${params.length}`);
    }
    if (displayOrder !== undefined) {
      params.push(displayOrder);
      sets.push(`display_order = $${params.length}`);
    }

    params.push(photoId);
    const { rows } = await query(
      `UPDATE room_type_photos SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING id, image_url, display_order, is_primary, alt_text`,
      params,
    );

    res.status(200).json(ApiResponse.success({ photo: rows[0] }, 'Foto actualizada'));
  } catch (error) {
    next(error);
  }
});

router.delete('/photos/:photoId', async (req, res, next) => {
  try {
    const ownerId = getOwnerId(req)!;
    const { photoId } = req.params;
    const roomTypeId = await ownsRoomTypeOf('room_type_photos', photoId, ownerId);
    if (!roomTypeId) {
      res.status(404).json(ApiResponse.error('Foto no encontrada'));
      return;
    }

    const { rows } = await query(
      `SELECT cloudinary_public_id, is_primary FROM room_type_photos WHERE id = $1`,
      [photoId],
    );
    const photo = rows[0]!;

    await deleteApartmentPhoto(photo.cloudinary_public_id).catch(() => {
      // si Cloudinary falla, se borra el registro igual
    });
    await query(`DELETE FROM room_type_photos WHERE id = $1`, [photoId]);

    if (photo.is_primary) {
      await query(
        `UPDATE room_type_photos SET is_primary = true, updated_at = now()
         WHERE id = (
           SELECT id FROM room_type_photos
           WHERE room_type_id = $1
           ORDER BY display_order ASC, created_at ASC
           LIMIT 1
         )`,
        [roomTypeId],
      );
    }

    res.status(200).json(ApiResponse.success(null, 'Foto eliminada'));
  } catch (error) {
    next(error);
  }
});

// ─── Reseñas ──────────────────────────────────────────────────────────────────

router.get('/:id/reviews', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, author_name, platform, rating, comment,
              review_date::text, is_published, created_at
       FROM apartment_reviews WHERE room_type_id = $1
       ORDER BY review_date DESC, created_at DESC`,
      [req.params.id],
    );
    res.status(200).json(ApiResponse.success(rows));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reviews', validate(CreateReviewSchema), async (req, res, next) => {
  try {
    const { author_name, platform, rating, comment, review_date, is_published } =
      req.body as z.infer<typeof CreateReviewSchema>;
    const { rows } = await query(
      `INSERT INTO apartment_reviews
         (room_type_id, author_name, platform, rating, comment, review_date, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, author_name, platform, rating, comment,
                 review_date::text, is_published, created_at`,
      [
        req.params.id,
        author_name.trim(),
        platform || 'Admin',
        rating,
        comment.trim(),
        review_date || new Date().toISOString().slice(0, 10),
        is_published ?? true,
      ],
    );
    res.status(201).json(ApiResponse.success(rows[0], 'Reseña creada'));
  } catch (error) {
    next(error);
  }
});

router.put('/reviews/:reviewId', validate(UpdateReviewSchema), async (req, res, next) => {
  try {
    const ownerId = getOwnerId(req)!;
    const { reviewId } = req.params;
    if (!(await ownsRoomTypeOf('apartment_reviews', reviewId, ownerId))) {
      res.status(404).json(ApiResponse.error('Reseña no encontrada'));
      return;
    }

    const { author_name, platform, rating, comment, review_date, is_published } =
      req.body as z.infer<typeof UpdateReviewSchema>;
    const sets: string[] = [];
    const params: any[] = [];
    const p = () => `$${params.length}`;
    if (author_name !== undefined) {
      params.push(author_name.trim());
      sets.push(`author_name = ${p()}`);
    }
    if (platform !== undefined) {
      params.push(platform || 'Admin');
      sets.push(`platform = ${p()}`);
    }
    if (rating !== undefined) {
      params.push(rating);
      sets.push(`rating = ${p()}`);
    }
    if (comment !== undefined) {
      params.push(comment.trim());
      sets.push(`comment = ${p()}`);
    }
    if (review_date !== undefined) {
      params.push(review_date || null);
      sets.push(`review_date = ${p()}`);
    }
    if (is_published !== undefined) {
      params.push(is_published);
      sets.push(`is_published = ${p()}`);
    }

    params.push(reviewId);
    const { rows } = await query(
      `UPDATE apartment_reviews SET ${sets.join(', ')}, updated_at = now()
       WHERE id = ${p()}
       RETURNING id, author_name, platform, rating, comment, review_date::text, is_published, created_at`,
      params,
    );
    res.status(200).json(ApiResponse.success(rows[0], 'Reseña actualizada'));
  } catch (error) {
    next(error);
  }
});

router.delete('/reviews/:reviewId', async (req, res, next) => {
  try {
    const ownerId = getOwnerId(req)!;
    const { reviewId } = req.params;
    if (!(await ownsRoomTypeOf('apartment_reviews', reviewId, ownerId))) {
      res.status(404).json(ApiResponse.error('Reseña no encontrada'));
      return;
    }
    await query(`DELETE FROM apartment_reviews WHERE id = $1`, [reviewId]);
    res.status(200).json(ApiResponse.success(null, 'Reseña eliminada'));
  } catch (error) {
    next(error);
  }
});

// ─── Bloqueos de fechas ─────────────────────────────────────────────────────

router.get('/:id/blocks', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, start_date::text, end_date::text, block_type, reason, notes, created_at
       FROM room_blocks WHERE room_type_id = $1
       ORDER BY start_date DESC`,
      [req.params.id],
    );
    res.status(200).json(ApiResponse.success(rows));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/blocks', validate(CreateBlockSchema), async (req, res, next) => {
  try {
    const { start_date, end_date, block_type, reason, notes } = req.body as z.infer<
      typeof CreateBlockSchema
    >;

    // Auditoría 17 secciones, sección 2: antes solo validaba
    // start_date < end_date -- un owner podía bloquear fechas con una
    // reserva confirmada ya activa ahí, sin aviso. Mismo patrón de join
    // que date-blocker.ts (reservations → reservation_beds → beds).
    const { rows: conflicts } = await query(
      `SELECT r.id, g.full_name AS guest_name, rb.check_in::text, rb.check_out::text
       FROM reservations r
       JOIN guests g ON g.id = r.guest_id
       JOIN reservation_beds rb ON rb.reservation_id = r.id
       JOIN beds b ON b.id = rb.bed_id
       WHERE b.room_type_id = $1 AND r.status IN ('confirmed', 'pending_payment')
         AND rb.check_in < $3 AND rb.check_out > $2`,
      [req.params.id, start_date, end_date],
    );
    if (conflicts.length > 0) {
      res
        .status(409)
        .json(
          ApiResponse.error(
            `No se puede bloquear: hay ${conflicts.length} reserva(s) confirmada(s) en ese rango de fechas`,
          ),
        );
      return;
    }

    const { rows } = await query(
      `INSERT INTO room_blocks (room_type_id, start_date, end_date, block_type, reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, start_date::text, end_date::text, block_type, reason, notes, created_at`,
      [req.params.id, start_date, end_date, block_type || 'other', reason ?? null, notes ?? null],
    );
    res.status(201).json(ApiResponse.success(rows[0], 'Bloqueo creado'));
  } catch (error: any) {
    if (error?.code === '23514') {
      res.status(400).json(ApiResponse.error('La fecha de fin debe ser posterior a la de inicio'));
      return;
    }
    next(error);
  }
});

router.delete('/blocks/:blockId', async (req, res, next) => {
  try {
    const ownerId = getOwnerId(req)!;
    const { blockId } = req.params;
    if (!(await ownsRoomTypeOf('room_blocks', blockId, ownerId))) {
      res.status(404).json(ApiResponse.error('Bloqueo no encontrado'));
      return;
    }
    await query(`DELETE FROM room_blocks WHERE id = $1`, [blockId]);
    res.status(200).json(ApiResponse.success(null, 'Bloqueo eliminado'));
  } catch (error) {
    next(error);
  }
});

// ─── Precios dinámicos (límites min/max del bot para este apartamento) ───────

router.get('/:id/pricing', async (req, res, next) => {
  try {
    const all = await dynamicPricingService.getUnitConfigs();
    const config = all.find((u) => u.room_type_id === req.params.id) ?? null;
    res.status(200).json(ApiResponse.success(config));
  } catch (error) {
    next(error);
  }
});

router.put('/:id/pricing', validate(UnitConfigSchema), async (req, res, next) => {
  try {
    const { min_price_brl, max_price_brl, bot_enabled, notes } = req.body as z.infer<
      typeof UnitConfigSchema
    >;
    const updated = await dynamicPricingService.upsertUnitConfig(req.params.id, {
      min_price_brl: min_price_brl ?? null,
      max_price_brl: max_price_brl ?? null,
      bot_enabled: bot_enabled ?? true,
      notes,
    });
    res.status(200).json(ApiResponse.success(updated, 'Precios actualizados'));
  } catch (error) {
    next(error);
  }
});

export const ownerApartmentsRouter = router;
