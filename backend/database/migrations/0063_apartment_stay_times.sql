-- 0063: ventanas de check-in / check-out editables por apartamento ('HH:MM').
-- NULL = el apartamento usa los horarios por defecto del motor de reservas.
ALTER TABLE room_types
  ADD COLUMN IF NOT EXISTS checkin_from  text,
  ADD COLUMN IF NOT EXISTS checkin_to    text,
  ADD COLUMN IF NOT EXISTS checkout_from text,
  ADD COLUMN IF NOT EXISTS checkout_to   text;
