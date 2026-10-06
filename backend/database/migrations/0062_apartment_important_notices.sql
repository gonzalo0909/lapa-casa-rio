-- 0062: "Informações importantes" editables por apartamento.
-- NULL = el apartamento usa los avisos por defecto del sitio (documento + edad).
-- Array JSON de strings (puede usar **negrita**). No pasa por moderación del anuncio.
ALTER TABLE room_types ADD COLUMN IF NOT EXISTS important_notices jsonb;
