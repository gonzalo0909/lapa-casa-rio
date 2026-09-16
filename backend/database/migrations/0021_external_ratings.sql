-- 0021_external_ratings.sql
-- Campos opcionales para mostrar puntuaciones de plataformas externas
-- (Airbnb, Booking.com) en la tarjeta de cada apartamento.
-- Se rellenan manualmente; vacíos no muestran nada en la UI.

ALTER TABLE room_types
  ADD COLUMN IF NOT EXISTS external_rating        NUMERIC(3,2)
    CHECK (external_rating BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS external_review_count  INTEGER
    CHECK (external_review_count >= 0),
  ADD COLUMN IF NOT EXISTS external_rating_label  VARCHAR(80)
    DEFAULT 'plataformas internacionales';
