-- 0041_fix_carnival_holiday_dates.sql
--
-- apartment_holiday_periods() (0039) tenía los feriados móviles de Carnaval
-- corridos un día respecto al resto del sistema (frontend/backend usan
-- easter-50/-49/-48/-47 para sábado/domingo/lunes/martes de Carnaval).
-- Se corrige el offset para que el bloqueo caiga en las fechas reales.

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
    easter - 50,   -- Carnaval: sábado
    easter - 49,   -- Carnaval: domingo
    easter - 48,   -- Carnaval: segunda-feira
    easter - 47,   -- Carnaval: terça-feira
    easter - 46,   -- Quarta-feira de Cinzas
    easter -  2,   -- Sexta-feira Santa
    easter         -- Páscoa (domingo)
  ];
BEGIN
  FOREACH h IN ARRAY holidays LOOP
    RETURN QUERY SELECT h - 7, h + 8;
  END LOOP;
END;
$$;
