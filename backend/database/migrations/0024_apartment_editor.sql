-- 0024_apartment_editor.sql
-- Agrega campos de detalle a room_types para el editor de apartamentos
-- y crea la tabla apartment_reviews para resenas ingresadas por admin.

-- Columnas de detalle del apartamento
ALTER TABLE room_types
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS amenities     JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bedrooms      SMALLINT,
  ADD COLUMN IF NOT EXISTS bathrooms     SMALLINT;

-- Resenas por apartamento (ingresadas manualmente por admin)
CREATE TABLE IF NOT EXISTS apartment_reviews (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID         NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  author_name  VARCHAR(100) NOT NULL,
  platform     VARCHAR(50)  NOT NULL DEFAULT 'Admin',
  rating       NUMERIC(2,1) NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT         NOT NULL,
  review_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
  is_published BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apartment_reviews_room_type
  ON apartment_reviews (room_type_id, is_published, review_date DESC);
