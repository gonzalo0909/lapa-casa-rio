-- 0033_owner_term_acceptance.sql
--
-- Registro del aceite del Termo de Adesão por el administrador.
-- term_accepted_at NULL = no aceptó todavía → el panel lo bloquea
-- y redirige a /owner/accept-terms.
-- term_version guarda la versión del documento para tener historial
-- si el término cambia en el futuro.

ALTER TABLE apartment_owners
  ADD COLUMN IF NOT EXISTS term_accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS term_accepted_ip  TEXT,
  ADD COLUMN IF NOT EXISTS term_version      TEXT;
