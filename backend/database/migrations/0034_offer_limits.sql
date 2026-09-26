-- 0034_offer_limits.sql
-- Agrega límites a apartment_offers: tope mensual de canjes y bloqueo en feriados.
-- También agrega applied_offer_code a reservations para poder contar canjes por mes.

ALTER TABLE apartment_offers
  ADD COLUMN IF NOT EXISTS monthly_limit INT DEFAULT NULL
    CHECK (monthly_limit IS NULL OR monthly_limit > 0),
  ADD COLUMN IF NOT EXISTS block_holidays BOOLEAN NOT NULL DEFAULT FALSE;

-- Los premios de referido existentes heredan las nuevas restricciones
UPDATE apartment_offers
  SET monthly_limit = 3, block_holidays = true
  WHERE label = 'Premio por referido';

-- Registra qué código de oferta se aplicó a cada reserva (para contar canjes mensuales)
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS applied_offer_code VARCHAR(20) DEFAULT NULL;
