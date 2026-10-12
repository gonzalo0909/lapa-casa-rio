-- 0070: el hostel deja de bloquear los feriados por default. Se borran los bloqueos de feriado de las
-- habitaciones del hostel (los sembrados por 0043 y los creados con "Bloquear feriado" del admin, que se llaman
-- "<feriado> <año>"), EXCEPTO Carnaval y Réveillon, que siguen bloqueados.
--
-- No toca: apartamentos, bloqueos manuales con otro motivo, los llamados solo "Feriado" (no se sabe de que
-- feriado son), ni reservas. check_availability lee room_blocks en cada consulta, asi que las fechas se abren solas
-- (la cache de disponibilidad dura 60 s).

DO $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM room_blocks rb
  USING room_types rt
  WHERE rt.id = rb.room_type_id
    AND rt.property_type = 'hostel'
    AND rb.reason ~ '^(Ano Novo|Semana Santa|Tiradentes|Dia do Trabalho|Día del Trabajo|Corpus Christi|Independência|N\.S\. Aparecida|Finados|Proclamação da República|Consciência Negra|Natal) [0-9]{4}$';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE '0070: % bloqueos de feriado del hostel eliminados (Carnaval y Réveillon se conservan)', v_deleted;
END $$;
