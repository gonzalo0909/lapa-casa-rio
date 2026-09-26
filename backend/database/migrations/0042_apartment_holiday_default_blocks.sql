-- 0042_apartment_holiday_default_blocks.sql
--
-- Hasta acá, los apartamentos se bloqueaban en feriados vía
-- apartment_holiday_periods() (0039/0041): una regla fija en las queries
-- de disponibilidad, igual para todos los apartamentos y sin forma de
-- editarla por unidad. Se reemplaza por el mismo mecanismo que ya usan
-- las habitaciones del hostel -- filas en room_blocks, editables por el
-- dueño de cada apartamento desde /owner (owner-apartments.routes.ts ya
-- expone GET/POST/DELETE .../blocks) -- así el bloqueo de feriados queda
-- "bloqueado por default, pero el dueño lo puede sacar" en vez de fijo.
--
-- Esta migración siembra ese default: una fila de room_blocks por
-- apartamento existente por cada feriado del año actual y el que viene,
-- con el mismo rango ±7 días y los mismos nombres que calcula
-- getHolidayBlockPresets() (brazil-holidays.ts) y que usa el botón
-- "Bloquear todo" del admin -- para años futuros hay que repetir esto a
-- mano (desde el admin, con ese mismo botón) hasta que exista un job
-- recurrente.
--
-- apartment-availability.ts y create-apartment-booking.ts ya se
-- actualizaron en el mismo commit para dejar de llamar
-- apartment_holiday_periods() y confiar solo en room_blocks -- easter_date()
-- y apartment_holiday_periods() quedan sin uso pero no se borran (no
-- estorban, y borrar una función usada hasta hace un commit es más riesgo
-- del que vale).

DO $$
DECLARE
  v_year    int;
  v_easter  date;
  v_holiday RECORD;
  v_apt     RECORD;
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
      FOR v_apt IN SELECT id FROM room_types WHERE property_type = 'apartment' LOOP
        INSERT INTO room_blocks (room_type_id, start_date, end_date, block_type, reason)
        VALUES (v_apt.id, v_holiday.period_start, v_holiday.period_end, 'seasonal', v_holiday.name);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
