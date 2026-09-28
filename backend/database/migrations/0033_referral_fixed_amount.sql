-- 0033_referral_fixed_amount.sql
-- Agrega discount_amount a apartment_offers para permitir descuentos de valor fijo
-- (en BRL) además de los porcentuales. El premio de referido pasa de 10% a R$5 fijo.

ALTER TABLE apartment_offers
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT NULL
    CHECK (discount_amount IS NULL OR discount_amount > 0);

-- Relaja la constraint anterior que exigía discount_percent > 0 siempre.
-- Ahora es válido tener discount_percent = 0 cuando hay un discount_amount fijo.
ALTER TABLE apartment_offers
  DROP CONSTRAINT IF EXISTS apartment_offers_discount_percent_check;

ALTER TABLE apartment_offers
  ADD CONSTRAINT apartment_offers_discount_check
    CHECK (
      (discount_percent IS NOT NULL AND discount_percent > 0)
      OR
      (discount_amount IS NOT NULL AND discount_amount > 0)
    );
