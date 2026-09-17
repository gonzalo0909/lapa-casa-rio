-- 0017_pix_discount_config.sql
--
-- Descuento por pago con PIX: el dueño puede ajustar el porcentaje de
-- descuento aplicado al depósito cuando el huésped elige pagar con PIX
-- en vez de tarjeta. Mismo patrón que card_surcharge_percent
-- (0012_card_surcharge_config.sql).
--
-- La lógica es: depósito con PIX = depósito_base × (1 - pix_discount_percent/100).
-- Un valor de 0 desactiva el descuento (sin banner ni cálculo diferencial).
-- Editable desde /admin/pricing.html sin necesidad de deploy.

INSERT INTO system_config (key, value, description) VALUES
  (
    'pix_discount_percent',
    '10',
    'Descuento (%) aplicado al depósito cuando el huésped paga con PIX. Un valor de 0 desactiva el descuento PIX y oculta el banner promocional. Editable desde /admin/pricing.html.'
  );
