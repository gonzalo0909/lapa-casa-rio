-- 0001_extensions_and_enums.sql
-- Lapa Casa Hostel - Channel Manager
--
-- Extensiones y ENUMs base del sistema. Ver Prompt Maestro v1.1, sección
-- "ESTADOS DEL SISTEMA (ENUMS CLAVE)".
--
-- Politica de migraciones (Maestro v1.1, "FORMA DE TRABAJO" punto 7): el
-- schema completo, incluidos todos los valores de ENUMs, se define aca en
-- Ventana 1. Ninguna ventana posterior deberia requerir ALTER TYPE/ALTER
-- TABLE retroactivo sobre lo cerrado aca.
--
-- payment_type y payment_provider no estan listados textualmente en la
-- seccion "ESTADOS DEL SISTEMA" del Maestro, pero son requeridos por las
-- reglas de depositos/pagos (30%/50%, Stripe/MercadoPago, mismo proveedor
-- en reintentos). Se agregan aca, en Ventana 1, para no violar la politica
-- de "nunca ALTER TYPE en silencio" en una ventana posterior.

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Estado de una reserva. `pending_ota_confirmation` es exclusivo de
-- reservas detectadas por importacion iCal (Hostelworld/Airbnb) que aun no
-- fueron verificadas contra el feed mas reciente.
CREATE TYPE booking_status AS ENUM (
  'pending_payment',
  'confirmed',
  'pending_ota_confirmation',
  'cancelled',
  'no_show',
  'completed'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded'
);

CREATE TYPE bed_gender AS ENUM (
  'male',
  'female',
  'mixed'
);

CREATE TYPE channel_code AS ENUM (
  'direct',
  'booking',
  'hostelworld',
  'airbnb',
  'expedia'
);

CREATE TYPE season_type AS ENUM (
  'alta',
  'media',
  'baja',
  'carnaval'
);

CREATE TYPE conflict_status AS ENUM (
  'open',
  'resolved_auto',
  'resolved_manual'
);

-- Tipo de pago dentro de una reserva: deposito inicial o saldo restante.
CREATE TYPE payment_type AS ENUM (
  'deposit',
  'remaining'
);

-- Proveedor de pago. Los reintentos del saldo restante SIEMPRE usan el
-- mismo proveedor que el deposito original (ver REGLAS DE NEGOCIO, sin
-- fallback cross-provider).
CREATE TYPE payment_provider AS ENUM (
  'stripe',
  'mercadopago'
);
