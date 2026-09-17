// lapa-casa-hostel/backend/src/routes/admin/photos.routes.ts
//
// Galería curada de fotos de huéspedes ("bitácora de viajantes"): el
// dueño sube acá las fotos que recibe por WhatsApp/email -- no hay
// formulario público de carga, así que no hace falta moderar contenido
// anónimo. Montado bajo /admin (routes/index.ts ya aplica
// authenticateToken + requireRole(['admin']) a todo ese prefijo).

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query } from '../../config/database';
import { uploadGuestPhoto, deleteGuestPhoto } from '../../lib/cloudinary/cloudinary-client';
import { isRealImage } from '../../utils/validate-image-bytes';
import { auditLogService } from '../../services/audit-log-service';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';

const router = Router();

const UploadGuestPhotoSchema = z.object({
  guestName: z.string().optional(),
  guestCountry: z.string().optional(),
  caption: z.string().optional(),
});

const PatchGuestPhotoSchema = z.object({
  isPublished: z.boolean().optional(),
  guestName: z.string().optional(),
  guestCountry: z.string().optional(),
  caption: z.string().optional(),
  displayOrder: z.number().int().optional(),
}).refine((v) => Object.values(v).some((x) => x !== undefined), {
  message: 'Nada para actualizar',
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Solo se aceptan archivos de imagen'));
      return;
    }
    cb(null, true);
  },
});

interface GuestPhotoRow {
  id: string;
  image_url: string;
  cloudinary_public_id: string;
  guest_name: string | null;
  guest_country: string | null;
  caption: string | null;
  is_published: boolean;
  display_order: number;
  created_at: Date;
}

/** GET /admin/photos — todas las fotos (publicadas y no), para gestionar desde el admin */
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query<GuestPhotoRow>(
      `SELECT * FROM guest_photos ORDER BY display_order, created_at DESC`
    );
    res.status(200).json(ApiResponse.success({ photos: rows }));
  } catch (error) {
    next(error);
  }
});

/** POST /admin/photos — sube una foto nueva (multipart/form-data, campo "photo") */
router.post('/', upload.single('photo'), validate(UploadGuestPhotoSchema), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json(ApiResponse.error('Falta el archivo de imagen (campo "photo")'));
      return;
    }
    // Auditoría 17 secciones, sección 15: multer.fileFilter solo vio el
    // Content-Type declarado; acá ya tenemos el buffer real, así que se
    // valida contra los magic bytes reales antes de subir a Cloudinary.
    if (!isRealImage(req.file.buffer)) {
      res.status(400).json(ApiResponse.error('El archivo no es una imagen válida'));
      return;
    }

    const { guestName, guestCountry, caption } = req.body as z.infer<typeof UploadGuestPhotoSchema>;

    const uploaded = await uploadGuestPhoto(req.file.buffer);

    const { rows } = await query<GuestPhotoRow>(
      `INSERT INTO guest_photos (image_url, cloudinary_public_id, guest_name, guest_country, caption)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uploaded.url, uploaded.publicId, guestName || null, guestCountry || null, caption || null]
    );

    await auditLogService.log({
      entity_type: 'guest_photo',
      entity_id: rows[0]!.id,
      operation: 'ADMIN_UPDATE_SETTINGS',
      new_data: { guestName, guestCountry },
    });

    res.status(201).json(ApiResponse.success({ photo: rows[0] }, 'Foto subida'));
  } catch (error) {
    next(error);
  }
});

/** PATCH /admin/photos/:id — publicar/despublicar, editar datos o reordenar */
router.patch('/:id', validate(PatchGuestPhotoSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isPublished, guestName, guestCountry, caption, displayOrder } =
      req.body as z.infer<typeof PatchGuestPhotoSchema>;

    const sets: string[] = [];
    const params: any[] = [];
    if (isPublished !== undefined) { params.push(isPublished); sets.push(`is_published = $${params.length}`); }
    if (guestName !== undefined) { params.push(guestName || null); sets.push(`guest_name = $${params.length}`); }
    if (guestCountry !== undefined) { params.push(guestCountry || null); sets.push(`guest_country = $${params.length}`); }
    if (caption !== undefined) { params.push(caption || null); sets.push(`caption = $${params.length}`); }
    if (displayOrder !== undefined) { params.push(displayOrder); sets.push(`display_order = $${params.length}`); }

    params.push(id);
    const { rows } = await query<GuestPhotoRow>(
      `UPDATE guest_photos SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
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

/** DELETE /admin/photos/:id — borra la foto de Cloudinary y su registro */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query<GuestPhotoRow>(`SELECT * FROM guest_photos WHERE id = $1`, [id]);
    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Foto no encontrada'));
      return;
    }

    await deleteGuestPhoto(rows[0]!.cloudinary_public_id).catch(() => {
      // Si Cloudinary falla al borrar (ej. ya no existe), igual se borra
      // el registro -- no queremos un huérfano bloqueando la galería.
    });
    await query(`DELETE FROM guest_photos WHERE id = $1`, [id]);

    await auditLogService.log({ entity_type: 'guest_photo', entity_id: id, operation: 'ADMIN_DELETE' });

    res.status(200).json(ApiResponse.success(null, 'Foto eliminada'));
  } catch (error) {
    next(error);
  }
});

export { router as adminPhotosRouter };
