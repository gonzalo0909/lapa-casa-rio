-- 0023_dynamic_pricing_per_unit.sql
-- Configuración de precios dinámicos por unidad (habitación/apartamento).
-- Reemplaza los campos price_min_brl/price_max_brl globales con overrides por room_type.
-- El bot ahora calcula un precio por room_type, no uno genérico por property_type.

-- ── Configuración por unidad ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dynamic_pricing_unit_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id  UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  min_price_brl NUMERIC(10,2),   -- NULL = usar mínimo global de dynamic_pricing_config
  max_price_brl NUMERIC(10,2),   -- NULL = usar máximo global
  bot_enabled   BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_type_id)
);

CREATE INDEX IF NOT EXISTS idx_dp_unit_config_room_type
  ON dynamic_pricing_unit_config (room_type_id);

COMMENT ON TABLE dynamic_pricing_unit_config IS
  'Override de precios dinámicos por habitación/apartamento. '
  'Si min/max son NULL se usa el valor global de dynamic_pricing_config.';

-- ── price_cache: añadir room_type_id ────────────────────────────────────
-- Primero quitamos la restricción unique antigua (date, property_type)
-- y añadimos una nueva (date, room_type_id).

-- 1. Agregar columna room_type_id (nullable al principio para no romper datos existentes)
ALTER TABLE price_cache
  ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id) ON DELETE CASCADE;

-- 2. Vaciar la caché existente (datos del esquema viejo, sin room_type_id)
TRUNCATE TABLE price_cache;

-- 3. Hacer room_type_id NOT NULL ahora que la tabla está vacía
ALTER TABLE price_cache
  ALTER COLUMN room_type_id SET NOT NULL;

-- 4. Eliminar unique constraint vieja y crear la nueva
ALTER TABLE price_cache
  DROP CONSTRAINT IF EXISTS price_cache_target_date_property_type_key;

ALTER TABLE price_cache
  ADD CONSTRAINT price_cache_target_date_room_type_id_key
  UNIQUE (target_date, room_type_id);

-- 5. Actualizar índice
DROP INDEX IF EXISTS idx_price_cache_date;
CREATE INDEX IF NOT EXISTS idx_price_cache_date_room
  ON price_cache (target_date, room_type_id);

COMMENT ON TABLE price_cache IS
  'Precios pre-calculados por el bot nightly, uno por room_type por fecha.';
