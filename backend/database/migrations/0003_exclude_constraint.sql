-- 0003_exclude_constraint.sql
-- Lapa Casa Hostel - Channel Manager
--
-- REQUISITO CRITICO #1: garantia anti-overbooking, autoridad final.
--
-- Un constraint EXCLUDE USING gist garantiza, a nivel del motor de
-- Postgres, que dos filas de reservation_beds jamas pueden coexistir
-- para la misma cama con rangos de fechas superpuestos -- sin importar
-- que el trigger de la migracion 0006 tenga un bug, que la funcion de
-- aplicacion tenga una condicion de carrera, o que alguien inserte por
-- fuera de los canales esperados. btree_gist permite combinar la
-- comparacion de igualdad (bed_id) con la comparacion de solapamiento de
-- rango (daterange) en un unico indice GiST.
--
-- daterange(check_in, check_out, '[)') usa el rango semiabierto estandar
-- de hoteleria: el dia de check-out no cuenta como noche ocupada, por lo
-- que una reserva que hace check-out el dia X y otra que hace check-in
-- ese mismo dia X no se consideran superpuestas.
ALTER TABLE reservation_beds
  ADD CONSTRAINT no_overlapping_bed_assignments
  EXCLUDE USING gist (
    bed_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  );
