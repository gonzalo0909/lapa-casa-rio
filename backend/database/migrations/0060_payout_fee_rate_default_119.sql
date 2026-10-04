-- Termo de Adesão v2.2: taxa do gateway (Stripe) passa de 0,99% para 1,19%.
-- Só altera o DEFAULT para novos administradores; os existentes mantêm a taxa
-- gravada (ajustável no admin) até o aviso de 30 dias da Cláusula 4.4.
ALTER TABLE apartment_owners ALTER COLUMN payout_fee_rate SET DEFAULT 0.0119;
