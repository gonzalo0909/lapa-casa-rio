-- 0028_fix_check_availability_bed_order.sql
--
-- FIX (auditoría 2026-08-30): 0016_room_blocks.sql redefinió
-- check_availability() copiando el ORDER BY plano de la versión de
-- 0005 en vez de la corregida en 0011_fix_bed_code_sort_order.sql,
-- reintroduciendo el orden lexicográfico (A10, A11, A12 antes que
-- A2..A9) en vez del orden natural. Como 0016 ya corrió en la base real,
-- corregir el archivo histórico no alcanza -- CREATE OR REPLACE acá
-- vuelve a dejar la función con el orden correcto sin depender de si
-- 0016 quedó (o no) marcada como aplicada en schema_migrations.
--
-- El cuerpo de la función es idéntico al de 0016 (incluye el JOIN con
-- room_blocks agregado ahí), solo cambia el ORDER BY final.

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
      AND NOT EXISTS (
        SELECT 1 FROM room_blocks rbl
        WHERE rbl.room_type_id = rt.id
          AND daterange(rbl.start_date, rbl.end_date, '[)') && daterange(p_check_in, p_check_out, '[)')
      )
    ) AS is_available
  FROM beds b
  JOIN room_types rt ON rt.id = b.room_type_id
  LEFT JOIN room_conversion_logs rcl ON rcl.room_type_id = rt.id AND rcl.target_date = p_check_in
  ORDER BY
    rt.code,
    regexp_replace(b.bed_code, '[0-9]+$', ''),
    NULLIF(regexp_replace(b.bed_code, '^[^0-9]*', ''), '')::INT;
$$ LANGUAGE sql STABLE;
