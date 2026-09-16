-- 0018_room_type_property_type.sql
--
-- Introduce property_type en room_types para que los filtros que ya
-- existen en check-availability.ts y apartment-availability.ts
-- (`category = 'hostel'|'apartment'`) apunten a una columna real -- hoy
-- no existe ninguna columna category en todo el schema, y esos dos
-- endpoints fallan en runtime con "column does not exist".
--
-- DEFAULT 'hostel' es seguro sin backfill: las 5 room_types que existen
-- hoy son, todas, dormitorios del hostel.

CREATE TYPE property_type AS ENUM ('hostel', 'apartment');

ALTER TABLE room_types
  ADD COLUMN property_type property_type NOT NULL DEFAULT 'hostel';

CREATE INDEX IF NOT EXISTS idx_room_types_property_type ON room_types (property_type);
