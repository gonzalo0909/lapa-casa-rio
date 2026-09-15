# Deploy — Lapa Casa Hostel Channel Manager

Guía paso a paso para desplegar el sistema en producción. Apunta al Supabase real ya
migrado (proyecto `rpowardrcwnhbkzjsiok`, región `sa-east-1`) — **no crear un proyecto
Supabase nuevo**.

> **Stack actual:** Frontend → Vercel · Backend + Worker → Fly.io · DB → Supabase.

> Antes de seguir esta guía: pagos, colas/emails/Sheets/admin e iCal/OTAs deben estar
> verificados de punta a punta. Desplegar pagos sin probar o iCal sin auditar es
> desplegar bugs conocidos a producción.

## 1. Servicios

| Servicio | Plataforma | Sirve |
|---|---|---|
| `lapa-frontend` | Vercel | Frontend Next.js — motor de reservas, rutas `/[locale]/...` |
| Backend API + worker | Fly.io | API REST + BullMQ (ver `backend/fly.toml`) |
| Base de datos | Supabase | Postgres 17, región `sa-east-1` |

## 2. Deploy — backend (Fly.io)

Ver `docs/DEPLOY-RECORDATORIO.md` para el flujo paso a paso desde el
dashboard web de Fly (sin `flyctl` local). Resumen:

1. Fly → **Launch an App** → conectar repo GitHub → `gonzalo0909/lapa-casa-hostel`
2. Working directory / Config path: `backend` (ahí vive `Dockerfile` y `fly.toml`).
3. Branch: `definitivo2026`, región: `gru` (São Paulo).
4. Cargar secretos en Fly → Secrets: `DATABASE_URL`, `REDIS_URL`,
   `JWT_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGINS`, `APP_URL`, `FRONTEND_URL`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MP_ACCESS_TOKEN`,
   `RESEND_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`,
   `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
   `GOOGLE_SHEETS_SPREADSHEET_ID`.
   `DATABASE_CA_CERT` ya **no** hace falta — va commiteada como código en
   `backend/src/config/supabase-ca.ts` (no es un secreto, es la CA pública de Supabase).
5. Auto-deploy activado: cada push a `definitivo2026` dispara un build+deploy solo.
6. Verificar: `GET https://api.lapacasario.com/health` → `{"status":"healthy"}`.
7. El schema y el seed **ya están aplicados** en el Supabase real — no
   correr `migrate.js`/`seed.js` contra producción salvo que se agregue una migración
   `0009+` nueva.

## 3. Deploy — frontend Next.js (Vercel)

1. Vercel → **Add New Project** → importar repo `gonzalo0909/lapa-casa-hostel`.
2. Root Directory: `frontend`.
3. Framework Preset: **Next.js** (detectado automáticamente).
4. Branch de producción: `definitivo2026`.
5. Variables de entorno (Settings → Environment Variables):
   ```
   NEXT_PUBLIC_API_URL=https://api.lapacasario.com/api/v1
   NEXT_PUBLIC_SITE_URL=https://www.lapacasario.com
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
   NEXT_PUBLIC_MP_PUBLIC_KEY=APP_USR-xxxxx
   NEXT_PUBLIC_WHATSAPP_NUMBER=5521xxxxxxxxx
   NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-xxxxx         # opcional
   NEXT_PUBLIC_FB_PIXEL_ID=xxxxx                  # opcional
   ```
6. Dominio custom: `lapacasario.com` y `www.lapacasario.com` → Vercel → Settings → Domains.
   DNS en Porkbun: `CNAME www → cname.vercel-dns.com` (o los registros que muestre
   el dashboard de Vercel).
7. Auto-deploy activado por defecto: cada push a `definitivo2026` despliega solo.

## 4. Dominios custom

- `lapacasario.com` y `www.lapacasario.com` → Vercel proyecto `lapa-frontend`, Settings → Domains.
- `api.lapacasario.com` → Fly.io, app del backend → Certificates → agregar el
  hostname, cargar los registros `A`/`AAAA`/`CNAME` que muestra en Porkbun.

`APP_URL` en los Secrets de Fly debe apuntar a `https://api.lapacasario.com` (no a
`*.fly.dev`), ya que se usa para links en emails transaccionales.

## 5. Redis (Upstash u otro proveedor)

Sin `REDIS_URL`, el sistema sigue funcionando (cache cae a un fallback en memoria por
proceso, colas BullMQ quedan deshabilitadas — ver `src/cache/redis-client.ts` y
`src/queues/connection.ts`) pero **sin reintentos de pago ni emails asíncronos**, y
sin compartir estado entre instancias. Obligatorio antes de recibir pagos reales:

1. Crear una instancia (Upstash Redis, plan gratuito tiene persistencia).
2. Copiar el connection string (`rediss://...`) a `REDIS_URL` en los Secrets de Fly.
3. El worker (`npm run worker`) ya corre como process group `worker` en Fly —
   `backend/fly.toml`, no hace falta un servicio aparte.

## 6. Webhooks externos

Registrar, en el dashboard de cada proveedor, la URL pública `https://api.<dominio>/api/v1/...`:

| Proveedor | Endpoint |
|---|---|
| Stripe | `/api/v1/payments/webhook/stripe` — configurar `STRIPE_WEBHOOK_SECRET` con el valor que Stripe genera para ese endpoint. La verificación de firma usa el body crudo (`req.rawBody`, capturado en `app.ts`) — no tocar ese mecanismo al modificar este endpoint |
| MercadoPago | `/api/v1/payments/webhook/mercadopago` |
| Booking.com | `/api/v1/webhooks/booking` — requiere `BOOKING_WEBHOOK_SECRET`/`_API_KEY` |
| Expedia | `/api/v1/webhooks/expedia` — requiere `EXPEDIA_WEBHOOK_SECRET`/`_API_KEY` |

Airbnb y Hostelworld son iCal-only (no tienen webhook, ver
`config/channels.ts:WEBHOOK_CHANNELS`) — no hay nada que registrar ahí.

## 7. Feeds iCal

- **Export** (público, sin auth): `GET /api/v1/ical/export` y
  `/api/v1/ical/export/:roomId` — pegar estas URLs en Airbnb/Hostelworld/Booking como
  "calendario a importar".
- **Import** (admin): configurar las URLs de origen vía
  `POST /api/v1/admin` → panel admin, o `POST /api/v1/ical/import/config` con JWT de
  admin (ver colección Postman).

## 8. Deploy sin downtime

**Frontend (Vercel)**: Vercel hace rolling deploy atómico — la nueva versión
sólo recibe tráfico después de que el build termina correctamente. Sin cold-starts
(Vercel mantiene las funciones warm en el plan por defecto).

**Backend/worker (Fly.io)**: `fly.toml` tiene `min_machines_running = 1` y healthcheck
en `/health` antes de que el proxy le mande tráfico a una máquina nueva.

## 9. Rollback

**Frontend (Vercel)**: `./scripts/rollback.sh` (requiere `VERCEL_TOKEN`
y `VERCEL_PROJECT_ID`, ver el script) o manualmente: dashboard de Vercel → proyecto →
pestaña **Deployments** → elegir un deploy anterior → **Promote to Production**.

**Backend/worker (Fly.io)**: `git revert` del commit problemático + push (dispara un
nuevo deploy vía el Auto-Deploy conectado a GitHub), o desde el dashboard de Fly →
Activity → elegir un release anterior → redeploy. `scripts/rollback.sh` no cubre Fly.

## 10. Scripts de operaciones

Ver `scripts/` en la raíz del repo:

- `deploy.sh frontend` — dispara un deploy forzado vía Deploy Hook de Vercel
- `rollback.sh` — vuelve al deploy anterior vía API de Vercel
- `backup-db.sh` — `pg_dump` contra el Supabase real
- `restore-db.sh` — restaura un backup (destructivo, pide confirmación)
- `health-check.sh` — verifica que todos los endpoints públicos respondan

## 11. Checklist pre-producción

Ver las tareas recurrentes en `docs/MAINTENANCE.md`.
