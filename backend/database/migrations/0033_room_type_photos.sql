-- 0033_room_type_photos.sql
--
-- Crea la tabla room_type_photos, que el código ya usaba en varios
-- lugares (admin/room-type-photos.routes.ts, owner/owner-apartments.routes.ts,
-- availability/apartment-availability.ts) pero que ninguna migración
-- anterior había creado -- toda la gestión de fotos de habitaciones/
-- apartamentos daba error 500 desde que se escribió ese código.
-- Encontrado probando el panel de admin y el de dueños de apartamento
-- contra una base de datos real (idea #49, roadmap.html -- verificación
-- de todo lo construido en la sesión).

CREATE TABLE IF NOT EXISTS room_type_photos (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id        UUID         NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  image_url           TEXT         NOT NULL,
  cloudinary_public_id TEXT        NOT NULL,
  display_order       SMALLINT     NOT NULL DEFAULT 0,
  is_primary          BOOLEAN      NOT NULL DEFAULT false,
  alt_text            TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_type_photos_room_type
  ON room_type_photos (room_type_id, display_order ASC, created_at ASC);
