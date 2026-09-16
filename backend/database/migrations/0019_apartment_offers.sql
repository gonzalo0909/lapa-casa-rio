-- 0019_apartment_offers.sql
--
-- Tabla de ofertas/descuentos para apartamentos.
-- Permite al admin crear descuentos porcentuales con validez de fecha,
-- aplicables a todos los apartamentos o a una selección específica.

CREATE TABLE IF NOT EXISTS apartment_offers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(64)   NOT NULL UNIQUE,
  label         VARCHAR(255)  NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  -- NULL = aplica a todos los apartamentos
  apartment_ids UUID[]        DEFAULT NULL,
  valid_from    DATE          DEFAULT NULL,
  valid_to      DATE          DEFAULT NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índice para consultas de ofertas activas vigentes
CREATE INDEX IF NOT EXISTS idx_apartment_offers_active
  ON apartment_offers (is_active, valid_from, valid_to);

-- Comentarios descriptivos
COMMENT ON TABLE  apartment_offers IS 'Ofertas y descuentos porcentuales para apartamentos, configurables por el admin.';
COMMENT ON COLUMN apartment_offers.code IS 'Código identificador único, ej: verano2026.';
COMMENT ON COLUMN apartment_offers.discount_percent IS 'Porcentaje de descuento (1-100).';
COMMENT ON COLUMN apartment_offers.apartment_ids IS 'IDs de apartamentos a los que aplica; NULL = todos.';
COMMENT ON COLUMN apartment_offers.valid_from IS 'Inicio de vigencia; NULL = sin límite de inicio.';
COMMENT ON COLUMN apartment_offers.valid_to IS 'Fin de vigencia; NULL = sin límite de fin.';
