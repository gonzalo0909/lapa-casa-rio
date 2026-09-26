-- 0039_remove_carnival.sql
--
-- Elimina toda la lógica de Carnaval: rate_plan, carnival_dates en system_config,
-- y la referencia en get_season_type(). La temporada 'alta' absorbe febrero.

DELETE FROM rate_plans WHERE season_type = 'carnaval';

DELETE FROM system_config WHERE key = 'carnival_dates';

-- Redefine get_season_type() sin el bloque de Carnaval.
-- La función sigue siendo STABLE (no IMMUTABLE) porque lee rate_plans.
CREATE OR REPLACE FUNCTION get_season_type(p_date DATE)
RETURNS season_type AS $$
DECLARE
  v_month INT;
BEGIN
  v_month := EXTRACT(MONTH FROM p_date);

  -- Alta: diciembre (12), enero (1), febrero (2), julio (7), agosto (8)
  IF v_month IN (12, 1, 2, 7, 8) THEN
    RETURN 'alta';
  END IF;

  -- Baja: junio (6), septiembre (9)
  IF v_month IN (6, 9) THEN
    RETURN 'baja';
  END IF;

  -- Media: el resto (3, 4, 5, 10, 11)
  RETURN 'media';
END;
$$ LANGUAGE plpgsql STABLE;
