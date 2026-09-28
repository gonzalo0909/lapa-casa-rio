-- 0034_apartment_address_fields.sql
-- Agrega campos de dirección a room_types para que los administradores
-- de apartamento (owners) puedan completar la dirección completa desde
-- su panel propio.

ALTER TABLE room_types
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS address_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cep            VARCHAR(9);
