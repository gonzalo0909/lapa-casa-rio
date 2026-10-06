-- 0064: chat entre el admin de la plataforma y cada administrador de apartamentos.
-- Un hilo por owner (owner_id); sender indica quién escribió. read_at = cuándo
-- lo leyó la otra parte (NULL = no leído).
CREATE TABLE IF NOT EXISTS owner_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES apartment_owners(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL CHECK (sender IN ('admin', 'owner')),
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_owner_messages_owner_created
  ON owner_messages (owner_id, created_at);
