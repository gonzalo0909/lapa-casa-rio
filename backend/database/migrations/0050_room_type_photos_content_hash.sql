-- 0050_room_type_photos_content_hash.sql
--
-- Detección de fotos duplicadas (owner-apartments.routes.ts POST .../photos):
-- sha256 del archivo, calculado antes de subirlo a Cloudinary -- si ya existe
-- una fila con el mismo (room_type_id, content_hash), se rechaza con 409 en
-- vez de subir el duplicado. Fotos ya existentes quedan con content_hash NULL
-- (no hay forma de recalcularlo sin volver a descargarlas de Cloudinary);
-- eso no rompe la unicidad porque Postgres no compara NULLs entre sí.

ALTER TABLE room_type_photos ADD COLUMN IF NOT EXISTS content_hash TEXT;

ALTER TABLE room_type_photos
  DROP CONSTRAINT IF EXISTS room_type_photos_room_type_content_hash_key;

ALTER TABLE room_type_photos
  ADD CONSTRAINT room_type_photos_room_type_content_hash_key
  UNIQUE (room_type_id, content_hash);
