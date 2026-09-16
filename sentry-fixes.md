# Errores de Sentry resueltos — 2026-09-16

## 1. `column "address" does not exist` — GET /api/v1/owner/apartments
**Causa:** 7 migraciones de base de datos (0032–0035) nunca habían sido aplicadas a Supabase producción.
**Fix:** Se aplicaron directamente vía Supabase MCP:
- `0032_availability_cache_composite_index.sql` — índice compuesto en `availability_cache`
- `0032_referral_codes.sql` — columna `referral_owner_guest_id` en `apartment_offers`
- `0033_owner_term_acceptance.sql` — columnas `term_accepted_at/ip/version` en `apartment_owners`
- `0033_room_type_photos.sql` — tabla `room_type_photos` (fotos de apartamentos)
- `0034_apartment_address_fields.sql` — columnas `address`, `address_number`, `cep` en `room_types` ← **el que causaba el error 500**
- `0034_owner_documents.sql` — columna `verification_status` en `apartment_owners` + tabla `owner_documents`
- `0035_booking_guests_document_photo.sql` — columnas de foto de documento en `booking_guests`

---

## 2. Error CORS — OPTIONS /api/v1/availability/carnival-dates
**Causa (a):** Las URLs de preview de Vercel (`https://lapa-casa-git-*-lapa-cas.vercel.app`) no estaban en la lista de orígenes permitidos.
**Causa (b):** Bug en el regex de wildcards en `cors.ts`: el orden incorrecto de los `.replace()` escapaba el punto dentro de `.*`, haciendo que **todos los patrones con `*` estuvieran rotos** desde siempre.

**Fix en** `backend/src/config/cors.ts`:
- Corregido el regex: `split('*').map(escape).join('.*')` en vez de encadenar `.replace()`.
- Agregado `'https://lapa-casa-*.vercel.app'` a los orígenes permitidos en producción.

---

## 3. `Cloudinary no está configurado` — POST /api/v1/owner/apartments/:id/photos
**Causa:** Las variables de entorno `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` no están configuradas en Fly.io. La ruta ya maneja el error correctamente (devuelve 422 al cliente), pero Sentry lo capturaba igual.
**Fix en** `backend/src/config/sentry.ts`:
- Agregado `ignoreErrors: ['Cloudinary no está configurado']` para suprimir el ruido en Sentry.

**Pendiente (no es código):** Configurar las 3 variables de Cloudinary en el dashboard de Fly.io para habilitar la subida de fotos de apartamentos.

---

## 4. N+1 Query `pg-pool.connect` — GET /api/v1/availability/apartments
**Causa:** Código anterior hacía 7 queries por apartamento (7×N total). Detectado por Sentry Performance.
**Fix:** Ya resuelto en commit `949578d` ("batch apartment pricing — 7×N queries → 4 queries totales"). No requirió cambios en esta sesión. El issue en Sentry debería auto-resolverse al no generar nuevas ocurrencias.

---

## 5. [Sentry test] Error de prueba desde /debug-sentry
**Causa:** Error intencional de prueba. No requiere acción.

---

## Rama y commits
- Fixes en rama: `claude/new-session-k9vvm1`
- Commit: `3b30910 fix(sentry): resolve 3 unresolved issues from dashboard`
- Mergeado a: `definitivo2026` (commit `00b45d3`)
