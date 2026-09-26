-- 0034_owner_documents.sql
--
-- Documentos de verificación del administrador de apartamento.
-- El dueño sube CPF/CNPJ + comprobante de propiedad desde su panel.
-- El admin los revisa y cambia verification_status en apartment_owners.
--
-- verification_status en apartment_owners:
--   pending  → no subió docs o están en revisión (valor por defecto)
--   verified → admin aprobó los documentos → badge "Verificado"
--   rejected → admin rechazó, el dueño debe volver a subir

ALTER TABLE apartment_owners
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected'));

CREATE TABLE IF NOT EXISTS owner_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID        NOT NULL REFERENCES apartment_owners(id) ON DELETE CASCADE,
  doc_type      TEXT        NOT NULL
                              CHECK (doc_type IN ('cpf_cnpj', 'proof_ownership', 'other')),
  file_url      TEXT        NOT NULL,
  file_path     TEXT        NOT NULL,
  original_name TEXT,
  mime_type     TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ,
  review_notes  TEXT
);

CREATE INDEX IF NOT EXISTS idx_owner_documents_owner_id
  ON owner_documents (owner_id);
