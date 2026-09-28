-- 0020_guest_blocklist_and_booking_guests.sql
--
-- Dos extensiones al modelo de hóspedes:
--
-- 1. LISTA NEGRA: campos de bloqueo en la tabla guests existente.
--    Admin reporta → plataforma revisa → bloqueo activado manualmente.
--    El hóspede ve "no disponible" sin saber que está bloqueado.
--    Identificación por CPF/documento + email para evitar evasión.
--
-- 2. BOOKING_GUESTS: todos los CPFs de cada reserva.
--    El titular declara a todos los que van a entrar en el checkout.
--    Cada CPF adicional se verifica contra la lista negra antes de
--    confirmar el pago. Sin registro = sin entrada.
--
-- 3. GUEST_REPORTS: evidencia de los reportes del admin.
--    No hay bloqueo automático — requiere revisión manual de la plataforma.
--    El registro sirve como respaldo legal si el hóspede reclama.

-- ============================================================
-- 1. Bloqueo en guests
-- ============================================================

ALTER TABLE guests
  ADD COLUMN blocked            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN blocked_at         TIMESTAMPTZ,
  ADD COLUMN blocked_reason     TEXT,             -- visible para el admin que consulta
  ADD COLUMN block_notes        TEXT,             -- interno: solo visible para la plataforma
  ADD COLUMN blocked_by_admin   UUID;             -- qué admin inició el reporte (referencia libre, no FK)

-- Índice para que el check en el checkout sea rápido
CREATE INDEX IF NOT EXISTS idx_guests_blocked ON guests(blocked) WHERE blocked = true;

-- Índice en documento para detectar evasión (nuevo email, mismo CPF)
CREATE INDEX IF NOT EXISTS idx_guests_document ON guests(document_type, document_number)
  WHERE document_number IS NOT NULL;

COMMENT ON COLUMN guests.blocked IS
  'true = no puede hacer nuevas reservas. El hóspede ve disponibilidad normal sin saber que está bloqueado.';
COMMENT ON COLUMN guests.blocked_reason IS
  'Motivo visible internamente: daños, limpieza, ruido, no-show, reglas.';
COMMENT ON COLUMN guests.block_notes IS
  'Nota privada de la plataforma. No se expone al admin parceiro ni al hóspede.';

-- ============================================================
-- 2. booking_guests: todos los hóspedes declarados por reserva
-- ============================================================

CREATE TABLE IF NOT EXISTS booking_guests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,

  -- Datos del hóspede adicional (puede no tener cuenta en el sistema)
  full_name         VARCHAR(200) NOT NULL,
  document_type     VARCHAR(20) NOT NULL DEFAULT 'CPF',   -- CPF, RG, passaporte
  document_number   VARCHAR(50)  NOT NULL,
  is_titular        BOOLEAN NOT NULL DEFAULT false,       -- true = quien hizo la reserva

  -- Verificación en el check-in
  verified_at       TIMESTAMPTZ,                         -- cuando el admin confirmó el doc
  verified_by       UUID,                                -- admin que verificó

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_guests_reservation ON booking_guests(reservation_id);
CREATE INDEX IF NOT EXISTS idx_booking_guests_document    ON booking_guests(document_type, document_number);

COMMENT ON TABLE booking_guests IS
  'Todos los hóspedes declarados en el checkout, incluyendo el titular.
   Capacidad máxima = la del apartamento/habitación.
   Cada CPF es verificado contra guests.blocked antes de confirmar el pago.
   El admin marca verified_at en el check-in cuando ve el documento físico.';

COMMENT ON COLUMN booking_guests.is_titular IS
  'El titular es quien pagó y acepta los términos. Responde por datos incorrectos
   de los otros hóspedes que declaró, pero no por los actos de terceros.';

-- ============================================================
-- 3. guest_reports: evidencia de reportes del admin
-- ============================================================

CREATE TYPE report_reason AS ENUM (
  'property_damage',    -- daños al inmueble
  'extreme_uncleanliness', -- suciedad extrema (cama, baño)
  'noise_neighbors',    -- ruido / conflicto con vecinos
  'unauthorized_guests',-- personas no declaradas en la reserva
  'rule_violation',     -- otras reglas del apartamento
  'no_show_no_notice',  -- no apareció sin avisar
  'other'
);

CREATE TABLE IF NOT EXISTS guest_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id    UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  reported_guest_id UUID NOT NULL REFERENCES guests(id)  ON DELETE RESTRICT,
  reported_by       UUID NOT NULL,                        -- admin parceiro que reportó
  reason            report_reason NOT NULL,
  description       TEXT NOT NULL,                        -- descripción obligatoria
  evidence_urls     TEXT[],                               -- fotos subidas (Cloudinary)

  -- Estado del reporte
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','reviewed','blocked','dismissed')),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID,                                 -- plataforma que procesó
  platform_notes    TEXT,                                 -- decisión interna, no se expone

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_reports_guest ON guest_reports(reported_guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_reports_status ON guest_reports(status) WHERE status = 'pending';

COMMENT ON TABLE guest_reports IS
  'Reportes de admins parceiros sobre hóspedes problemáticos.
   Status flow: pending → reviewed → blocked | dismissed.
   El bloqueo NO es automático — la plataforma revisa antes de activar guests.blocked.
   evidence_urls es obligatorio moralmente (no por constraint) para respaldar el bloqueo
   si el hóspede reclama en el Procon o la Justicia.';

COMMENT ON COLUMN guest_reports.platform_notes IS
  'Nota interna de la plataforma sobre la decisión. Solo visible para el equipo interno.
   Sirve como registro legal si el hóspede disputa el bloqueo.';
