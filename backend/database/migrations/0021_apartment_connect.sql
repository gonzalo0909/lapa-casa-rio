-- 0021_apartment_connect.sql
-- Stripe Connect para administradores de apartamentos +
-- registro de pagos físicos (InfinityPay / efectivo)
--
-- Qué hace esta migración:
--   1. Enum connect_onboarding_status — estado del onboarding Stripe Connect
--   2. Tabla apartment_owners — un registro por administrador de apartamento,
--      guarda el stripe_account_id (acct_xxx) y el estado del onboarding.
--   3. Columna owner_id en room_types — FK opcional al propietario/administrador.
--      Solo aplica a apartamentos (property_type = 'apartment').
--   4. Agrega 'cash' e 'infinitypay' al enum payment_provider para registrar
--      pagos hechos en la máquina física de InfinityPay o en efectivo.
--   5. Agrega 'owner_transfer' al enum payment_type para registrar la
--      transferencia del 25% retenido al administrador después del check-in.
--   6. Tabla owner_transfers — log de las transferencias Stripe a los admins.
--      (un registro por cada Transfer de Stripe creado hacia acct_xxx)

-- FIX (auditoría 2026-08-30): se quita el BEGIN/COMMIT propio de este
-- archivo. migrate.js ya envuelve cada migración en su propia transacción
-- (BEGIN/COMMIT o ROLLBACK a nivel de cliente) -- el COMMIT de acá abajo
-- cerraba esa transacción antes de tiempo, dejando el INSERT de
-- schema_migrations y el COMMIT final de migrate.js corriendo ya sin
-- transacción activa.

-- ─── 1. Enum estado del onboarding Stripe Connect ────────────────────────────

DO $$ BEGIN
  CREATE TYPE connect_onboarding_status AS ENUM (
    'pending',     -- recién creado, aún no fue al formulario de Stripe
    'in_progress', -- hizo clic en el link pero no terminó
    'active',      -- onboarding completo, pagos pueden fluir
    'restricted'   -- Stripe restringió la cuenta (documentación faltante, etc.)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Tabla apartment_owners ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS apartment_owners (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- datos del administrador
  full_name               VARCHAR(200) NOT NULL,
  email                   VARCHAR(200) NOT NULL UNIQUE,
  phone                   VARCHAR(30),

  -- Stripe Connect
  stripe_account_id       VARCHAR(60)  UNIQUE,          -- acct_xxx (null hasta que Stripe lo asigna)
  onboarding_status       connect_onboarding_status NOT NULL DEFAULT 'pending',
  onboarding_url          TEXT,                         -- link temporal de Stripe (expira en 24h, se regenera)
  onboarding_url_expires_at TIMESTAMPTZ,

  -- comisión que cobra Lapa Casa sobre los ingresos de este administrador (default 5%)
  commission_rate         NUMERIC(5,4) NOT NULL DEFAULT 0.0500
    CONSTRAINT chk_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 1),

  -- tasa de payout que paga el administrador por cada transferencia (default 0.99%)
  payout_fee_rate         NUMERIC(5,4) NOT NULL DEFAULT 0.0099
    CONSTRAINT chk_payout_fee_rate CHECK (payout_fee_rate >= 0 AND payout_fee_rate <= 1),

  is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apartment_owners_email
  ON apartment_owners (email);

CREATE INDEX IF NOT EXISTS idx_apartment_owners_stripe_account
  ON apartment_owners (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- ─── 3. FK owner_id en room_types ────────────────────────────────────────────

ALTER TABLE room_types
  ADD COLUMN IF NOT EXISTS owner_id UUID
    REFERENCES apartment_owners(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_room_types_owner_id
  ON room_types (owner_id)
  WHERE owner_id IS NOT NULL;

-- ─── 4. Nuevos valores en payment_provider ───────────────────────────────────

DO $$ BEGIN
  ALTER TYPE payment_provider ADD VALUE 'cash';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE payment_provider ADD VALUE 'infinitypay';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 5. Nuevo valor en payment_type ──────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE payment_type ADD VALUE 'owner_transfer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 6. Tabla owner_transfers ─────────────────────────────────────────────────
-- Registra cada Transfer de Stripe creado hacia el administrador del apartamento.
-- Un pago de reserva puede generar dos transfers: el 70% en el momento de la
-- reserva (no, va a check-in) y el 25% retenido tras el check-in.

CREATE TABLE IF NOT EXISTS owner_transfers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- de qué reserva viene
  reservation_id        UUID        NOT NULL
    REFERENCES reservations(id) ON DELETE RESTRICT ON UPDATE CASCADE,

  -- a qué propietario
  owner_id              UUID        NOT NULL
    REFERENCES apartment_owners(id) ON DELETE RESTRICT ON UPDATE CASCADE,

  -- monto transferido (en BRL, sin centavos)
  amount                NUMERIC(10,2) NOT NULL
    CONSTRAINT chk_transfer_amount CHECK (amount > 0),

  currency              VARCHAR(3)  NOT NULL DEFAULT 'BRL',

  -- tipo de transferencia
  transfer_kind         VARCHAR(30) NOT NULL DEFAULT 'remaining'
    CONSTRAINT chk_transfer_kind CHECK (transfer_kind IN ('remaining_70', 'held_25', 'full')),

  -- ID del Transfer creado en Stripe (tr_xxx)
  stripe_transfer_id    VARCHAR(60) UNIQUE,

  -- estado
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_status CHECK (status IN ('pending', 'succeeded', 'failed')),

  error_message         TEXT,
  transferred_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_transfers_reservation
  ON owner_transfers (reservation_id);

CREATE INDEX IF NOT EXISTS idx_owner_transfers_owner
  ON owner_transfers (owner_id);

CREATE INDEX IF NOT EXISTS idx_owner_transfers_status
  ON owner_transfers (status)
  WHERE status = 'pending';

-- ─── Trigger updated_at para las dos nuevas tablas ───────────────────────────
-- (el mismo patrón que usan las tablas existentes; la función real es
--  fn_set_updated_at(), definida en 0006_triggers.sql -- FIX auditoría
--  2026-08-30: acá abajo se invocaba sin el prefijo fn_, función
--  inexistente que hacía fallar toda la migración)

DO $$ BEGIN
  CREATE TRIGGER trg_apartment_owners_updated_at
    BEFORE UPDATE ON apartment_owners
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_owner_transfers_updated_at
    BEFORE UPDATE ON owner_transfers
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
