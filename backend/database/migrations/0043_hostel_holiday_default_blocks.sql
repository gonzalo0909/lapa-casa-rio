-- 0043_hostel_holiday_default_blocks.sql
--
-- 0042 sembró el bloqueo por default de feriados solo para apartamentos
-- (apartment_holiday_periods() nunca había cubierto al hostel -- las
-- habitaciones jamás tuvieron un bloqueo automático de feriados). Esta
-- migración aplica el mismo default a las 5 habitaciones del hostel:
-- una fila de room_blocks por habitación por cada feriado del año actual
-- y el que viene, mismo rango ±7 días y mismos nombres que
-- getHolidayBlockPresets() (brazil-holidays.ts) y el botón "Bloquear
-- todo" del admin -- check_availability (0016) ya lee room_blocks para
-- el hostel, así que alcanza con sembrar las filas.
--
-- Para años futuros hay que repetir esto desde el admin (botón "Bloquear
-- todo", alcance "Todos") hasta que exista un job recurrente.

DO $$
DECLARE
  v_year    int;
  v_easter  date;
  v_holiday RECORD;
  v_room    RECORD;
BEGIN
  FOR v_year IN EXTRACT(YEAR FROM CURRENT_DATE)::int .. EXTRACT(YEAR FROM CURRENT_DATE)::int + 1 LOOP
    v_easter := easter_date(v_year);

    FOR v_holiday IN
      SELECT * FROM (VALUES
        ('Ano Novo '                    || v_year, make_date(v_year, 1, 1)  - 7, make_date(v_year, 1, 1)  + 7),
        ('Carnaval '                    || v_year, (v_easter - 50)          - 7, (v_easter - 47)          + 7),
        ('Semana Santa '                || v_year, (v_easter -  2)          - 7, v_easter                 + 7),
        ('Tiradentes '                  || v_year, make_date(v_year, 4, 21) - 7, make_date(v_year, 4, 21) + 7),
        ('Día del Trabajo '             || v_year, make_date(v_year, 5, 1)  - 7, make_date(v_year, 5, 1)  + 7),
        ('Corpus Christi '              || v_year, (v_easter + 60)          - 7, (v_easter + 60)          + 7),
        ('Independência '               || v_year, make_date(v_year, 9, 7)  - 7, make_date(v_year, 9, 7)  + 7),
        ('N.S. Aparecida '              || v_year, make_date(v_year, 10, 12) - 7, make_date(v_year, 10, 12) + 7),
        ('Finados '                     || v_year, make_date(v_year, 11, 2)  - 7, make_date(v_year, 11, 2)  + 7),
        ('Proclamação da República '    || v_year, make_date(v_year, 11, 15) - 7, make_date(v_year, 11, 15) + 7),
        ('Consciência Negra '           || v_year, make_date(v_year, 11, 20) - 7, make_date(v_year, 11, 20) + 7),
        ('Natal '                       || v_year, make_date(v_year, 12, 25) - 7, make_date(v_year, 12, 25) + 7),
        ('Réveillon '                   || v_year, make_date(v_year, 12, 31) - 7, make_date(v_year, 12, 31) + 7)
      ) AS t(name, period_start, period_end)
    LOOP
      FOR v_room IN SELECT id FROM room_types WHERE property_type = 'hostel' LOOP
        INSERT INTO room_blocks (room_type_id, start_date, end_date, block_type, reason)
        VALUES (v_room.id, v_holiday.period_start, v_holiday.period_end, 'seasonal', v_holiday.name);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
