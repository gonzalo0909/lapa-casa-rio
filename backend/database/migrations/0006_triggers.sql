-- 0006_triggers.sql
-- Lapa Casa Hostel - Channel Manager
--
-- REQUISITO CRITICO #1, jerarquia de mecanismos, capa 3: triggers de
-- verificacion como backstop de defensa en profundidad, redundantes a
-- proposito con la verificacion que hace la capa de aplicacion (Ventana
-- 2) antes del INSERT. El EXCLUDE constraint (migracion 0003) sigue
-- siendo la autoridad final aunque este trigger tenga un bug.

-- ============================================================
-- trg_prevent_overbooking: verificacion explicita antes del INSERT en
-- reservation_beds. Da un mensaje de error claro y falla ANTES de
-- llegar al EXCLUDE constraint en el caso comun; si este trigger tuviera
-- un bug o fuera deshabilitado, el EXCLUDE constraint igual rechaza el
-- INSERT (ver test de "bypass del trigger" en los escenarios de prueba).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_prevent_overbooking()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
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

CREATE TRIGGER trg_prevent_overbooking
  BEFORE INSERT ON reservation_beds
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_overbooking();

-- ============================================================
-- trg_release_beds_on_status_change: mecanismo de liberacion real
-- (REQUISITO CRITICO #1, punto 6). Cuando una reserva pasa a 'cancelled'
-- o 'no_show', se borran sus filas de reservation_beds -- esto es lo que
-- efectivamente libera la cama a nivel del EXCLUDE constraint (si la
-- fila quedara viva con la reserva cancelada, seguiria bloqueando la
-- cama para nuevas reservas aunque el estado diga "cancelada").
-- Se dispara sin importar que codigo cambio el estado (procedimiento
-- programado, panel admin via Node, webhook de OTA), porque es un
-- trigger sobre la tabla, no una funcion que haya que recordar llamar.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_release_beds_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'no_show') AND OLD.status NOT IN ('cancelled', 'no_show') THEN
    DELETE FROM reservation_beds WHERE reservation_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_release_beds_on_status_change
  AFTER UPDATE OF status ON reservations
  FOR EACH ROW EXECUTE FUNCTION fn_release_beds_on_status_change();

-- ============================================================
-- fn_set_updated_at: trigger generico de mantenimiento, aplicado a las
-- tablas que tienen columna updated_at.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_updated_at_room_types BEFORE UPDATE ON room_types FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at_beds BEFORE UPDATE ON beds FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at_rate_plans BEFORE UPDATE ON rate_plans FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at_channels BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at_guests BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at_reservations BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at_payments BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at_cancellation_policies BEFORE UPDATE ON cancellation_policies FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_set_updated_at_system_config BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
