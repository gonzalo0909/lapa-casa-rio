-- 0069: recordar de qué habitación era una reserva al cancelarla.
-- Al cancelar (o marcar no_show) el trigger fn_release_beds_on_status_change borra sus reservation_beds, y
-- `reservations` no tiene room_type_id: después de cancelada ya no se sabia a que habitacion pertenecia.
-- Eso dejaba muerta la deteccion de "eco" de iCal (ical-service.isRecentCancellationEcho), que necesita saber
-- que habitacion libero una cancelacion reciente. Se guarda en cancelled_room_type_id justo antes de borrar las camas.
-- Las canceladas anteriores a esta migracion quedan en NULL (sus camas ya no existen): no cuentan como eco.
-- Idempotente.
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS cancelled_room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION fn_release_beds_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'no_show') AND OLD.status NOT IN ('cancelled', 'no_show') THEN
    UPDATE reservations
       SET cancelled_room_type_id = (SELECT rb.room_type_id FROM reservation_beds rb WHERE rb.reservation_id = NEW.id LIMIT 1)
     WHERE id = NEW.id;
    DELETE FROM reservation_beds WHERE reservation_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
