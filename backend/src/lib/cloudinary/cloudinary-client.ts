// lapa-casa-hostel/backend/src/lib/cloudinary/cloudinary-client.ts
//
// Cliente de Cloudinary para la galeria de fotos de huespedes. Sigue el
// mismo patron de degradacion que stripe-handler.ts/redis-client.ts: sin
// las 3 credenciales configuradas, no revienta -- loguea y las llamadas
// que intenten subir/borrar una foto fallan con un mensaje claro, en vez
// de tirar abajo el resto del backend.

import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../../utils/logger';

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    logger.warn('Cloudinary no configurado (faltan CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) — galería de fotos deshabilitada');
    return false;
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  configured = true;
  return true;
}

export interface UploadedPhoto {
  url: string;
  publicId: string;
}

/** Sube un buffer de imagen (JPEG/PNG) a la carpeta guest-photos. Redimensiona a 1600px de ancho máximo para no cargar fotos de celular a resolución completa. */
export async function uploadGuestPhoto(buffer: Buffer): Promise<UploadedPhoto> {
  if (!ensureConfigured()) {
    throw new Error('Cloudinary no está configurado');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'guest-photos',
        transformation: [{ width: 1600, crop: 'limit' }, { quality: 'auto' }, { fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error || !result) {
          logger.error('Error subiendo foto a Cloudinary', { error: error?.message });
          reject(error ?? new Error('Upload failed'));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}

export async function deleteGuestPhoto(publicId: string): Promise<void> {
  if (!ensureConfigured()) {
    throw new Error('Cloudinary no está configurado');
  }
  await cloudinary.uploader.destroy(publicId);
}
