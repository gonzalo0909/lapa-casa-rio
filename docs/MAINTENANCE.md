# Mantenimiento — Lapa Casa Hostel Channel Manager

## Diario

- **Revisar alertas por email** (`ADMIN_EMAIL`): overbooking/conflicto detectado, pago
  fallido recurrente (`PAYMENT_RETRIES_EXHAUSTED`, requiere resolución manual — no hay
  fallback cross-provider, ver `docs/ARCHITECTURE.md`), servicio caído.
- **Panel admin** (`/admin`) → Dashboard: check-ins próximos, ocupación.
- Si `REDIS_URL` está configurada: confirmar que el proceso de workers sigue vivo
  (`fly logs -a lapa-casa-hostel-worker` — worker y backend corren en Fly.io).
  Sin workers corriendo, los reintentos de pago y los
  emails encolados no se procesan (la creación de reservas en sí no se ve afectada).

## Semanal

- **Conflictos entre canales** (`/admin` → Conflictos): confirmar que no queden
  `open` sin resolver por mucho tiempo — el auto-resolver por prioridad de canal
  corre en cada sync horario de OTAs (`ota-sync.worker.ts`), así que un conflicto
  `open` persistente indica que ese worker no está corriendo.
- **`GET /api/health`**: confirmar que Redis/colas siguen `ok` si están configuradas
  (no `not_configured` por accidente tras un cambio de variables de entorno).
- Revisar `GET /api/metrics` para latencia/tasa de error fuera de lo normal.

## Mensual

- **Backup manual adicional**: `./scripts/backup-db.sh` (Supabase ya hace backups
  automáticos en el plan gratuito, esto es una copia extra portable).
- **Probar una restauración** de un backup reciente contra una base de desarrollo
  (`./scripts/restore-db.sh <dump> --force` apuntando a `DATABASE_URL` de dev, nunca
  a producción) — un backup nunca probado no es un backup confiable.
- Revisar dependencias con vulnerabilidades conocidas: `npm audit` en `backend/`.

## Anual (crítico — antes de cada temporada)

- **Fechas de Carnaval**: `system_config.carnival_dates` necesita el rango del año
  siguiente cargado con anticipación (afecta `get_season_type()` y por lo tanto el
  precio de cualquier reserva que caiga en esas fechas). Confirmar contra el
  calendario oficial y actualizar vía:
  - Panel admin → Pricing → sección Carnaval, o
  - `PUT /api/v1/admin/pricing` con `carnival: [{ year, start_date, end_date }]`
    (ver colección Postman)
  - Reforzado por una alerta automática: si faltan menos de 60 días para el fin del
    año en curso y no hay fecha cargada para el año siguiente, el sistema manda
    `carnival_dates_missing` a `ADMIN_EMAIL` (job diario, ver
    `src/monitoring/alerts.ts` / `src/queues/monitoring-alerts.queue.ts`). Esta
    alerta es una red de seguridad, no reemplaza la revisión manual.
- **Tasas de cambio** (`exchange_rates`): el seed inicial es un baseline ilustrativo
  (`manual` como `source`) — evaluar si conectar una API real de tasas antes de
  operar con montos en USD/EUR a escala.
- Revisar el plan de Vercel (frontend), Fly.io (backend/worker), Supabase y
  Upstash: si el volumen de reservas creció, reevaluar el upgrade a un tier pago.
  El riesgo de perder un webhook por cold-start no aplica al backend —
  `backend/fly.toml` tiene `min_machines_running = 1`, la máquina que recibe
  webhooks no se apaga. Vercel no tiene cold-starts en funciones serverless del
  plan Hobby en adelante.

## Rotación de credenciales

- **`DATABASE_URL`** (password de Supabase): Supabase dashboard → proyecto
  `rpowardrcwnhbkzjsiok` → Project Settings → Database → Connection string → rotar →
  actualizar en Fly.io (`fly secrets set DATABASE_URL=... -a <app-backend>` —
  nunca commitear la contraseña real).
- **`JWT_SECRET`**: rotarlo invalida todas las sesiones admin activas (fuerza
  re-login) — no rotar en horario de uso activo del panel sin avisar.
- **`ADMIN_PASSWORD_HASH`**: generar con
  `node -e "require('bcryptjs').hash('nueva-contraseña', 12).then(console.log)"`
  y actualizar en Fly.io (`fly secrets set`) — nunca commitear el hash ni la
  contraseña en texto plano.

## Migraciones nuevas

Política del proyecto (ver Maestro, "FORMA DE TRABAJO"): el schema completo se
fue definido en las migraciones iniciales. Cualquier cambio posterior es una migración `0009+` nueva,
nunca un `ALTER` retroactivo sobre un archivo ya aplicado. Pasos:

1. Crear `backend/database/migrations/000N_descripcion.sql`.
2. Probar local: `node backend/database/scripts/migrate.js` contra una base de
   desarrollo.
3. Aplicar contra el Supabase real vía el MCP de Supabase (`apply_migration`) o
   corriendo el mismo `migrate.js` con el `DATABASE_URL` de producción — revisar dos
   veces cuál `DATABASE_URL` está activo antes de correrlo.
4. Documentar el motivo en el propio archivo de migración (ver `0008` como ejemplo).
