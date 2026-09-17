-- 0005_availability_and_locks.sql
-- Lapa Casa Hostel - Channel Manager
--
-- REQUISITO CRITICO #1 (verificacion en tiempo real) y REQUISITO CRITICO
-- #2 (Flexible 7 por fecha). Estas funciones son STABLE (leen el estado
-- real de las tablas) salvo acquire_bed_locks, que es VOLATILE porque
-- tiene efecto de lado: adquiere un advisory lock que persiste hasta el
-- fin de la transaccion actual (pg_advisory_xact_lock).

-- ============================================================
-- get_flexible_room_status: estado de conversion de una habitacion
-- flexible para una fecha de check-in especifica. Si ya existe un
-- registro en room_conversion_logs para esa fecha, la conversion es
-- definitiva e irreversible (REQUISITO CRITICO #2). Si no existe,
-- calcula una PREDICCION (no vinculante) de si convertiria si el
-- proceso programado corriera ahora mismo.
-- ============================================================
CREATE OR REPLACE FUNCTION get_flexible_room_status(p_room_type_id UUID, p_target_date DATE)
RETURNS TABLE (
  effective_gender      bed_gender,
  is_converted          BOOLEAN,
  converted_at          TIMESTAMPTZ,
  hours_until_checkin   NUMERIC,
  will_convert_prediction BOOLEAN
) AS $$
DECLARE
  v_default_gender bed_gender;
  v_log_row room_conversion_logs%ROWTYPE;
  v_hours_until NUMERIC;
  v_has_female_reservation BOOLEAN;
  v_conversion_hours SMALLINT;
BEGIN
  SELECT default_gender INTO v_default_gender FROM room_types WHERE id = p_room_type_id;

  SELECT * INTO v_log_row
  FROM room_conversion_logs
  WHERE room_type_id = p_room_type_id AND target_date = p_target_date;

  v_hours_until := EXTRACT(EPOCH FROM (brt_midnight(p_target_date) - now())) / 3600;

  IF FOUND THEN
    RETURN QUERY SELECT v_log_row.converted_to, true, v_log_row.converted_at, v_hours_until, NULL::BOOLEAN;
    RETURN;
  END IF;

  SELECT (value #>> '{}')::SMALLINT INTO v_conversion_hours
  FROM system_config WHERE key = 'flexible_conversion_hours';
  v_conversion_hours := COALESCE(v_conversion_hours, 48);

  SELECT EXISTS (
    SELECT 1
    FROM reservation_beds rb
    JOIN reservations r ON r.id = rb.reservation_id
    JOIN beds b ON b.id = rb.bed_id
    WHERE b.room_type_id = p_room_type_id
      AND rb.check_in = p_target_date
      AND r.guest_gender = 'female'
  ) INTO v_has_female_reservation;

  RETURN QUERY SELECT
    v_default_gender,
    false,
    NULL::TIMESTAMPTZ,
    v_hours_until,
    (NOT v_has_female_reservation AND v_hours_until <= v_conversion_hours);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- check_availability: devuelve el estado de CADA cama del hostel para
-- un rango de fechas y un genero solicitado, incluyendo elegibilidad de
-- genero. Es de solo lectura (STABLE); NO decide cuantas camas alcanzan
-- para un grupo -- eso lo hace el servicio Node (availability-service),
-- que agrega este resultado por habitacion y compara contra
-- requestedBeds (Ventana 2, REQUISITO CRITICO #6: la funcion SQL es la
-- unica fuente de verdad sobre que esta libre; la agregacion/asignacion
-- es un detalle de presentacion, no una regla de negocio nueva).
--
-- Regla de compatibilidad de genero:
--   - huesped 'female' -> puede ocupar camas 'mixed' o 'female'
--   - huesped 'male'   -> solo puede ocupar camas 'mixed'
--   - grupo 'mixed'    -> solo camas 'mixed' (no se asigna a female-only)
-- ============================================================
CREATE OR REPLACE FUNCTION check_availability(
  p_check_in DATE,
  p_check_out DATE,
  p_gender bed_gender
)
RETURNS TABLE (
  room_type_id      UUID,
  room_code         VARCHAR,
  room_name         VARCHAR,
  capacity          SMALLINT,
  effective_gender  bed_gender,
  bed_id            UUID,
  bed_code          VARCHAR,
  is_gender_eligible BOOLEAN,
  is_occupied       BOOLEAN,
  is_available      BOOLEAN
) AS $$
  SELECT
    rt.id AS room_type_id,
    rt.code AS room_code,
    rt.name AS room_name,
    rt.capacity,
    COALESCE(rcl.converted_to, rt.default_gender) AS effective_gender,
    b.id AS bed_id,
    b.bed_code,
    (
      CASE
        WHEN p_gender = 'female' THEN COALESCE(rcl.converted_to, rt.default_gender) IN ('mixed', 'female')
        WHEN p_gender = 'male'   THEN COALESCE(rcl.converted_to, rt.default_gender) = 'mixed'
        ELSE COALESCE(rcl.converted_to, rt.default_gender) = 'mixed'
      END
    ) AS is_gender_eligible,
    EXISTS (
      SELECT 1 FROM reservation_beds rb
      WHERE rb.bed_id = b.id
        AND daterange(rb.check_in, rb.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
    ) AS is_occupied,
    (
      b.is_active
      AND NOT EXISTS (
        SELECT 1 FROM reservation_beds rb
        WHERE rb.bed_id = b.id
          AND daterange(rb.check_in, rb.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
      )
    ) AS is_available
  FROM beds b
  JOIN room_types rt ON rt.id = b.room_type_id
  LEFT JOIN room_conversion_logs rcl ON rcl.room_type_id = rt.id AND rcl.target_date = p_check_in
  ORDER BY rt.code, b.bed_code;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- acquire_bed_locks: adquiere un pg_advisory_xact_lock por cada cama en
-- p_bed_ids, DENTRO de la transaccion actual (se libera solo al hacer
-- COMMIT/ROLLBACK -- no existe liberacion manual, ver lock-middleware en
-- Ventana 2). Es una OPTIMIZACION para evitar reintentos costosos bajo
-- alta contencion; el EXCLUDE constraint (migracion 0003) sigue siendo
-- la autoridad final aunque este lock nunca se llamara.
--
-- v_namespace: clave fija de namespace (classid) para todos los locks de
-- camas de este sistema, evitando colisionar con otros usos de advisory
-- locks que pudiera tener la aplicacion en el futuro (namespace de dos
-- claves: classid=v_namespace, objid=hash de cada bed_id).
--
-- Los bed_ids se ordenan antes de iterar (ORDER BY 1) para que dos
-- transacciones concurrentes que piden locks sobre el mismo conjunto de
-- camas los adquieran siempre en el mismo orden -- esto previene
-- deadlocks entre ellas.
-- ============================================================
CREATE OR REPLACE FUNCTION acquire_bed_locks(p_bed_ids UUID[])
RETURNS VOID AS $$
DECLARE
  v_bed_id UUID;
  v_namespace CONSTANT INT := 78901234;
BEGIN
  FOR v_bed_id IN SELECT unnest(p_bed_ids) ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(v_namespace, hashtext(v_bed_id::text));
  END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;
