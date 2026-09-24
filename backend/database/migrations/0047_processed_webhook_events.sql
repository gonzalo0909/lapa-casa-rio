-- 0047_processed_webhook_events.sql
--
-- Idempotencia de webhooks de pago (Stripe/MercadoPago): un mismo evento
-- puede llegar duplicado (reintento del proveedor, dos instancias del
-- backend, etc.). El constraint único (provider, event_id) es la fuente
-- de verdad -- el INSERT falla con 23505 en el segundo intento y el
-- webhook no se reprocesa. Resuelve la causa raíz del doble conteo en
-- group_payment_members (ver group-payment-service.ts) y protege el
-- resto de los webhooks de pago de la misma forma.

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      VARCHAR(20) NOT NULL,
  event_id      VARCHAR(200) NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
