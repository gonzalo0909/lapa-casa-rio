-- 0015_guest_photos.sql
--
-- Bitacora de viajantes: galeria curada por el dueño (no un formulario
-- publico de carga -- las fotos las sube el dueño desde el admin,
-- despues de recibirlas por WhatsApp/email de los huespedes, para no
-- tener que moderar contenido anonimo en un sitio publico). Las
-- imagenes en si viven en Cloudinary (image_url/public_id); esta tabla
-- solo guarda los metadatos y el orden de publicacion.

CREATE TABLE IF NOT EXISTS guest_photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url         TEXT NOT NULL,
  cloudinary_public_id VARCHAR(255) NOT NULL,
  guest_name        VARCHAR(120),
  guest_country     VARCHAR(2),
  caption           TEXT,
  is_published      BOOLEAN NOT NULL DEFAULT true,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_photos_published ON guest_photos(is_published, display_order);
