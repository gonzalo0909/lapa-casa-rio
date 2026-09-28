-- 0008_fix_integer_params.sql
-- Lapa Casa Hostel - Channel Manager
--
-- Los parametros SMALLINT en calculate_group_discount, calculate_final_price
-- y calculate_deposit causaban "function does not exist" al invocarlas desde
-- Node.js: el driver pg envia enteros JS como INTEGER (int4), no como
-- SMALLINT (int2). CREATE OR REPLACE no cambia la firma, hay que DROP + CREATE.

DROP FUNCTION IF EXISTS calculate_group_discount(SMALLINT);
DROP FUNCTION IF EXISTS calculate_final_price(NUMERIC, SMALLINT, SMALLINT, DATE, DATE);
DROP FUNCTION IF EXISTS calculate_deposit(NUMERIC, SMALLINT);

CREATE OR REPLACE FUNCTION calculate_group_discount(p_beds INTEGER)
RETURNS NUMERIC AS $$
  SELECT CASE
    WHEN p_beds >= 26 THEN 0.20
    WHEN p_beds >= 16 THEN 0.15
    WHEN p_beds >= 7  THEN 0.10
    ELSE 0.00
  END;
$$ LANGUAGE sql IMMUTABLE;

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
  v_group_discount NUMERIC;
  v_early_bird_discount NUMERIC;
  v_after_season NUMERIC;
  v_after_group NUMERIC;
  v_final NUMERIC;
BEGIN
  v_subtotal := p_base_price * p_nights * p_beds;
  v_season_multiplier := calculate_season_multiplier(p_check_in);
  v_group_discount := calculate_group_discount(p_beds);
  v_early_bird_discount := calculate_early_bird_discount(p_booking_date, p_check_in);

  v_after_season := v_subtotal * v_season_multiplier;
  v_after_group := v_after_season * (1 - v_group_discount);
  v_final := v_after_group * (1 - v_early_bird_discount);

  RETURN ROUND(v_final, 2);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION calculate_deposit(p_total_price NUMERIC, p_beds INTEGER)
RETURNS TABLE (deposit_percent NUMERIC, deposit_amount NUMERIC, remaining_amount NUMERIC) AS $$
  SELECT
    CASE WHEN p_beds >= 15 THEN 0.50 ELSE 0.30 END AS deposit_percent,
    ROUND(p_total_price * (CASE WHEN p_beds >= 15 THEN 0.50 ELSE 0.30 END), 2) AS deposit_amount,
    ROUND(p_total_price * (1 - (CASE WHEN p_beds >= 15 THEN 0.50 ELSE 0.30 END)), 2) AS remaining_amount;
$$ LANGUAGE sql IMMUTABLE;
