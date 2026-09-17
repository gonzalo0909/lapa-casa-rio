-- 0026_group_payment_member_provider.sql
-- Agrega provider_payment_id a group_payment_members para que:
--   a) confirmMemberPayment pueda persistir el ID del proveedor (Stripe/MP)
--   b) cancelExpiredSessions pueda reembolsar sin hacer JOIN a la tabla payments

ALTER TABLE group_payment_members
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
