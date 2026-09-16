// lapa-casa-hostel/backend/src/routes/photos/photos.routes.ts
//
// Endpoint público de solo lectura para la galería de fotos de
// huéspedes ("bitácora de viajantes") -- la carga/gestión vive en
// /admin/photos (photos.routes.ts), acá solo se listan las publicadas.

import { Router } from 'express';
import { query } from '../../config/database';
import { ApiResponse } from '../../utils/responses';

const router = Router();

interface PublicGuestPhoto {
  id: string;
  image_url: string;
  guest_name: string | null;
  guest_country: string | null;
  caption: string | null;
  created_at: Date;
}

/** GET /photos — fotos publicadas, para la galería pública */
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query<PublicGuestPhoto>(
      `SELECT id, image_url, guest_name, guest_country, caption, created_at
       FROM guest_photos
       WHERE is_published = true
       ORDER BY display_order, created_at DESC`
    );
    res.status(200).json(ApiResponse.success({ photos: rows }));
  } catch (error) {
    next(error);
  }
});

export { router as photosRouter };
