-- 0049_fix_holiday_default_blocks_dates.sql
--
-- 0042/0043 sembraron el bloqueo por default de feriados con un margen de
-- ±7 días alrededor de cada fecha (ej. Proclamação da República, en
-- realidad un solo día -- 15/11 --, quedaba bloqueada del 08/11 al 22/11).
-- Eso nunca coincidió con getHolidayBlockPresets() (brazil-holidays.ts),
-- que sí usa la fecha real del feriado (o el tramo real para Carnaval/
-- Semana Santa/Réveillon) -- la misma función que arma el combo "Bloquear
-- feriado" en /owner y el preset del admin. El dueño terminaba viendo
-- bloqueados 14+ días por un feriado de un día.
--
-- Esta migración angosta esas filas ya sembradas a la fecha real, la
-- misma que devuelve getHolidayBlockPresets(). Es un UPDATE por
-- (block_type, reason) -- nunca un INSERT -- para no resucitar un
-- bloqueo que el dueño ya haya borrado a mano.

DO $$
DECLARE
  v_year    int;
  v_easter  date;
  v_holiday RECORD;
BEGIN
  -- Rango generoso: cubre cualquier año que 0042/0043 hayan sembrado en
  -- distintos deploys, sin depender de CURRENT_DATE (que ya avanzó).
  FOR v_year IN 2024 .. 2030 LOOP
    v_easter := easter_date(v_year);

    FOR v_holiday IN
      SELECT * FROM (VALUES
        ('Ano Novo '                    || v_year, make_date(v_year, 1, 1),   make_date(v_year, 1, 1)   + 1),
        ('Carnaval '                    || v_year, (v_easter - 50),           (v_easter - 47)           + 1),
        ('Semana Santa '                || v_year, (v_easter -  2),           v_easter                  + 1),
        ('Tiradentes '                  || v_year, make_date(v_year, 4, 21),  make_date(v_year, 4, 21)  + 1),
        ('Día del Trabajo '             || v_year, make_date(v_year, 5, 1),   make_date(v_year, 5, 1)   + 1),
        ('Corpus Christi '              || v_year, (v_easter + 60),           (v_easter + 60)           + 1),
        ('Independência '               || v_year, make_date(v_year, 9, 7),   make_date(v_year, 9, 7)   + 1),
        ('N.S. Aparecida '              || v_year, make_date(v_year, 10, 12), make_date(v_year, 10, 12) + 1),
        ('Finados '                     || v_year, make_date(v_year, 11, 2),  make_date(v_year, 11, 2)  + 1),
        ('Proclamação da República '    || v_year, make_date(v_year, 11, 15), make_date(v_year, 11, 15) + 1),
        ('Consciência Negra '           || v_year, make_date(v_year, 11, 20), make_date(v_year, 11, 20) + 1),
        ('Natal '                       || v_year, make_date(v_year, 12, 25), make_date(v_year, 12, 25) + 1),
        ('Réveillon '                   || v_year, make_date(v_year, 12, 31), make_date(v_year, 12, 31) + 1)
      ) AS t(name, real_start, real_end)
    LOOP
      UPDATE room_blocks
      SET start_date = v_holiday.real_start,
          end_date   = v_holiday.real_end
      WHERE block_type = 'seasonal'
        AND reason = v_holiday.name
        AND (start_date <> v_holiday.real_start OR end_date <> v_holiday.real_end);
    END LOOP;
  END LOOP;
END $$;
