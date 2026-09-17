-- 0035_booking_guests_document_photo.sql
--
-- Agrega columnas de foto de documento a booking_guests (acompañantes).
-- Espeja las columnas ya existentes en guests (migración 0029).
-- La foto se sube a Cloudinary (carpeta guest-documents, tipo authenticated)
-- al momento de crear la reserva, igual que la del titular.

ALTER TABLE booking_guests
  ADD COLUMN IF NOT EXISTS document_photo_url        TEXT,
  ADD COLUMN IF NOT EXISTS document_photo_public_id  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS document_photo_uploaded_at TIMESTAMPTZ;

COMMENT ON COLUMN booking_guests.document_photo_url IS
  'URL autenticada de Cloudinary con la foto del DNI/pasaporte del acompañante.
   Subida al crear la reserva desde el motor de apartamentos.';

COMMENT ON COLUMN booking_guests.document_photo_public_id IS
  'public_id de Cloudinary — necesario para borrar la foto si se cancela la reserva.';
