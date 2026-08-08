-- 0010_global_group_discount_tiers.sql
-- Lapa Casa Hostel - Channel Manager
--
-- Correccion sobre 0009: el descuento por grupo no puede vivir "por
-- cuarto individual" (room_types.group_discount_*) porque el tramo de
-- 13+ personas necesariamente cruza dos cuartos (ningun cuarto tiene
-- mas de 12 camas -- 13+ implica combinar 12A+12B, o 7+7C). Evaluado
-- por cuarto, cada fila (ej. 12 camas en 12A + 1 en 12B) nunca ve el
-- total real de la reserva.
--
-- Se vuelve a un descuento global (como el original), pero ahora
-- editable en una tabla real (nunca hardcodeado) con los tramos del
-- dueno: 10% de 3 a 12 personas, 15% de 13 en adelante -- sin el 20%
-- que se saco. Se evalua sobre el total de camas de TODA la reserva,
-- no por cuarto.

ALTER TABLE room_types
  DROP COLUMN group_discount_min_beds,
  DROP COLUMN group_discount_percentage;

CREATE TABLE group_discount_tiers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_beds    SMALLINT NOT NULL UNIQUE CHECK (min_beds > 0),
  percentage  NUMERIC(4,3) NOT NULL CHECK (percentage >= 0 AND percentage < 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_set_updated_at_group_discount_tiers
  BEFORE UPDATE ON group_discount_tiers
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

INSERT INTO group_discount_tiers (min_beds, percentage) VALUES
  (3, 0.10),
  (13, 0.15);

DROP FUNCTION IF EXISTS calculate_group_discount(UUID, INTEGER);
DROP FUNCTION IF EXISTS calculate_final_price(UUID, NUMERIC, INTEGER, INTEGER, DATE, DATE);

-- ============================================================
-- calculate_group_discount: tramo mas alto cuyo min_beds sea <= al
-- total de camas de la reserva. Editable en group_discount_tiers, sin
-- valores fijos en el codigo.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_group_discount(p_beds INTEGER)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    (SELECT percentage FROM group_discount_tiers WHERE min_beds <= p_beds ORDER BY min_beds DESC LIMIT 1),
    0.00
  );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- calculate_final_price: vuelve a la firma de 0008 (sin room_type_id --
-- ya no lo necesita, el descuento de grupo no se resuelve aca adentro).
-- Aplica temporada + early bird sobre el subtotal de ESTE cuarto; el
-- descuento de grupo (que depende del total de TODA la reserva, no de
-- un cuarto) se aplica aparte, una sola vez, en pricingService.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_final_price(
  p_base_price NUMERIC,
  p_nights INTEGER,
  p_beds INTEGER,
  p_check_in DATE,
  p_booking_date DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_subtotal NUMERIC;
  v_season_multiplier NUMERIC;
  v_early_bird_discount NUMERIC;
  v_after_season NUMERIC;
  v_final NUMERIC;
BEGIN
  v_subtotal := p_base_price * p_nights * p_beds;
  v_season_multiplier := calculate_season_multiplier(p_check_in);
  v_early_bird_discount := calculate_early_bird_discount(p_booking_date, p_check_in);

  v_after_season := v_subtotal * v_season_multiplier;
  v_final := v_after_season * (1 - v_early_bird_discount);

  RETURN ROUND(v_final, 2);
END;
$$ LANGUAGE plpgsql STABLE;
