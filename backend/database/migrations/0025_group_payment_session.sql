-- 0025_group_payment_session.sql
-- Feature 2: Pago grupal con link compartible.
-- Un único link por reserva grupal; cada miembro completa sus datos y paga
-- su cama (tarjeta +10% o PIX). El precio por cama usa Opción D (temporada).

-- ── 1) Nuevo estado en booking_status ────────────────────────────────────────
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_group';

-- ── 2) group_payment_sessions ─────────────────────────────────────────────────
-- Una sesión por reserva grupal. El token es el identificador público del link.
-- expires_at = created_at + 10 min (seteado por el servicio).
-- pricing_strategy y season_type se guardan en el momento de crear la sesión
-- para que el precio no cambie aunque la temporada cambie mientras el grupo paga.
CREATE TABLE IF NOT EXISTS group_payment_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  token             VARCHAR(64) UNIQUE NOT NULL,
  total_beds        SMALLINT NOT NULL CHECK (total_beds > 0),
  paid_beds         SMALLINT NOT NULL DEFAULT 0 CHECK (paid_beds >= 0),
  -- Opción D: 'min' (baja) | 'weighted_avg' (media) | 'per_room' (alta/carnaval)
  pricing_strategy  VARCHAR(20) NOT NULL,
  season_type       VARCHAR(20) NOT NULL,
  wa_share_url      TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'completed', 'expired', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (paid_beds <= total_beds)
);

CREATE INDEX IF NOT EXISTS idx_gps_reservation ON group_payment_sessions(reservation_id);
CREATE INDEX IF NOT EXISTS idx_gps_token       ON group_payment_sessions(token);
CREATE INDEX IF NOT EXISTS idx_gps_expires     ON group_payment_sessions(expires_at) WHERE status = 'open';

-- Trigger para updated_at (DROP IF EXISTS para que la migración sea idempotente)
DROP TRIGGER IF EXISTS trg_gps_updated_at ON group_payment_sessions;
CREATE TRIGGER trg_gps_updated_at
  BEFORE UPDATE ON group_payment_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── 3) group_payment_members ──────────────────────────────────────────────────
-- Un registro por persona que completó (o intenta) el pago de su cama.
-- guest_id se crea al momento del pago (el miembro llena sus datos en el link).
-- payment_id referencia el pago en la tabla payments (puede ser null hasta que paga).
-- bed_id registra qué cama física quedó asignada a este miembro.
CREATE TABLE IF NOT EXISTS group_payment_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES group_payment_sessions(id) ON DELETE CASCADE,
  guest_id          UUID REFERENCES guests(id) ON DELETE RESTRICT,
  payment_id        UUID REFERENCES payments(id) ON DELETE RESTRICT,
  bed_id            UUID REFERENCES beds(id) ON DELETE RESTRICT,
  amount_charged    NUMERIC(10,2) CHECK (amount_charged > 0),
  payment_method    VARCHAR(20) CHECK (payment_method IN ('card', 'pix')),
  card_surcharge    NUMERIC(10,2) NOT NULL DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gpm_session  ON group_payment_members(session_id);
CREATE INDEX IF NOT EXISTS idx_gpm_guest    ON group_payment_members(guest_id);
CREATE INDEX IF NOT EXISTS idx_gpm_payment  ON group_payment_members(payment_id);
CREATE INDEX IF NOT EXISTS idx_gpm_status   ON group_payment_members(status);

DROP TRIGGER IF EXISTS trg_gpm_updated_at ON group_payment_members;
CREATE TRIGGER trg_gpm_updated_at
  BEFORE UPDATE ON group_payment_members
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
