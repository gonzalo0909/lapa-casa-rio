-- 0037_apartment_map_coords.sql
-- Coordenadas geográficas aproximadas por apartamento.
-- lat/lng se muestran en el mapa público (sin dirección exacta).
-- Los propietarios las cargan desde su panel; el mapa usa el barrio
-- como fallback si aún no están configuradas.

ALTER TABLE room_types
  ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);
