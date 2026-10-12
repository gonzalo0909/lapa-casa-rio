-- 0073: Carnaval y Réveillon quedan bloqueados en las habitaciones del hostel para 2026-2035 (el resto de los
-- feriados se vende normal, ver 0070). Mismas fechas que getHolidayBlockPresets():
--   Carnaval: del sabado al martes (check-out el miercoles). Réveillon: la noche del 31/12.
-- Solo inserta lo que falta (no duplica los bloqueos que ya existen con el mismo motivo).
DO $$
DECLARE
  v_year   int;
  v_easter date;
  v_room   RECORD;
  v_period RECORD;
BEGIN
  FOR v_year IN 2026 .. 2035 LOOP
    v_easter := easter_date(v_year);
    FOR v_period IN
      SELECT * FROM (VALUES
        ('Carnaval '  || v_year, (v_easter - 50),           (v_easter - 47) + 1),
        ('Réveillon ' || v_year, make_date(v_year, 12, 31), make_date(v_year, 12, 31) + 1)
      ) AS t(name, period_start, period_end)
    LOOP
      FOR v_room IN SELECT id FROM room_types WHERE property_type = 'hostel' LOOP
        INSERT INTO room_blocks (room_type_id, start_date, end_date, block_type, reason)
        SELECT v_room.id, v_period.period_start, v_period.period_end, 'seasonal', v_period.name
        WHERE NOT EXISTS (
          SELECT 1 FROM room_blocks rb WHERE rb.room_type_id = v_room.id AND rb.reason = v_period.name
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
