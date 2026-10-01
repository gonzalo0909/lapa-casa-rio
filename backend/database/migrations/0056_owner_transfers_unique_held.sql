-- 0056_owner_transfers_unique_held.sql
-- Candado contra doble pago al administrador: como máximo UN transfer 'held_25'
-- vivo (pending o succeeded) por reserva. Los 'failed' quedan fuera para poder
-- reintentar. Complementa el chequeo SELECT-then-INSERT de owner-payout-service.ts,
-- que por sí solo no es atómico si dos jobs corren a la vez.

CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_transfers_held25_live
  ON owner_transfers (reservation_id)
  WHERE transfer_kind = 'held_25' AND status IN ('pending', 'succeeded');
