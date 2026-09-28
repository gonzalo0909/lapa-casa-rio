-- 0022_dynamic_pricing.sql
-- Bot de precios dinámicos: configuración editable, eventos, caché calculado.

-- ── Configuración de reglas (una sola fila, actualizable desde admin) ──────
CREATE TABLE IF NOT EXISTS dynamic_pricing_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tiers de ocupación: límite superior del bucket y su ajuste
  occ_tier_low_pct      SMALLINT NOT NULL DEFAULT 30,   -- < este %  → ajuste bajo
  occ_tier_mid_pct      SMALLINT NOT NULL DEFAULT 60,   -- < este %  → sin cambio
  occ_tier_high_pct     SMALLINT NOT NULL DEFAULT 80,   -- < este %  → ajuste alto
  occ_tier_vhigh_pct    SMALLINT NOT NULL DEFAULT 90,   -- < este %  → ajuste muy alto
                                                        -- >= 90%   → ajuste máximo

  occ_adj_low           NUMERIC(5,2) NOT NULL DEFAULT -10,   -- %
  occ_adj_mid           NUMERIC(5,2) NOT NULL DEFAULT   0,
  occ_adj_high          NUMERIC(5,2) NOT NULL DEFAULT  10,
  occ_adj_vhigh         NUMERIC(5,2) NOT NULL DEFAULT  20,
  occ_adj_max           NUMERIC(5,2) NOT NULL DEFAULT  35,

  -- Tiers de proximidad: días hasta la fecha
  prox_tier_far         SMALLINT NOT NULL DEFAULT 60,   -- > este → early bird
  prox_tier_mid         SMALLINT NOT NULL DEFAULT 30,   -- > este → sin cambio
  prox_tier_near        SMALLINT NOT NULL DEFAULT 14,   -- > este → near
  prox_tier_close       SMALLINT NOT NULL DEFAULT 7,    -- > este → close
                                                        -- <= 7   → last minute

  prox_adj_far          NUMERIC(5,2) NOT NULL DEFAULT  -5,   -- %
  prox_adj_mid          NUMERIC(5,2) NOT NULL DEFAULT   0,
  prox_adj_near         NUMERIC(5,2) NOT NULL DEFAULT  10,
  prox_adj_close        NUMERIC(5,2) NOT NULL DEFAULT  20,
  prox_adj_lastmin      NUMERIC(5,2) NOT NULL DEFAULT  30,

  -- Ajuste por día de semana
  dow_adj_weekday       NUMERIC(5,2) NOT NULL DEFAULT   0,   -- lun–jue
  dow_adj_weekend       NUMERIC(5,2) NOT NULL DEFAULT  15,   -- vie–dom

  -- Límites de precio final
  price_min_brl         NUMERIC(10,2) NOT NULL DEFAULT  70,
  price_max_brl         NUMERIC(10,2) NOT NULL DEFAULT 250,

  -- Horizonte del bot
  horizon_days          SMALLINT NOT NULL DEFAULT 90,

  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fila inicial con defaults
INSERT INTO dynamic_pricing_config DEFAULT VALUES
  ON CONFLICT DO NOTHING;

-- ── Eventos con impacto en precio ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(200) NOT NULL,
  date_from      DATE NOT NULL,
  date_to        DATE NOT NULL,
  adjustment_pct NUMERIC(5,2) NOT NULL,          -- ej: 50 = +50%, -10 = -10%
  applies_to     VARCHAR(20) NOT NULL DEFAULT 'all',  -- 'all' | 'hostel' | 'apartment'
  is_active      BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pricing_events_dates_check CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS idx_pricing_events_dates
  ON pricing_events (date_from, date_to, is_active);

-- Eventos predefinidos conocidos (editables desde el admin)
INSERT INTO pricing_events (name, date_from, date_to, adjustment_pct, applies_to, notes) VALUES
  ('Réveillon Rio',        '2025-12-28', '2026-01-03', 60, 'all',      'Año Nuevo en Río'),
  ('Carnaval 2026',        '2026-02-28', '2026-03-08', 80, 'all',      'Fechas a confirmar'),
  ('Semana Santa 2026',    '2026-04-02', '2026-04-06', 30, 'all',      'Feriado nacional'),
  ('Rock in Rio 2026',     '2026-09-19', '2026-09-28', 50, 'all',      'Confirmar fechas oficiales'),
  ('Lollapalooza 2026',    '2026-03-27', '2026-03-29', 40, 'all',      'Confirmar fechas oficiales'),
  ('Réveillon Rio 2027',   '2026-12-28', '2027-01-03', 60, 'all',      'Año Nuevo próximo')
ON CONFLICT DO NOTHING;

-- ── Caché de precios calculados por el bot ────────────────────────────────
CREATE TABLE IF NOT EXISTS price_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date     DATE NOT NULL,
  property_type   property_type NOT NULL DEFAULT 'hostel',  -- enum ya existe
  base_price      NUMERIC(10,2) NOT NULL,
  final_price     NUMERIC(10,2) NOT NULL,
  occ_factor      NUMERIC(5,4) NOT NULL DEFAULT 1,
  prox_factor     NUMERIC(5,4) NOT NULL DEFAULT 1,
  dow_factor      NUMERIC(5,4) NOT NULL DEFAULT 1,
  event_factor    NUMERIC(5,4) NOT NULL DEFAULT 1,
  event_name      VARCHAR(200),                             -- evento aplicado si hay
  occupancy_pct   NUMERIC(5,2),                            -- ocupación al momento del cálculo
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_date, property_type)
);

CREATE INDEX IF NOT EXISTS idx_price_cache_date
  ON price_cache (target_date, property_type);

COMMENT ON TABLE dynamic_pricing_config IS 'Configuración única del bot de precios dinámicos. Una sola fila, editable desde el admin.';
COMMENT ON TABLE pricing_events         IS 'Eventos con impacto en precios (Carnaval, Rock in Rio, etc). CRUD desde admin.';
COMMENT ON TABLE price_cache            IS 'Precios pre-calculados por el bot nightly. Se lee en el motor de reservas.';
