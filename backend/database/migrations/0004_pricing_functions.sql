-- 0004_pricing_functions.sql
-- Lapa Casa Hostel - Channel Manager
--
-- REQUISITO CRITICO #6: estas funciones son la UNICA implementacion de
-- las reglas de negocio de pricing. Los servicios Node (Ventana 2) las
-- invocan via $queryRaw, nunca las reimplementan en JavaScript.
--
-- Volatilidad: STABLE para las que leen system_config/rate_plans/channels
-- (el resultado puede cambiar si cambian esas tablas, pero no dentro de
-- una misma sentencia/snapshot); IMMUTABLE para las que son aritmetica
-- pura sin lectura de tablas.

-- ============================================================
-- brt_midnight: convierte una fecha de calendario a su instante exacto
-- de medianoche en America/Sao_Paulo, expresado como TIMESTAMPTZ (un
-- instante absoluto). Es la base para toda regla que depende de "la
-- fecha X en la zona horaria operativa" (no-show, conversion Flexible 7,
-- ventanas de cancelacion medidas en horas antes del check-in).
--
-- Nota sobre timeouts puros por duracion (ej. el timeout de pago de 15
-- minutos): al ser TIMESTAMPTZ un instante absoluto, "ahora + 15 minutos"
-- es el mismo instante sin importar la zona horaria -- no requieren pasar
-- por esta funcion. brt_midnight() es necesaria especificamente para
-- reglas ancladas a un limite de calendario (medianoche de una fecha
-- especifica, "48h antes del check-in de la fecha X").
-- ============================================================
CREATE OR REPLACE FUNCTION brt_midnight(p_date DATE)
RETURNS TIMESTAMPTZ AS $$
  SELECT (p_date::timestamp AT TIME ZONE 'America/Sao_Paulo');
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================
-- get_season_type: determina la temporada de una fecha. Carnaval se lee
-- desde system_config (fechas moviles, ver alerta de mantenimiento anual
-- en Ventana 6) -- por eso es STABLE y no IMMUTABLE.
-- ============================================================
CREATE OR REPLACE FUNCTION get_season_type(p_date DATE)
RETURNS season_type AS $$
DECLARE
  v_carnival_periods JSONB;
  v_period JSONB;
  v_month INT;
BEGIN
  SELECT value INTO v_carnival_periods FROM system_config WHERE key = 'carnival_dates';

  IF v_carnival_periods IS NOT NULL THEN
    FOR v_period IN SELECT * FROM jsonb_array_elements(v_carnival_periods) LOOP
      IF p_date BETWEEN (v_period->>'start_date')::date AND (v_period->>'end_date')::date THEN
        RETURN 'carnaval';
      END IF;
    END LOOP;
  END IF;

  v_month := EXTRACT(MONTH FROM p_date);

  IF v_month IN (12, 1, 2, 3) THEN
    RETURN 'alta';
  ELSIF v_month IN (4, 5, 10, 11) THEN
    RETURN 'media';
  ELSE
    RETURN 'baja';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- calculate_season_multiplier: multiplicador de temporada para la fecha
-- de check-in (el Maestro usa un unico multiplicador por reserva, basado
-- en la fecha de check-in, no un prorrateo noche a noche).
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_season_multiplier(p_check_in DATE)
RETURNS NUMERIC AS $$
  SELECT multiplier FROM rate_plans WHERE season_type = get_season_type(p_check_in);
$$ LANGUAGE sql STABLE;

-- ============================================================
-- get_min_nights: minimo de noches exigido segun la temporada de la
-- fecha de check-in (Alta 3, Media 2, Baja 1, Carnaval 5 obligatorio).
-- ============================================================
CREATE OR REPLACE FUNCTION get_min_nights(p_check_in DATE)
RETURNS SMALLINT AS $$
  SELECT min_nights FROM rate_plans WHERE season_type = get_season_type(p_check_in);
$$ LANGUAGE sql STABLE;

-- ============================================================
-- calculate_group_discount: tramos fijos de descuento por tamano de
-- grupo (7-15: 10%, 16-25: 15%, 26+: 20%). Politica fija del negocio, no
-- depende de configuracion dinamica -> IMMUTABLE.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_group_discount(p_beds SMALLINT)
RETURNS NUMERIC AS $$
  SELECT CASE
    WHEN p_beds >= 26 THEN 0.20
    WHEN p_beds >= 16 THEN 0.15
    WHEN p_beds >= 7  THEN 0.10
    ELSE 0.00
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================
-- calculate_early_bird_discount: 5% si la reserva se hace con 30+ dias
-- de anticipacion sobre el check-in. Aritmetica pura -> IMMUTABLE.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_early_bird_discount(p_booking_date DATE, p_check_in DATE)
RETURNS NUMERIC AS $$
  SELECT CASE WHEN (p_check_in - p_booking_date) >= 30 THEN 0.05 ELSE 0.00 END;
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================
-- calculate_final_price: orden exacto de calculo (Maestro, seccion
-- "REGLAS DE NEGOCIO"):
--   1. precio_base x noches x camas
--   2. x multiplicador de temporada
--   3. - descuento por grupo
--   4. - early bird
--   5. = precio final que paga el huesped (igual en todos los canales)
-- La comision de canal NUNCA entra en este calculo.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_final_price(
  p_base_price NUMERIC,
  p_nights SMALLINT,
  p_beds SMALLINT,
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

-- ============================================================
-- calculate_channel_net_revenue: ingreso neto del hostel despues de la
-- comision del canal. Se calcula APARTE, solo para reportes/libros
-- internos. Nunca se usa para fijar lo que paga el huesped (paridad de
-- tarifas entre canales).
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_channel_net_revenue(p_guest_price NUMERIC, p_channel_id UUID)
RETURNS NUMERIC AS $$
  SELECT ROUND(p_guest_price * (1 - commission_rate), 2)
  FROM channels
  WHERE id = p_channel_id;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- calculate_deposit: 30% estandar, 50% para grupos de 15+ camas.
-- Politica fija -> IMMUTABLE. Devuelve deposito y saldo restante.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_deposit(p_total_price NUMERIC, p_beds SMALLINT)
RETURNS TABLE (deposit_percent NUMERIC, deposit_amount NUMERIC, remaining_amount NUMERIC) AS $$
  SELECT
    CASE WHEN p_beds >= 15 THEN 0.50 ELSE 0.30 END AS deposit_percent,
    ROUND(p_total_price * (CASE WHEN p_beds >= 15 THEN 0.50 ELSE 0.30 END), 2) AS deposit_amount,
    ROUND(p_total_price * (1 - (CASE WHEN p_beds >= 15 THEN 0.50 ELSE 0.30 END)), 2) AS remaining_amount;
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================
-- calculate_cancellation_refund: monto a reembolsar segun la politica
-- de cancelacion vigente en cancellation_policies, en funcion de cuantas
-- horas faltan para el check-in en el momento de cancelar. No aparece
-- nombrada explicitamente en la lista de REQUISITO CRITICO #6, pero se
-- agrega aca por el mismo motivo: es una regla de negocio con tramos
-- fijos (100%/50%/0%) que no debe reimplementarse en JS.
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_cancellation_refund(
  p_final_price NUMERIC,
  p_check_in DATE,
  p_cancel_at TIMESTAMPTZ
)
RETURNS NUMERIC AS $$
DECLARE
  v_hours_before NUMERIC;
  v_refund_percent NUMERIC;
BEGIN
  v_hours_before := EXTRACT(EPOCH FROM (brt_midnight(p_check_in) - p_cancel_at)) / 3600;

  SELECT refund_percent INTO v_refund_percent
  FROM cancellation_policies
  WHERE min_hours_before <= v_hours_before
  ORDER BY min_hours_before DESC
  LIMIT 1;

  RETURN ROUND(p_final_price * COALESCE(v_refund_percent, 0), 2);
END;
$$ LANGUAGE plpgsql STABLE;
