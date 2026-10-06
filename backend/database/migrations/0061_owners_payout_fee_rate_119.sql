-- Termo de Adesão v2.2: taxa do gateway (Stripe) 1,19%.
-- Atualiza os administradores existentes que ainda estavam com o valor antigo (0,99%).
UPDATE apartment_owners SET payout_fee_rate = 0.0119 WHERE payout_fee_rate = 0.0099;
