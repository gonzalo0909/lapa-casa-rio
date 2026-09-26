-- 0027_group_payment_member_tokens.sql
-- Rediseño Feature 2: tokens individuales por miembro del grupo.
-- Cada invitado recibe su propio link único (member_token).
-- Los slots se pre-crean al crear la sesión con status = 'invited'.

-- 1. Nuevas columnas en group_payment_members
ALTER TABLE group_payment_members
  ADD COLUMN IF NOT EXISTS member_token TEXT,
  ADD COLUMN IF NOT EXISTS slot_index   INTEGER;

-- Índice único (solo filas con token asignado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gpm_member_token
  ON group_payment_members(member_token)
  WHERE member_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gpm_slot
  ON group_payment_members(session_id, slot_index);

-- 2. Extender el CHECK de status para incluir 'invited'
ALTER TABLE group_payment_members
  DROP CONSTRAINT IF EXISTS group_payment_members_status_check;

ALTER TABLE group_payment_members
  ADD CONSTRAINT group_payment_members_status_check
  CHECK (status IN ('invited', 'pending', 'paid', 'failed', 'refunded'));
