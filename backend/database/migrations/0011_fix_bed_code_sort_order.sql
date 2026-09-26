-- 0011_fix_bed_code_sort_order.sql
--
-- check_availability() ordenaba "ORDER BY rt.code, b.bed_code" como texto
-- plano: eso pone "A10", "A11", "A12" antes que "A2".."A9" (orden
-- lexicografico, no numerico), lo que rompia dos cosas que dependen del
-- orden real de las camas: el agrupamiento en treliches de a 3 en el
-- selector manual del frontend, y la preseleccion de "las primeras N
-- camas libres" (terminaba eligiendo A1, A10, A11 en vez de A1, A2, A3).
--
-- Se reemplaza por un orden natural: prefijo de letras + numero, ambos
-- extraidos del propio bed_code (no hace falta una columna nueva).

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
  ORDER BY
    rt.code,
    regexp_replace(b.bed_code, '[0-9]+$', ''),
    NULLIF(regexp_replace(b.bed_code, '^[^0-9]*', ''), '')::INT;
$$ LANGUAGE sql STABLE;
