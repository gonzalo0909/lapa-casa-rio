-- 0045_special_period_rules.sql
--
-- Reglas de "período especial": para un rango de fechas puntual (ej. un
-- feriado) el huésped puede reservar la habitación, pero con una cantidad
-- mínima de noches obligatoria y un precio por noche fijo para ese rango
-- -- reemplaza el precio de temporada normal (calculate_final_price /
-- rate_plans) mientras dure la regla.
--
-- Por qué una tabla nueva y no rate_plans/pricing_events existentes:
-- rate_plans es global por season_type (no por habitación ni por rango de
-- fechas puntual); pricing_events es solo un % de ajuste, sin mínimo de
-- noches, y ni pricing_events ni room_blocks.special_price se leen desde
-- ningún lado del motor de precios real (calculate_final_price/
-- pricing-service.ts) -- quedaron como paneles sueltos sin conectar.
-- Esta tabla sí se lee desde ahí (ver 0046).

CREATE TABLE IF NOT EXISTS special_period_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id   UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  min_nights     SMALLINT NOT NULL CHECK (min_nights > 0),
  price_per_night NUMERIC(10,2) NOT NULL CHECK (price_per_night > 0),
  label          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_special_period_rules_room_dates
  ON special_period_rules (room_type_id, start_date, end_date);

-- Devuelve la regla vigente (si hay) para una habitación en un check-in
-- dado -- se ancla al check-in igual que get_season_type/calculate_final_price,
-- no prorratea por noche.
CREATE OR REPLACE FUNCTION get_special_period_rule(p_room_type_id UUID, p_check_in DATE)
RETURNS TABLE(min_nights SMALLINT, price_per_night NUMERIC, label TEXT)
LANGUAGE sql STABLE AS $$
  SELECT spr.min_nights, spr.price_per_night, spr.label
  FROM special_period_rules spr
  WHERE spr.room_type_id = p_room_type_id
    AND spr.start_date <= p_check_in AND spr.end_date > p_check_in
  ORDER BY spr.created_at DESC
  LIMIT 1;
$$;
