-- 0016_room_blocks.sql
--
-- Bloqueo manual de fechas por habitación (mantenimiento/evento privado).
-- date-blocker.ts ya existía pero nunca estuvo conectado a ninguna ruta,
-- y además apuntaba a una tabla "rooms" y una columna "beds.room_id" que
-- no existen (es room_types / beds.room_type_id) -- quedó corregido en el
-- mismo commit. Se usa una tabla propia en vez de system_config: un
-- listado de bloqueos con rango de fechas necesita índice y CHECK real,
-- no un blob JSONB por fila con parsing manual.
--
-- check_availability (0005) se actualiza para que un bloqueo también
-- vuelva la cama no disponible -- si no, el bloqueo sería cosmético (el
-- admin lo vería en el panel pero un huésped podría igual reservarla).
-- is_occupied se deja SIN tocar (sigue significando "tiene una reserva
-- real"), solo is_available pasa a considerar los bloqueos.

CREATE TABLE room_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id  UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  block_type    VARCHAR(20) NOT NULL DEFAULT 'other',
  reason        TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

CREATE INDEX idx_room_blocks_room_dates ON room_blocks(room_type_id, start_date, end_date);

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
  ORDER BY rt.code, b.bed_code;
$$ LANGUAGE sql STABLE;
