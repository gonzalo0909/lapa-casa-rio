// lapa-casa-hostel/backend/src/utils/decode-base64-image.ts
//
// Decodifica un data URL de imagen (ej. "data:image/jpeg;base64,...") a un
// Buffer para subir a Cloudinary. Usado por el pago grupal y por la reserva
// individual, ambos requieren la foto del documento antes de pagar.

import { isRealImage } from './validate-image-bytes';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB -- ya viene redimensionada por el cliente

export function decodeBase64Image(dataUrl: string): Buffer {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error('Foto de documento inválida: formato no soportado');
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    throw new Error('Foto de documento inválida: archivo vacío');
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error('Foto de documento inválida: archivo demasiado grande');
  }
  // Auditoría 17 secciones, sección 15: el prefijo "data:image/jpeg;..." lo
  // declara el cliente, no prueba nada del contenido real -- se valida el
  // buffer decodificado contra los magic bytes reales del formato.
  if (!isRealImage(buffer)) {
    throw new Error('Foto de documento inválida: el archivo no es una imagen real');
  }
  return buffer;
}
