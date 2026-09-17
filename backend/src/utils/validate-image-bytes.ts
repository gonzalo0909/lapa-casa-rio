// lapa-casa-hostel/backend/src/utils/validate-image-bytes.ts
//
// Auditoría 17 secciones, sección 15: los 3 endpoints de upload de imagen
// (guest photos, room-type photos, foto de documento en base64) validaban
// el archivo por el Content-Type/prefijo que declara el cliente
// (multer fileFilter solo ve `file.mimetype`, nunca el contenido -- el
// buffer recién existe después de terminar el upload) -- un atacante podía
// subir cualquier binario etiquetado "image/jpeg". Esto chequea los magic
// bytes reales contra los 4 formatos que el resto del código acepta
// (jpeg/png/webp/gif), sin agregar una dependencia nueva al proyecto.

const SIGNATURES: { name: string; check: (buf: Buffer) => boolean }[] = [
  { name: 'jpeg', check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff },
  {
    name: 'png',
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a,
  },
  {
    name: 'webp',
    check: (buf) =>
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    name: 'gif',
    check: (buf) =>
      buf.length >= 6 &&
      (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a'),
  },
];

/** true si el buffer empieza con la firma real de jpeg/png/webp/gif. */
export function isRealImage(buffer: Buffer): boolean {
  return SIGNATURES.some((sig) => sig.check(buffer));
}
