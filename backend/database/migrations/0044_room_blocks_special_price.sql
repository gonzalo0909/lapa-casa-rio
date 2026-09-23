-- 0044_room_blocks_special_price.sql
--
-- Precio especial opcional por bloqueo (room_blocks, 0016): para cuando el
-- motivo del bloqueo no es "sin disponibilidad" del todo (ej. mantenimiento
-- parcial, o dejar cargado el precio que va a regir apenas se desbloquee
-- la habitación) y el admin quiere guardar un precio distinto al de
-- room_types.base_price para ese rango de fechas, sin que eso cambie la
-- disponibilidad real (sigue bloqueada mientras exista la fila).

ALTER TABLE room_blocks
  ADD COLUMN IF NOT EXISTS special_price NUMERIC(10,2) CHECK (special_price IS NULL OR special_price > 0);
