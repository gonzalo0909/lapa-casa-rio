// lapa-casa-hostel/backend/src/routes/admin/room-type-photos.routes.ts
//
// Gestión de fotos por apartamento (room_type de tipo 'apartment').
// Montado bajo /admin/room-types (admin.routes.ts), con auth JWT ya aplicada.

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query } from '../../config/database';
import { uploadApartmentPhoto, deleteApartmentPhoto } from '../../lib/cloudinary/cloudinary-client';
import { isRealImage } from '../../utils/validate-image-bytes';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';

const router = Router();

const UploadPhotoSchema = z.object({
  altText: z.string().optional(),
});

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

const UpdateApartmentSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    neighborhood: z.string().optional(),
    capacity: z.number().optional(),
    bedrooms: z.number().nullable().optional(),
    bathrooms: z.number().nullable().optional(),
    amenities: z.any().optional(),
    base_price: z.number().optional(),
    is_flexible: z.boolean().optional(),
    external_rating: z.number().nullable().optional(),
    external_review_count: z.number().nullable().optional(),
    external_rating_label: z.string().nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Nada para actualizar',
  });

const CreateReviewSchema = z.object({
  author_name: z.string().trim().min(1),
  platform: z.string().optional(),
  rating: z.number().min(1).max(5),
  comment: z.string().trim().min(1),
  review_date: z.string().optional(),
  is_published: z.boolean().optional(),
});

const UpdateReviewSchema = z
  .object({
    author_name: z.string().trim().min(1).optional(),
    platform: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    comment: z.string().trim().min(1).optional(),
    review_date: z.string().optional(),
    is_published: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Nada para actualizar',
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

/** GET /admin/room-types — lista apartamentos con conteo de fotos */
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT rt.id, rt.code, rt.name, rt.capacity, rt.base_price, rt.owner_id,
              COUNT(rtp.id)::int AS photo_count,
              (SELECT rtp2.image_url FROM room_type_photos rtp2
               WHERE rtp2.room_type_id = rt.id AND rtp2.is_primary = true LIMIT 1) AS primary_photo
       FROM room_types rt
       LEFT JOIN room_type_photos rtp ON rtp.room_type_id = rt.id
       WHERE rt.property_type = 'apartment'
       GROUP BY rt.id
       ORDER BY rt.base_price, rt.name`,
    );
    res.status(200).json(ApiResponse.success({ apartments: rows }));
  } catch (error) {
    next(error);
  }
});

/** GET /admin/room-types/:id/photos — fotos de un apartamento, ordenadas */
router.get('/:id/photos', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT id, image_url, cloudinary_public_id, display_order, is_primary, alt_text, created_at
       FROM room_type_photos
       WHERE room_type_id = $1
       ORDER BY display_order ASC, created_at ASC`,
      [id],
    );
    res.status(200).json(ApiResponse.success({ photos: rows }));
  } catch (error) {
    next(error);
  }
});

/** POST /admin/room-types/:id/photos — sube una foto nueva */
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
      // Auditoría 17 secciones, sección 15: validar magic bytes reales, no
      // solo el Content-Type que declaró el cliente (ver photos.routes.ts).
      if (!isRealImage(req.file.buffer)) {
        res.status(400).json(ApiResponse.error('El archivo no es una imagen válida'));
        return;
      }

      // Verificar que el room_type existe y es un apartamento
      const { rows: rtRows } = await query(
        `SELECT id FROM room_types WHERE id = $1 AND property_type = 'apartment'`,
        [id],
      );
      if (rtRows.length === 0) {
        res.status(404).json(ApiResponse.error('Apartamento no encontrado'));
        return;
      }

      const { altText } = req.body as z.infer<typeof UploadPhotoSchema>;

      // Si no hay fotos aún, esta será la primaria
      const { rows: existing } = await query(
        `SELECT COUNT(*)::int AS total FROM room_type_photos WHERE room_type_id = $1`,
        [id],
      );
      const isPrimary = existing[0]!.total === 0;
      const displayOrder = existing[0]!.total;

      const uploaded = await uploadApartmentPhoto(req.file.buffer);

      const { rows } = await query(
        `INSERT INTO room_type_photos
         (room_type_id, image_url, cloudinary_public_id, display_order, is_primary, alt_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, image_url, cloudinary_public_id, display_order, is_primary, alt_text, created_at`,
        [id, uploaded.url, uploaded.publicId, displayOrder, isPrimary, altText ?? null],
      );

      await auditLogService.log({
        entity_type: 'room_type_photo',
        entity_id: rows[0]!.id,
        operation: 'ADMIN_UPDATE_SETTINGS',
        new_data: { roomTypeId: id, isPrimary },
      });

      res.status(201).json(ApiResponse.success({ photo: rows[0] }, 'Foto subida'));
    } catch (error) {
      next(error);
    }
  },
);

/** PATCH /admin/room-types/photos/:photoId — marcar primaria, editar alt_text o display_order */
router.patch('/photos/:photoId', validate(PatchPhotoSchema), async (req, res, next) => {
  try {
    const { photoId } = req.params;
    const { isPrimary, altText, displayOrder } = req.body as z.infer<typeof PatchPhotoSchema>;

    // Si se marca como primaria, quitar la primaria anterior del mismo apartamento
    if (isPrimary === true) {
      const { rows: photoRows } = await query(
        `SELECT room_type_id FROM room_type_photos WHERE id = $1`,
        [photoId],
      );
      if (photoRows.length === 0) {
        res.status(404).json(ApiResponse.error('Foto no encontrada'));
        return;
      }
      await query(
        `UPDATE room_type_photos SET is_primary = false, updated_at = now()
         WHERE room_type_id = $1 AND is_primary = true`,
        [photoRows[0]!.room_type_id],
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

    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Foto no encontrada'));
      return;
    }

    res.status(200).json(ApiResponse.success({ photo: rows[0] }, 'Foto actualizada'));
  } catch (error) {
    next(error);
  }
});

/** DELETE /admin/room-types/photos/:photoId — borra foto de Cloudinary y DB */
router.delete('/photos/:photoId', async (req, res, next) => {
  try {
    const { photoId } = req.params;
    const { rows } = await query(
      `SELECT id, cloudinary_public_id, room_type_id, is_primary
       FROM room_type_photos WHERE id = $1`,
      [photoId],
    );
    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Foto no encontrada'));
      return;
    }
    const photo = rows[0]!;

    await deleteApartmentPhoto(photo.cloudinary_public_id).catch(() => {
      // Si Cloudinary falla, se borra el registro igual
    });
    await query(`DELETE FROM room_type_photos WHERE id = $1`, [photoId]);

    // Si era la primaria, promover la siguiente foto disponible
    if (photo.is_primary) {
      await query(
        `UPDATE room_type_photos SET is_primary = true, updated_at = now()
         WHERE id = (
           SELECT id FROM room_type_photos
           WHERE room_type_id = $1
           ORDER BY display_order ASC, created_at ASC
           LIMIT 1
         )`,
        [photo.room_type_id],
      );
    }

    await auditLogService.log({
      entity_type: 'room_type_photo',
      entity_id: photoId,
      operation: 'ADMIN_DELETE',
      old_data: { roomTypeId: photo.room_type_id },
    });

    res.status(200).json(ApiResponse.success(null, 'Foto eliminada'));
  } catch (error) {
    next(error);
  }
});

// ── Datos del apartamento ─────────────────────────────────────────────────

/** GET /admin/room-types/:id — detalle completo de un apartamento */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, code, name, capacity, base_price, property_type,
              description, neighborhood, amenities, bedrooms, bathrooms,
              external_rating, external_review_count, external_rating_label,
              is_flexible, created_at, updated_at
       FROM room_types
       WHERE id = $1 AND property_type = 'apartment'`,
      [req.params.id],
    );
    if (!rows.length) {
      res.status(404).json(ApiResponse.error('Apartamento no encontrado'));
      return;
    }
    res.json(ApiResponse.success(rows[0]));
  } catch (err) {
    next(err);
  }
});

/** PUT /admin/room-types/:id — editar datos del apartamento */
router.put('/:id', validate(UpdateApartmentSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      neighborhood,
      capacity,
      bedrooms,
      bathrooms,
      amenities,
      base_price,
      is_flexible,
      external_rating,
      external_review_count,
      external_rating_label,
    } = req.body as z.infer<typeof UpdateApartmentSchema>;

    const sets: string[] = [];
    const params: any[] = [];
    const p = () => `$${params.length}`;

    if (name !== undefined) {
      params.push(String(name).trim());
      sets.push(`name = ${p()}`);
    }
    if (description !== undefined) {
      params.push(description || null);
      sets.push(`description = ${p()}`);
    }
    if (neighborhood !== undefined) {
      params.push(neighborhood || null);
      sets.push(`neighborhood = ${p()}`);
    }
    if (capacity !== undefined) {
      params.push(Number(capacity));
      sets.push(`capacity = ${p()}`);
    }
    if (bedrooms !== undefined) {
      params.push(bedrooms != null ? Number(bedrooms) : null);
      sets.push(`bedrooms = ${p()}`);
    }
    if (bathrooms !== undefined) {
      params.push(bathrooms != null ? Number(bathrooms) : null);
      sets.push(`bathrooms = ${p()}`);
    }
    if (amenities !== undefined) {
      params.push(JSON.stringify(amenities));
      sets.push(`amenities = ${p()}::jsonb`);
    }
    if (base_price !== undefined) {
      params.push(Number(base_price));
      sets.push(`base_price = ${p()}`);
    }
    if (is_flexible !== undefined) {
      params.push(Boolean(is_flexible));
      sets.push(`is_flexible = ${p()}`);
    }
    if (external_rating !== undefined) {
      params.push(external_rating != null ? Number(external_rating) : null);
      sets.push(`external_rating = ${p()}`);
    }
    if (external_review_count !== undefined) {
      params.push(external_review_count != null ? Number(external_review_count) : null);
      sets.push(`external_review_count = ${p()}`);
    }
    if (external_rating_label !== undefined) {
      params.push(external_rating_label || null);
      sets.push(`external_rating_label = ${p()}`);
    }

    if (!sets.length) {
      res.status(400).json(ApiResponse.error('Nada para actualizar'));
      return;
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE room_types SET ${sets.join(', ')}, updated_at = now()
       WHERE id = ${p()} AND property_type = 'apartment'
       RETURNING id, code, name, capacity, base_price, description, neighborhood,
                 amenities, bedrooms, bathrooms, external_rating, external_review_count,
                 external_rating_label, is_flexible, updated_at`,
      params,
    );
    if (!rows.length) {
      res.status(404).json(ApiResponse.error('Apartamento no encontrado'));
      return;
    }

    await auditLogService.log({
      entity_type: 'room_type',
      entity_id: id,
      operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: req.body,
    });

    res.json(ApiResponse.success(rows[0], 'Apartamento actualizado'));
  } catch (err) {
    next(err);
  }
});

// ── Resenas ───────────────────────────────────────────────────────────────

/** GET /admin/room-types/:id/reviews */
router.get('/:id/reviews', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, author_name, platform, rating, comment,
              review_date::text, is_published, created_at
       FROM apartment_reviews
       WHERE room_type_id = $1
       ORDER BY review_date DESC, created_at DESC`,
      [req.params.id],
    );
    res.json(ApiResponse.success(rows));
  } catch (err) {
    next(err);
  }
});

/** POST /admin/room-types/:id/reviews */
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
        String(author_name).trim(),
        platform || 'Admin',
        Number(rating),
        String(comment).trim(),
        review_date || new Date().toISOString().slice(0, 10),
        is_published ?? true,
      ],
    );
    res.status(201).json(ApiResponse.success(rows[0], 'Resena creada'));
  } catch (err) {
    next(err);
  }
});

/** PUT /admin/room-types/reviews/:reviewId */
router.put('/reviews/:reviewId', validate(UpdateReviewSchema), async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { author_name, platform, rating, comment, review_date, is_published } =
      req.body as z.infer<typeof UpdateReviewSchema>;
    const sets: string[] = [];
    const params: any[] = [];
    const p = () => `$${params.length}`;
    if (author_name !== undefined) {
      params.push(String(author_name).trim());
      sets.push(`author_name = ${p()}`);
    }
    if (platform !== undefined) {
      params.push(platform || 'Admin');
      sets.push(`platform = ${p()}`);
    }
    if (rating !== undefined) {
      params.push(Number(rating));
      sets.push(`rating = ${p()}`);
    }
    if (comment !== undefined) {
      params.push(String(comment).trim());
      sets.push(`comment = ${p()}`);
    }
    if (review_date !== undefined) {
      params.push(review_date || null);
      sets.push(`review_date = ${p()}`);
    }
    if (is_published !== undefined) {
      params.push(Boolean(is_published));
      sets.push(`is_published = ${p()}`);
    }
    if (!sets.length) {
      res.status(400).json(ApiResponse.error('Nada para actualizar'));
      return;
    }
    params.push(reviewId);
    const { rows } = await query(
      `UPDATE apartment_reviews SET ${sets.join(', ')}, updated_at = now()
       WHERE id = ${p()}
       RETURNING id, author_name, platform, rating, comment,
                 review_date::text, is_published, created_at`,
      params,
    );
    if (!rows.length) {
      res.status(404).json(ApiResponse.error('Resena no encontrada'));
      return;
    }
    res.json(ApiResponse.success(rows[0], 'Resena actualizada'));
  } catch (err) {
    next(err);
  }
});

/** DELETE /admin/room-types/reviews/:reviewId */
router.delete('/reviews/:reviewId', async (req, res, next) => {
  try {
    const { rows } = await query(`DELETE FROM apartment_reviews WHERE id = $1 RETURNING id`, [
      req.params.reviewId,
    ]);
    if (!rows.length) {
      res.status(404).json(ApiResponse.error('Resena no encontrada'));
      return;
    }
    res.json(ApiResponse.success(null, 'Resena eliminada'));
  } catch (err) {
    next(err);
  }
});

export { router as roomTypePhotosRouter };
