-- 0009_room_group_discount.sql
-- Lapa Casa Hostel - Channel Manager
--
-- El descuento por grupo (calculate_group_discount) era una politica fija
-- en SQL (7/16/26 camas -> 10/15/20%, IMMUTABLE), igual para cualquier
-- cuarto. El dueno pidio que el descuento sea por cuarto (para incentivar
-- llenar un cuarto puntual, ej. 3-7 camas para el Mixto 7, 3-12 para el
-- Mixto 12A) y editable a mano desde el admin -- sin un 20% automatico
-- fijo. Se sigue el mismo patron ya usado por rate_plans (temporadas):
-- datos en una tabla real, funcion SQL que lee de ahi (STABLE, no
-- IMMUTABLE), editable sin tocar codigo.

ALTER TABLE room_types
  ADD COLUMN group_discount_min_beds SMALLINT NOT NULL DEFAULT 3
    CHECK (group_discount_min_beds > 0),
  ADD COLUMN group_discount_percentage NUMERIC(4,3) NOT NULL DEFAULT 0.10
    CHECK (group_discount_percentage >= 0 AND group_discount_percentage < 1);

-- Precios iniciales acordados con el dueno: el cuarto de 12 siempre mas
-- barato por cama que el de 7 (regla de negocio manual, no calculada).
-- Editable en cualquier momento desde /admin/rooms.html.
UPDATE room_types SET base_price = 55.00 WHERE code IN ('mixto_12a', 'mixto_12b');
UPDATE room_types SET base_price = 65.00 WHERE code IN ('mixto_7', 'mixto_7c', 'flexible_7');

DROP FUNCTION IF EXISTS calculate_group_discount(INTEGER);
DROP FUNCTION IF EXISTS calculate_final_price(NUMERIC, INTEGER, INTEGER, DATE, DATE);

-- ============================================================
-- calculate_group_discount: ahora por cuarto, leido de room_types
-- (group_discount_min_beds / group_discount_percentage). STABLE porque
-- depende de datos de tabla, no de una politica fija en el codigo.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_group_discount(p_room_type_id UUID, p_beds INTEGER)
RETURNS NUMERIC AS $$
  SELECT CASE
    WHEN p_beds >= group_discount_min_beds THEN group_discount_percentage
    ELSE 0.00
  END
  FROM room_types WHERE id = p_room_type_id;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- calculate_final_price: mismo orden de calculo que antes (temporada,
-- descuento por grupo, early bird), agrega p_room_type_id para poder
-- resolver el descuento de ESE cuarto puntual.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_final_price(
  p_room_type_id UUID,
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
  v_group_discount NUMERIC;
  v_early_bird_discount NUMERIC;
  v_after_season NUMERIC;
  v_after_group NUMERIC;
  v_final NUMERIC;
BEGIN
  v_subtotal := p_base_price * p_nights * p_beds;
  v_season_multiplier := calculate_season_multiplier(p_check_in);
  v_group_discount := calculate_group_discount(p_room_type_id, p_beds);
  v_early_bird_discount := calculate_early_bird_discount(p_booking_date, p_check_in);

  v_after_season := v_subtotal * v_season_multiplier;
  v_after_group := v_after_season * (1 - v_group_discount);
  v_final := v_after_group * (1 - v_early_bird_discount);

  RETURN ROUND(v_final, 2);
END;
$$ LANGUAGE plpgsql STABLE;
