-- 0051_apartment_listing_approval.sql
--
-- Moderación obligatoria del anuncio de cada apartamento (fotos +
-- descripción/dirección/etc.) antes de que se vea en el sitio público --
-- hasta ahora lo que el owner cargaba en /owner/apartments/:id salía en
-- vivo al instante, sin que nadie del lado de Lapa Casa lo revisara
-- (riesgo de fraude/contenido inapropiado en las fotos o el texto).
--
-- listing_status: 'pending_review' | 'approved' | 'rejected'.
-- published_snapshot: copia congelada (JSONB) de los campos editoriales +
-- fotos tal como estaban en el último approve -- el sitio público lee de
-- acá, nunca de las columnas en vivo, así que una edición que vuelve a
-- 'pending_review' no le cambia nada a lo que ya se está mostrando hasta
-- que un admin apruebe la edición nueva.
--
-- Default 'pending_review' -- así un apartamento NUEVO (creado después de
-- esta migración) también necesita aprobación antes de publicarse, no
-- solo los que ya existían. No afecta al hostel: apartment-availability.ts
-- es la única ruta pública que filtra por listing_status, y solo lee
-- room_types con property_type='apartment'; los 5 cuartos del hostel se
-- dejan explícitamente en 'approved' más abajo, sin que nada los use.

ALTER TABLE room_types
  ADD COLUMN IF NOT EXISTS listing_status TEXT NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS listing_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS published_snapshot JSONB;

ALTER TABLE room_types
  DROP CONSTRAINT IF EXISTS room_types_listing_status_check;

ALTER TABLE room_types
  ADD CONSTRAINT room_types_listing_status_check
  CHECK (listing_status IN ('pending_review', 'approved', 'rejected'));

-- Los apartamentos ya publicados pasan a pendientes de revisión y se
-- caen del sitio público (published_snapshot queda NULL a propósito)
-- hasta que un admin los repase uno por uno desde /admin.
UPDATE room_types
SET listing_status = 'pending_review',
    listing_submitted_at = now()
WHERE property_type = 'apartment';

-- El hostel no pasa por esta moderación (nada lee su listing_status) --
-- se deja en 'approved' para que los datos no confundan a quien mire la
-- tabla, no porque cumpla ninguna función.
UPDATE room_types
SET listing_status = 'approved'
WHERE property_type = 'hostel';
