-- 0029_guest_document_photo.sql
--
-- Foto del documento de identidad (DNI/pasaporte), obligatoria para
-- cualquier huésped que se vaya a hospedar -- titular o invitado, reserva
-- individual o grupal. Se sube antes de pagar y queda en Cloudinary
-- (carpeta privada guest-documents, separada de guest_photos que es la
-- galería pública de marketing).

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS document_photo_url        TEXT,
  ADD COLUMN IF NOT EXISTS document_photo_public_id  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS document_photo_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN guests.document_photo_url IS
  'Foto del DNI/pasaporte subida por el huésped antes de pagar. Privada -- solo para verificación de identidad, no se publica.';
