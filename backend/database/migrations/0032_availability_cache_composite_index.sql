-- Índice compuesto sobre (room_type_id, date) para availability_cache.
-- Las queries filtran por ambas columnas (ej. group-payment-service.ts
-- línea ~160: WHERE room_type_id = $1 AND date = $2::date), pero el índice
-- previo solo cubría date, forzando un scan parcial. El UNIQUE(room_type_id, date)
-- no es usado automáticamente por el planner en todos los caminos de ejecución,
-- por eso se crea un índice explícito orientado a lecturas.
CREATE INDEX IF NOT EXISTS idx_availability_cache_room_date
  ON availability_cache(room_type_id, date);
