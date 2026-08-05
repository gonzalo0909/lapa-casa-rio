# Troubleshooting — Lapa Casa Hostel Channel Manager

## El proceso no arranca: `DATABASE_URL environment variable is required`

`config/database.ts` tira esto al importarse si `DATABASE_URL` no está seteada —
es intencional (falla rápido en vez de arrancar en un estado inconsistente).
Verificar la variable en Render (Environment) o en `backend/.env` local.

## `GET /health` devuelve 503 / Render marca el deploy como unhealthy

`/health` solo depende de la base (`testConnection()`). Si falla:

1. Confirmar `DATABASE_URL` apunta al proyecto Supabase correcto
   (`rpowardrcwnhbkzjsiok`, no un proyecto nuevo).
2. Confirmar que Supabase no esté pausado (el plan gratuito pausa proyectos
   inactivos — reactivar desde el dashboard).
3. Revisar `GET /api/health` para un desglose más detallado (DB/Redis/colas/pagos).

## `POST /api/v1/bookings` devuelve 409 con "camas insuficientes" / conflicto

**No es un bug** — es el comportamiento esperado del Requisito Crítico #1: otra
transacción ganó la carrera por la última cama disponible. El cliente (frontend)
debe manejar el 409 mostrando disponibilidad actualizada, no reintentando
ciegamente. Si un 409 aparece con disponibilidad que debería alcanzar, revisar
`booking_conflicts` — puede ser una reserva OTA pendiente (`pending_ota_confirmation`)
bloqueando camas que el cálculo de disponibilidad no está considerando correctamente.

## `POST /api/v1/bookings` (o `/availability/*`) devuelve 413 "Payload demasiado grande"

Límites nuevos de Ventana 6 (`app.ts`): 10kb para `/availability/*`, 50kb para
`/bookings/*`. Un 413 legítimo casi siempre significa un payload mal formado (loop
infinito construyendo un array, base64 de una imagen metido por error en
`specialRequests`, etc.) — no subir el límite sin antes confirmar que el payload es
realmente necesario de ese tamaño.

## `429 Too Many Requests`

Rate limits por endpoint desde Ventana 6 (`routes/index.ts`): disponibilidad/rooms
10 req/s, reservas/pagos 3 req/s, admin 5 req/s — por IP. Si un uso legítimo choca
con esto (ej. un script de importación masiva desde el panel admin), correrlo con
pausas entre requests en vez de subir el límite global.

## Webhook de Stripe devuelve 400 "Webhook inválido"

Antes de Ventana 6 esto pasaba con **cualquier** webhook real, incluso con firma
válida (bug: el body llegaba re-parseado como objeto, la verificación HMAC de
Stripe necesita los bytes exactos — ver `docs/ARCHITECTURE.md`, sección "Webhooks:
por qué necesitan el body crudo"). Si esto sigue pasando después del fix:

1. Confirmar `STRIPE_WEBHOOK_SECRET` es el de **ese** endpoint específico
   (`/api/v1/payments/webhook/stripe`) — Stripe genera un secret distinto por
   endpoint registrado.
2. Confirmar que ningún proxy/CDN delante del backend esté re-serializando el body
   (Render no lo hace por defecto).
3. Revisar logs: `stripeHandler no configurado` significa que `STRIPE_SECRET_KEY`
   falta en el entorno.

## Webhook de Booking.com/Expedia devuelve 401

Capas de seguridad en `routes/webhooks/ota.routes.ts`, en orden — el log indica cuál
falló: API key (`X-Api-Key`), IP no autorizada (solo si `*_WEBHOOK_IPS` está
configurada), firma HMAC (`X-Signature`). Confirmar que el secret/API key
configurados en el dashboard de la OTA coincidan exactamente con
`BOOKING_WEBHOOK_SECRET`/`EXPEDIA_WEBHOOK_SECRET` en Render.

## Emails no salen (confirmación de reserva, alertas admin)

1. `RESEND_API_KEY` no configurada → `emailService` loguea y no manda nada (no
   rompe el flujo de reserva). Confirmar la variable en Render.
2. Si `REDIS_URL` no está configurada, los emails que dependen de la cola
   (`email-notifications.queue.ts`) nunca se procesan porque el proceso de workers
   no tiene nada corriendo (`queuesEnabled` en `false`) — los emails que se mandan
   de forma síncrona (confirmación inmediata al crear la reserva) sí funcionan
   igual.

## Panel admin: "Sesión expirada" constante / no puedo loguearme

1. `ADMIN_PASSWORD_HASH` no configurada → login devuelve 500, no 401 (revisar logs).
2. Confirmar que el hash es de bcrypt (`$2a$12$...`/`$2b$12$...`), no la contraseña
   en texto plano.
3. `JWT_SECRET` distinto entre el momento del login y una request posterior
   (típico tras un redeploy sin `generateValue: true` fijo, o al correr dos
   instancias con secrets distintos) invalida el token.

## Conflictos entre canales quedan `open` sin resolverse

`conflictService.detectConflicts()` (auto-resuelve por prioridad de canal) corre
dentro de `ota-sync.worker.ts`, en el sync horario — si el proceso de workers no
está corriendo (sin `REDIS_URL`, o caído), los conflictos se acumulan `open` sin que
nada los resuelva. Confirmar `GET /api/health` → `services.queues.status`.

## iCal: una OTA no refleja la disponibilidad real

- **Export** (`GET /api/v1/ical/export`): el feed que este sistema genera. Confirmar
  que la URL pegada en la OTA sea exactamente esa (o `/export/:roomId` si es por
  habitación).
- **Import**: sincroniza cada hora vía `ota-sync.worker.ts` (requiere `REDIS_URL`).
  Forzar un sync manual: `POST /api/v1/ical/sync` (admin) o desde el panel.
- Los eventos que el propio sistema exporta llevan un UID propio para no
  reimportarse a sí mismos como reserva nueva — si una OTA reescribe/normaliza el
  UID al re-publicar el feed, esa detección puede fallar y crear una reserva
  duplicada. Confirmar en `booking_conflicts` / logs si esto ocurre.

## `npm run build` falla localmente pero funciona en Render

`npm run build` es `tsc || true; tsc-alias && npm run copy-assets` — el `|| true`
hace que errores de `tsc` no aborten el build (deliberado, para no bloquear un
deploy por un warning de tipos que no afecta el runtime). Si el comportamiento en
runtime difiere de lo esperado, correr `npx tsc --noEmit` por separado para ver los
errores de tipos reales que el build normal esconde.
