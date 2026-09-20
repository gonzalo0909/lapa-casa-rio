-- 0047_apartment_holiday_periods.sql
--
-- Bloqueo automático de feriados para apartamentos: ±7 días alrededor de
-- cada feriado nacional brasileño (incluyendo Carnaval y Semana Santa).
--
-- Se resuelve en tiempo de consulta a partir del año solicitado, sin datos
-- que mantener: funciona para cualquier fecha futura sin intervención manual.
--
-- Funciones expuestas:
--   easter_date(year)             → fecha de Pascua (algoritmo Meeus/Jones/Butcher)
--   apartment_holiday_periods(year) → filas (period_start, period_end) por feriado

-- ── Algoritmo de Meeus/Jones/Butcher ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION easter_date(p_year int)
RETURNS date
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  a int := p_year % 19;
  b int := p_year / 100;
  c int := p_year % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7;
  m int := (a + 11 * h + 22 * l) / 451;
  month int := (h + l - 7 * m + 114) / 31;
  day   int := ((h + l - 7 * m + 114) % 31) + 1;
BEGIN
  RETURN make_date(p_year, month, day);
END;
$$;

-- ── Períodos de bloqueo por año ───────────────────────────────────────────────
-- Cada feriado genera un período [feriado − 7, feriado + 8) (exclusivo al final).
-- Los períodos que se solapan se fusionan implícitamente al evaluar la condición
-- de disponibilidad con &&.

CREATE OR REPLACE FUNCTION apartment_holiday_periods(p_year int)
RETURNS TABLE(period_start date, period_end date)
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  easter date := easter_date(p_year);
  h      date;
  holidays date[] := ARRAY[
    -- Feriados fijos
    make_date(p_year,  1,  1),   -- Ano Novo
    make_date(p_year,  1,  2),   -- Ponte post-Ano Novo
    make_date(p_year,  4, 21),   -- Tiradentes
    make_date(p_year,  5,  1),   -- Dia do Trabalho
    make_date(p_year,  9,  7),   -- Independência do Brasil
    make_date(p_year, 10, 12),   -- Nossa Senhora Aparecida
    make_date(p_year, 11,  2),   -- Finados
    make_date(p_year, 11, 15),   -- Proclamação da República
    make_date(p_year, 12, 25),   -- Natal
    make_date(p_year, 12, 28),   -- Pré-Réveillon
    make_date(p_year, 12, 29),   -- Pré-Réveillon
    make_date(p_year, 12, 30),   -- Pré-Réveillon
    make_date(p_year, 12, 31),   -- Réveillon
    -- Feriados móviles (basados en Pascua)
    easter - 51,   -- Carnaval: sábado
    easter - 50,   -- Carnaval: domingo
    easter - 49,   -- Carnaval: segunda-feira
    easter - 48,   -- Carnaval: terça-feira
    easter - 47,   -- Quarta-feira de Cinzas
    easter -  2,   -- Sexta-feira Santa
    easter         -- Páscoa (domingo)
  ];
BEGIN
  FOREACH h IN ARRAY holidays LOOP
    RETURN QUERY SELECT h - 7, h + 8;
  END LOOP;
END;
$$;
