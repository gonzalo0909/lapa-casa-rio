-- 0002_tables.sql
-- Lapa Casa Hostel - Channel Manager
--
-- Las 17 tablas de la seccion "ARQUITECTURA DEL SISTEMA" del Maestro.
-- UUID como PK en todas (RESTRICCIONES TECNICAS), TIMESTAMPTZ, NUMERIC
-- para dinero (nunca FLOAT), JSONB para datos flexibles.
--
-- Politica de FKs (Maestro v1.1): guests->payments y guests/reservations->
-- audit_logs = RESTRICT; reservations->reservation_beds = CASCADE;
-- cualquier otra relacion se decide caso a caso ACA, documentando el
-- motivo (nunca un criterio generico "segun corresponda").

-- ============================================================
-- room_types: las 5 habitaciones fisicas
-- ============================================================
CREATE TABLE IF NOT EXISTS room_types (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(20) UNIQUE NOT NULL,
  name                VARCHAR(100) NOT NULL,
  capacity            SMALLINT NOT NULL CHECK (capacity > 0),
  default_gender      bed_gender NOT NULL DEFAULT 'mixed',
  is_flexible         BOOLEAN NOT NULL DEFAULT false,
  base_price          NUMERIC(10,2) NOT NULL CHECK (base_price > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- beds: camas individuales con identificador unico (A1..A12, etc)
-- FK room_type_id -> RESTRICT: las camas son activos fisicos reales;
-- borrar un room_type con camas asociadas debe ser un paso explicito
-- (reasignar/eliminar camas primero), nunca un cascade silencioso que
-- borre el inventario fisico del hostel.
-- ============================================================
CREATE TABLE IF NOT EXISTS beds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id        UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  bed_code            VARCHAR(10) UNIQUE NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beds_room_type ON beds(room_type_id);

-- ============================================================
-- rate_plans: reglas de temporada (multiplicador + minimo de noches)
-- por season_type. Se lee desde SQL (STABLE), asi un cambio de regla
-- de negocio no requiere tocar el codigo de la funcion.
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_type         season_type UNIQUE NOT NULL,
  multiplier          NUMERIC(5,4) NOT NULL CHECK (multiplier > 0),
  min_nights          SMALLINT NOT NULL CHECK (min_nights > 0),
  description         VARCHAR(200),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- channels: canales de venta (OTAs + directo)
-- ============================================================
CREATE TABLE IF NOT EXISTS channels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                channel_code UNIQUE NOT NULL,
  name                VARCHAR(100) NOT NULL,
  commission_rate     NUMERIC(5,4) NOT NULL CHECK (commission_rate >= 0 AND commission_rate < 1),
  has_webhook         BOOLEAN NOT NULL DEFAULT false,
  ical_enabled        BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- guests
-- ============================================================
CREATE TABLE IF NOT EXISTS guests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           VARCHAR(200) NOT NULL,
  email               VARCHAR(255) UNIQUE NOT NULL,
  phone               VARCHAR(30),
  gender              bed_gender,
  document_type       VARCHAR(20),
  document_number     VARCHAR(50),
  country             VARCHAR(100),
  language             VARCHAR(10),
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);

-- ============================================================
-- reservations
--
-- guest_id -> RESTRICT: una reserva es un registro financiero/operativo;
-- no se puede perder el rastro del huesped que la genero.
-- channel_id -> RESTRICT: se necesita el canal para reportes de comision
-- neta; no se puede borrar un canal con historial de reservas.
--
-- guest_gender: decision de diseno agregada en Ventana 1 (no aparece
-- explicita en el Maestro) para poder implementar la regla de Flexible 7
-- ("solo mujeres pueden ocupar F1-F7 hasta 48h antes"): el sistema
-- necesita saber el genero del huesped/grupo para validar la asignacion.
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number      VARCHAR(20) UNIQUE NOT NULL,
  guest_id                UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  channel_id              UUID NOT NULL REFERENCES channels(id) ON DELETE RESTRICT,
  external_reservation_id VARCHAR(255),
  guest_gender            bed_gender,
  check_in_date           DATE NOT NULL,
  check_out_date          DATE NOT NULL,
  nights_count            SMALLINT NOT NULL CHECK (nights_count > 0),
  beds_count              SMALLINT NOT NULL CHECK (beds_count > 0),
  base_price              NUMERIC(10,2) NOT NULL,
  season_multiplier       NUMERIC(5,4) NOT NULL,
  group_discount          NUMERIC(5,4) NOT NULL DEFAULT 0,
  early_bird_discount     NUMERIC(5,4) NOT NULL DEFAULT 0,
  final_price             NUMERIC(10,2) NOT NULL CHECK (final_price >= 0),
  deposit_percent         NUMERIC(5,4) NOT NULL,
  deposit_amount          NUMERIC(10,2) NOT NULL,
  remaining_amount        NUMERIC(10,2) NOT NULL,
  status                  booking_status NOT NULL DEFAULT 'pending_payment',
  pending_expires_at      TIMESTAMPTZ,
  checked_in_at           TIMESTAMPTZ,
  checked_out_at          TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  cancellation_reason     TEXT,
  refund_amount           NUMERIC(10,2),
  special_requests        TEXT,
  source                  VARCHAR(50),
  metadata                JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_channel ON reservations(channel_id);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_metadata_gin ON reservations USING GIN(metadata);

-- Deduplicacion webhook vs iCal reimportado para el mismo canal
-- (REQUISITO CRITICO #4): un external_reservation_id es unico por canal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_external_unique
  ON reservations(channel_id, external_reservation_id)
  WHERE external_reservation_id IS NOT NULL;

-- ============================================================
-- reservation_beds: asignacion de cama especifica a una reserva.
-- La garantia anti-overbooking (constraint EXCLUDE) se agrega en la
-- migracion 0003 junto con el resto de indices, para mantener juntas
-- todas las piezas de la "autoridad final" anti-overbooking.
--
-- reservation_id -> CASCADE (regla explicita del Maestro: relacion
-- puramente compositiva).
-- bed_id -> RESTRICT: nunca se debe poder borrar una cama que tiene
-- asignaciones (historicas o activas); protege la integridad del
-- historial anti-overbooking.
-- ============================================================
CREATE TABLE IF NOT EXISTS reservation_beds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  bed_id          UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_reservation_beds_bed ON reservation_beds(bed_id);
CREATE INDEX IF NOT EXISTS idx_reservation_beds_reservation ON reservation_beds(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_beds_dates ON reservation_beds(check_in, check_out);

-- ============================================================
-- payments
--
-- guest_id -> RESTRICT: regla explicita del Maestro.
-- reservation_id -> RESTRICT: mismo criterio (registro financiero, no se
-- pierde el rastro de pagos aunque la reserva se cancele).
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id        UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  guest_id              UUID NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  provider              payment_provider NOT NULL,
  payment_type          payment_type NOT NULL,
  amount                NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency              VARCHAR(3) NOT NULL DEFAULT 'BRL',
  status                payment_status NOT NULL DEFAULT 'pending',
  provider_payment_id   VARCHAR(255),
  provider_metadata     JSONB,
  paid_at               TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  refunded_at           TIMESTAMPTZ,
  failure_reason        TEXT,
  refund_amount         NUMERIC(10,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_metadata_gin ON payments USING GIN(provider_metadata);

-- ============================================================
-- payment_retries: reintentos del saldo restante (3 intentos, 24h,
-- SIEMPRE mismo proveedor que el deposito). Compositiva a payments ->
-- CASCADE es seguro.
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_retries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  attempt_number    SMALLINT NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
  provider          payment_provider NOT NULL,
  status            payment_status NOT NULL,
  attempted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_retry_at     TIMESTAMPTZ,
  failure_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_retries_payment ON payment_retries(payment_id);

-- ============================================================
-- availability_cache: cache derivado (NO es fuente de verdad; la fuente
-- de verdad es reservation_beds + el constraint EXCLUDE). room_type_id ->
-- CASCADE porque es dato puramente derivado, seguro de recalcular.
-- ============================================================
CREATE TABLE IF NOT EXISTS availability_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id      UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  available_beds    SMALLINT NOT NULL,
  effective_gender  bed_gender NOT NULL,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_type_id, date)
);

CREATE INDEX IF NOT EXISTS idx_availability_cache_date ON availability_cache(date);

-- ============================================================
-- system_config: configuracion operativa (fechas de Carnaval moviles,
-- timeouts, timezone). Unica fuente para valores que cambian con el
-- tiempo sin requerir deploy de codigo.
-- ============================================================
CREATE TABLE IF NOT EXISTS system_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           VARCHAR(100) UNIQUE NOT NULL,
  value         JSONB NOT NULL,
  description   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- audit_logs: estructura literal del Maestro (REQUISITO CRITICO #5),
-- mas guest_id/reservation_id explicitos para poder cumplir la regla de
-- FK "guests/reservations -> audit_logs = RESTRICT" (el Maestro pide esa
-- politica de borrado, lo cual requiere una FK real ademas del par
-- generico entity_type/entity_id, que sigue existiendo para soportar
-- otros tipos de entidad como room, payment o conflict).
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       UUID NOT NULL,
  operation       VARCHAR(50) NOT NULL,
  guest_id        UUID REFERENCES guests(id) ON DELETE RESTRICT,
  reservation_id  UUID REFERENCES reservations(id) ON DELETE RESTRICT,
  old_data        JSONB,
  new_data        JSONB,
  user_id         UUID,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_data_gin ON audit_logs USING GIN(old_data);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_data_gin ON audit_logs USING GIN(new_data);

-- ============================================================
-- cancellation_policies: tramos de reembolso por politica de
-- cancelacion, expresados en horas antes del check-in (mas preciso que
-- "dias" para el corte de 48h).
-- ============================================================
CREATE TABLE IF NOT EXISTS cancellation_policies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label               VARCHAR(50) UNIQUE NOT NULL,
  min_hours_before    INTEGER NOT NULL,
  refund_percent      NUMERIC(5,4) NOT NULL CHECK (refund_percent >= 0 AND refund_percent <= 1),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- exchange_rates: multi-moneda (Stripe soporta BRL/USD/EUR)
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code     VARCHAR(3) NOT NULL,
  rate_to_brl       NUMERIC(12,6) NOT NULL CHECK (rate_to_brl > 0),
  effective_date    DATE NOT NULL,
  source            VARCHAR(50) NOT NULL DEFAULT 'manual',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(currency_code, effective_date)
);

-- ============================================================
-- room_conversion_logs: auditoria de conversion de Flexible 7, por
-- fecha especifica de check-in (REQUISITO CRITICO #2). room_type_id ->
-- RESTRICT: es un registro de auditoria, no debe poder desaparecer si se
-- edita/borra el room_type.
-- UNIQUE(room_type_id, target_date) materializa la irreversibilidad:
-- una fecha solo puede convertirse una vez.
-- ============================================================
CREATE TABLE IF NOT EXISTS room_conversion_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id      UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  target_date       DATE NOT NULL,
  converted_from    bed_gender NOT NULL,
  converted_to      bed_gender NOT NULL,
  reason            TEXT NOT NULL,
  converted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_type_id, target_date)
);

CREATE INDEX IF NOT EXISTS idx_room_conversion_logs_date ON room_conversion_logs(target_date);

-- ============================================================
-- booking_conflicts: conflictos de overbooking entre canales, deteccion
-- y resolucion. reservation_id_a/_b -> RESTRICT: nunca se debe perder
-- evidencia de un conflicto detectado. rejected_payload guarda el
-- intento que jamas llego a persistirse (cuando fue rechazado antes del
-- INSERT), para los casos en que no existe una segunda reserva real.
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_conflicts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id_a    UUID NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  reservation_id_b    UUID REFERENCES reservations(id) ON DELETE RESTRICT,
  bed_id              UUID REFERENCES beds(id) ON DELETE RESTRICT,
  channel_a           channel_code NOT NULL,
  channel_b           channel_code,
  status              conflict_status NOT NULL DEFAULT 'open',
  rejected_payload    JSONB,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ,
  resolution_notes    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_conflicts_status ON booking_conflicts(status);

-- ============================================================
-- notifications
-- reservation_id/guest_id -> CASCADE: las notificaciones son
-- desechables/compositivas, no hay valor en preservarlas huerfanas.
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id        UUID REFERENCES guests(id) ON DELETE CASCADE,
  channel         VARCHAR(20) NOT NULL,
  template        VARCHAR(100) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  payload         JSONB,
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_reservation ON notifications(reservation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
