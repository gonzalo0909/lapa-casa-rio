# Deploy — Lapa Casa Hostel Channel Manager

Guía paso a paso para desplegar el sistema en producción. Apunta al Supabase real ya
migrado (proyecto `rpowardrcwnhbkzjsiok`, región `sa-east-1`) — **no crear un proyecto
Supabase nuevo**.

> Antes de seguir esta guía: Ventanas 3 (pagos), 4 (colas/emails/Sheets/admin) y 5
> (iCal/OTAs) deben estar verificadas de punta a punta, no solo escritas (ver
> `prompts/combo-VENTANA-6-completa.md`, sección "CONTEXTO PREVIO"). Desplegar pagos
> sin probar o iCal sin auditar es desplegar bugs conocidos a producción.

## 1. Servicios

`render.yaml` (raíz del repo) define dos servicios Render:

| Servicio | Tipo | Sirve |
|---|---|---|
| `lapa-casa-hostel-api` | `web` (Node) | Backend — API + panel admin en `/admin` |
| `lapa-casa-hostel-landing` | `web` (static) | Landing estática de `public/landing/` en el dominio raíz |

El frontend de reservas en Next.js (`frontend/`) es trabajo de **Fase 2** — hoy no
tiene páginas (`app/`/`pages/`), no compila, y no está en `render.yaml`. No intentar
desplegarlo hasta que esa carpeta tenga un `app/` real.

## 2. Primer deploy — backend

1. En el dashboard de Render: **New → Blueprint**, apuntar al repo, rama de deploy.
   Render lee `render.yaml` y crea ambos servicios.
2. En `lapa-casa-hostel-api` → **Environment**, cargar a mano las variables marcadas
   `sync: false` en `render.yaml` (no están en el archivo a propósito, ver comentario
   sobre el incidente de la contraseña expuesta):
   - `DATABASE_URL`: connection string real de Supabase (`rpowardrcwnhbkzjsiok`).
     Supabase → Project Settings → Database → Connection string → URI.
   - `REDIS_URL`: instancia de Upstash u otro proveedor Redis (ver sección 5).
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `MP_ACCESS_TOKEN`
   - `RESEND_API_KEY`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (generar con
     `node -e "require('bcryptjs').hash('tu-contraseña', 12).then(console.log)"`)
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
     `GOOGLE_SHEETS_SPREADSHEET_ID` (opcional — sin esto, la exportación a Sheets
     queda deshabilitada sin romper el resto)
   - Webhooks OTA (opcionales, sin esto ese canal rechaza con 401):
     `BOOKING_WEBHOOK_SECRET`, `BOOKING_WEBHOOK_API_KEY`, `BOOKING_WEBHOOK_IPS`,
     `EXPEDIA_WEBHOOK_SECRET`, `EXPEDIA_WEBHOOK_API_KEY`, `EXPEDIA_WEBHOOK_IPS`
3. Deploy manual desde el dashboard, o push a la rama conectada (`autoDeploy: true`).
4. Verificar: `GET https://<servicio>.onrender.com/health` → `{"status":"healthy"}`.
   Si falla, ver `docs/TROUBLESHOOTING.md`.
5. El schema y el seed **ya están aplicados** en el Supabase real (Ventana 1) — no
   correr `migrate.js`/`seed.js` contra producción salvo que se agregue una migración
   `0009+` nueva.

## 3. Primer deploy — landing estática

`lapa-casa-hostel-landing` se despliega solo (sin build step, `staticPublishPath: .`
sobre `public/landing/`). Antes de publicar, completar los `TODO` de
`public/landing/index.html`:

- Número real de WhatsApp (`href="https://wa.me/..."`)
- URLs reales de los perfiles en Booking.com, Airbnb, Hostelworld, Expedia

## 4. Dominios custom

Render no asigna dominios custom desde `render.yaml`. Por servicio, en el dashboard:

- `lapa-casa-hostel-landing` → Settings → Custom Domains → `lapacasahostel.com` (+ `www`)
- `lapa-casa-hostel-api` → Settings → Custom Domains → `api.lapacasahostel.com`

Seguir las instrucciones de Render para los registros DNS (`CNAME`/`A`) en el
proveedor real del dominio. Hasta que el DNS propague, usar las URLs
`*.onrender.com` (`APP_URL` en `render.yaml` debe actualizarse si el dominio final
cambia, ya que se usa para links en emails transaccionales).

## 5. Redis (Upstash u otro proveedor)

Sin `REDIS_URL`, el sistema sigue funcionando (cache cae a un fallback en memoria por
proceso, colas BullMQ quedan deshabilitadas — ver `src/cache/redis-client.ts` y
`src/queues/connection.ts`) pero **sin reintentos de pago ni emails asíncronos**, y
sin compartir estado entre instancias. Obligatorio antes de recibir pagos reales:

1. Crear una instancia (Upstash Redis, plan gratuito tiene persistencia).
2. Copiar el connection string (`rediss://...`) a `REDIS_URL` en Render.
3. Levantar el proceso de workers como **segundo servicio Render** (`background
   worker`, `startCommand: npm run worker`) — hoy no está en `render.yaml`, agregarlo
   antes de depender de colas en producción.

## 6. Webhooks externos

Registrar, en el dashboard de cada proveedor, la URL pública `https://api.<dominio>/api/v1/...`:

| Proveedor | Endpoint |
|---|---|
| Stripe | `/api/v1/payments/webhook/stripe` (ver `routes/payments/handle-webhook.ts`) — configurar `STRIPE_WEBHOOK_SECRET` con el valor que Stripe genera para ese endpoint. La verificación de firma usa el body crudo (`req.rawBody`, capturado en `app.ts`) — no tocar ese mecanismo al modificar este endpoint |
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

Render hace rolling deploy en el plan `starter` (nueva instancia arriba y pasando
`healthCheckPath` antes de recibir tráfico, la vieja se apaga después) — no requiere
configuración adicional. Riesgo real, documentado en el Maestro: el plan gratuito
tiene cold-starts tras inactividad, lo que puede perder un webhook si llega mientras
la instancia está arrancando. Evaluar upgrade a un plan pago antes de operar con
pagos reales de producción (ver checklist).

## 9. Rollback

`./scripts/rollback.sh` (requiere `RENDER_API_KEY` y `RENDER_SERVICE_ID`, ver el
script). Alternativa manual: dashboard de Render → servicio → pestaña **Events** →
elegir un deploy anterior → **Rollback to this deploy**.

## 10. Scripts de operaciones

Ver `scripts/` en la raíz del repo:

- `deploy.sh <backend|landing>` — dispara un deploy vía Deploy Hook
- `rollback.sh` — vuelve al deploy anterior vía API de Render
- `backup-db.sh` — `pg_dump` contra el Supabase real
- `restore-db.sh` — restaura un backup (destructivo, pide confirmación)
- `health-check.sh` — verifica que todos los endpoints públicos respondan

## 11. Checklist pre-producción

Ver la lista completa (con estado real, no aspiracional) en
`prompts/combo-VENTANA-6-completa.md`, sección "Checklist pre-producción", y en
`docs/MAINTENANCE.md` para las tareas recurrentes.
