// lapa-casa-hostel/backend/src/routes/admin/room-type-photos.routes.ts
//
// Gestión de fotos por apartamento (room_type de tipo 'apartment').
// Montado bajo /admin/room-types (admin.routes.ts), con auth JWT ya aplicada.

import { Router } from 'express';
import multer from 'multer';
import { query } from '../../config/database';
import { uploadApartmentPhoto, deleteApartmentPhoto } from '../../lib/cloudinary/cloudinary-client';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';

const router = Router();

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
      `SELECT rt.id, rt.code, rt.name, rt.capacity, rt.base_price,
              COUNT(rtp.id)::int AS photo_count,
              (SELECT rtp2.image_url FROM room_type_photos rtp2
               WHERE rtp2.room_type_id = rt.id AND rtp2.is_primary = true LIMIT 1) AS primary_photo
       FROM room_types rt
       LEFT JOIN room_type_photos rtp ON rtp.room_type_id = rt.id
       WHERE rt.property_type = 'apartment'
       GROUP BY rt.id
       ORDER BY rt.base_price, rt.name`
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
      [id]
    );
    res.status(200).json(ApiResponse.success({ photos: rows }));
  } catch (error) {
    next(error);
  }
});

/** POST /admin/room-types/:id/photos — sube una foto nueva */
router.post('/:id/photos', upload.single('photo'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      res.status(400).json(ApiResponse.error('Falta el archivo de imagen (campo "photo")'));
      return;
    }

    // Verificar que el room_type existe y es un apartamento
    const { rows: rtRows } = await query(
      `SELECT id FROM room_types WHERE id = $1 AND property_type = 'apartment'`,
      [id]
    );
    if (rtRows.length === 0) {
      res.status(404).json(ApiResponse.error('Apartamento no encontrado'));
      return;
    }

    const { altText } = req.body as { altText?: string };

    // Si no hay fotos aún, esta será la primaria
    const { rows: existing } = await query(
      `SELECT COUNT(*)::int AS total FROM room_type_photos WHERE room_type_id = $1`,
      [id]
    );
    const isPrimary = existing[0]!.total === 0;
    const displayOrder = existing[0]!.total;

    const uploaded = await uploadApartmentPhoto(req.file.buffer);

    const { rows } = await query(
      `INSERT INTO room_type_photos
         (room_type_id, image_url, cloudinary_public_id, display_order, is_primary, alt_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, image_url, cloudinary_public_id, display_order, is_primary, alt_text, created_at`,
      [id, uploaded.url, uploaded.publicId, displayOrder, isPrimary, altText ?? null]
    );

    await auditLogService.log({
      entity_type: 'room_type_photo', entity_id: rows[0]!.id, operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: { roomTypeId: id, isPrimary }
    });

    res.status(201).json(ApiResponse.success({ photo: rows[0] }, 'Foto subida'));
  } catch (error) {
    next(error);
  }
});

/** PATCH /admin/room-types/photos/:photoId — marcar primaria, editar alt_text o display_order */
router.patch('/photos/:photoId', async (req, res, next) => {
  try {
    const { photoId } = req.params;
    const { isPrimary, altText, displayOrder } = req.body as {
      isPrimary?: boolean;
      altText?: string;
      displayOrder?: number;
    };

    if (isPrimary === undefined && altText === undefined && displayOrder === undefined) {
      res.status(400).json(ApiResponse.error('Nada para actualizar'));
      return;
    }

    // Si se marca como primaria, quitar la primaria anterior del mismo apartamento
    if (isPrimary === true) {
      const { rows: photoRows } = await query(
        `SELECT room_type_id FROM room_type_photos WHERE id = $1`,
        [photoId]
      );
      if (photoRows.length === 0) {
        res.status(404).json(ApiResponse.error('Foto no encontrada'));
        return;
      }
      await query(
        `UPDATE room_type_photos SET is_primary = false, updated_at = now()
         WHERE room_type_id = $1 AND is_primary = true`,
        [photoRows[0]!.room_type_id]
      );
    }

    const sets: string[] = [];
    const params: any[] = [];
    if (isPrimary !== undefined) { params.push(isPrimary); sets.push(`is_primary = $${params.length}`); }
    if (altText !== undefined) { params.push(altText || null); sets.push(`alt_text = $${params.length}`); }
    if (displayOrder !== undefined) { params.push(displayOrder); sets.push(`display_order = $${params.length}`); }

    params.push(photoId);
    const { rows } = await query(
      `UPDATE room_type_photos SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING id, image_url, display_order, is_primary, alt_text`,
      params
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
      [photoId]
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
        [photo.room_type_id]
      );
    }

    await auditLogService.log({
      entity_type: 'room_type_photo', entity_id: photoId, operation: 'ADMIN_DELETE',
      old_data: { roomTypeId: photo.room_type_id }
    });

    res.status(200).json(ApiResponse.success(null, 'Foto eliminada'));
  } catch (error) {
    next(error);
  }
});

export { router as roomTypePhotosRouter };
