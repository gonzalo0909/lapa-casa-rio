-- 0047_processed_webhook_events.sql
--
-- Ledger de idempotencia para webhooks de pago (Stripe/MercadoPago). Antes
-- el único control contra reentregas duplicadas eran checks ad hoc de
-- estado en cada handler (ej. payment.status === 'succeeded'), que no
-- cubrían todos los casos -- confirmMemberPayment() (group-payment-service)
-- lo sufría con un doble conteo real antes de este fix. Con esta tabla,
-- cada evento de webhook se "reclama" una sola vez vía INSERT ... ON
-- CONFLICT DO NOTHING antes de procesarlo: una reentrega del mismo evento
-- no vuelve a ejecutar el efecto secundario.

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  provider     TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

-- Los eventos de hace más de unos días ya no aportan valor de dedup real
-- (los proveedores no reintentan tan tarde) -- se limpian aparte via cron,
-- no hace falta índice adicional para el único patrón de acceso (INSERT +
-- lookup por PK).
