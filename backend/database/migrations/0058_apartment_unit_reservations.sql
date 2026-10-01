-- 0058: los apartamentos se reservan como unidad completa, sin camas.
--
-- Antes un apartamento necesitaba una fila en `beds` y cada reserva (directa
-- o importada por iCal/OTA) ocupaba esa "cama unica" via reservation_beds.
-- Ahora reservation_beds guarda tambien `room_type_id`; las reservas de
-- apartamento tienen bed_id NULL y se bloquean por (room_type_id, fechas).
-- El hostel no cambia: sigue usando bed_id, y room_type_id se completa solo
-- (trigger) a partir de la cama.

ALTER TABLE reservation_beds
  ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id) ON DELETE RESTRICT;

UPDATE reservation_beds rb
   SET room_type_id = b.room_type_id
  FROM beds b
 WHERE b.id = rb.bed_id AND rb.room_type_id IS NULL;

CREATE OR REPLACE FUNCTION fn_reservation_beds_fill_room_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bed_id IS NOT NULL THEN
    SELECT b.room_type_id INTO NEW.room_type_id FROM beds b WHERE b.id = NEW.bed_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Prefijo "a" para que corra antes de trg_prevent_overbooking (los triggers
-- BEFORE se ejecutan en orden alfabetico).
DROP TRIGGER IF EXISTS trg_a_reservation_beds_fill_room_type ON reservation_beds;
CREATE TRIGGER trg_a_reservation_beds_fill_room_type
  BEFORE INSERT OR UPDATE OF bed_id ON reservation_beds
  FOR EACH ROW EXECUTE FUNCTION fn_reservation_beds_fill_room_type();

ALTER TABLE reservation_beds ALTER COLUMN room_type_id SET NOT NULL;
ALTER TABLE reservation_beds ALTER COLUMN bed_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION fn_prevent_overbooking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bed_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM reservation_beds rb
      WHERE rb.room_type_id = NEW.room_type_id
        AND daterange(rb.check_in, rb.check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)')
    ) THEN
      RAISE EXCEPTION 'overbooking_detected: el apartamento % ya esta ocupado entre % y %', NEW.room_type_id, NEW.check_in, NEW.check_out
        USING ERRCODE = 'unique_violation';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM reservation_beds rb
    WHERE rb.bed_id = NEW.bed_id
      AND daterange(rb.check_in, rb.check_out, '[)') && daterange(NEW.check_in, NEW.check_out, '[)')
  ) THEN
    RAISE EXCEPTION 'overbooking_detected: la cama % ya esta ocupada entre % y %', NEW.bed_id, NEW.check_in, NEW.check_out
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reservas de apartamento existentes: pasan a bloqueo por unidad.
UPDATE reservation_beds rb
   SET bed_id = NULL
  FROM room_types rt
 WHERE rt.id = rb.room_type_id AND rt.property_type = 'apartment' AND rb.bed_id IS NOT NULL;

-- Autoridad final anti-overbooking para unidades (equivalente a 0003 para camas).
ALTER TABLE reservation_beds
  ADD CONSTRAINT no_overlapping_unit_assignments
  EXCLUDE USING gist (
    room_type_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (bed_id IS NULL);

-- Los apartamentos ya no tienen camas: se borran las que existan, salvo las
-- que aun referencie algun otro registro (conflictos, pagos de grupo).
DELETE FROM beds b
 USING room_types rt
 WHERE rt.id = b.room_type_id
   AND rt.property_type = 'apartment'
   AND NOT EXISTS (SELECT 1 FROM reservation_beds rb WHERE rb.bed_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM booking_conflicts bc WHERE bc.bed_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM group_payment_members gm WHERE gm.bed_id = b.id);

CREATE INDEX IF NOT EXISTS idx_reservation_beds_room_type ON reservation_beds(room_type_id);
