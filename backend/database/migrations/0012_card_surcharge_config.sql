-- 0012_card_surcharge_config.sql
--
-- Recargo por pago con tarjeta (Stripe cobra comisión real, PIX via
-- Mercado Pago no): el dueño necesita poder ver y ajustar este
-- porcentaje el mismo desde el admin, sin depender de un deploy, porque
-- las tarifas de Stripe cambian y un valor viejo genera perdida real en
-- cada cobro. Mismo patron que 'pending_payment_timeout_minutes' y demas
-- claves de system_config (0001_seed.sql).

INSERT INTO system_config (key, value, description) VALUES
  (
    'card_surcharge_percent',
    '10',
    'Recargo (%) que se suma al monto cuando el huesped paga con tarjeta de credito (Stripe) en vez de PIX -- cubre la comision real de Stripe (base ~3.99% + R$0.50, +1.5% tarjeta internacional, +1% si hay conversion de moneda). Editable desde /admin/pricing.html. No aplica a pagos por PIX.'
  );
