-- 0040_channel_room_mappings.sql
-- Tabla para traducir nombres de cuartos que vienen de OTAs (Booking.com,
-- Airbnb, Hostelworld, etc.) al room_type_id interno correspondiente.
-- Permite que cada canal use su propia nomenclatura sin tocar el código.

CREATE TABLE IF NOT EXISTS channel_room_mappings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id        UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  external_room_id  TEXT NOT NULL,
  room_type_id      UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, external_room_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_room_mappings_lookup
  ON channel_room_mappings(channel_id, external_room_id);
