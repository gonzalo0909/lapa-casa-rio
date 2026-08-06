# Arquitectura — Lapa Casa Hostel Channel Manager

## Vista general

```
                      ┌─────────────────────┐
   Booking.com  ─────▶│                      │
   Hostelworld  ──────▶   Backend (Node/     │◀────▶  Supabase (Postgres 17,
   Airbnb       ──────▶   Express, Render)   │         sa-east-1)
   Expedia      ─────▶│                      │         - 17 tablas
                      └──────────┬───────────┘         - EXCLUDE constraint
                                 │                      - funciones SQL
                       ┌─────────┴─────────┐            - triggers/procedures
                       │                    │
                  BullMQ workers      Panel admin
                 (proceso aparte,     (estático, servido
                  requiere Redis)      en /admin)
                       │
              Redis (Upstash) — cache +
              colas + rate limiting
```

- **Backend**: Node/Express, un solo proceso HTTP (`src/server.ts` → `src/app.ts`).
- **Workers**: proceso separado (`src/workers/index.ts`, `npm run worker`), consume
  las colas BullMQ. Sin `REDIS_URL` no arranca — el servidor HTTP sigue funcionando
  igual (reservas se siguen creando), pero nada asíncrono se procesa.
- **Base de datos**: Supabase (Postgres real), única fuente de verdad. `availability_cache`
  es dato derivado, recalculable — nunca se lee como fuente de verdad en decisiones de
  negocio.
- **Landing estática**: `public/landing/` servida en el dominio raíz mientras no existe
  el frontend de reservas de Fase 2 (`frontend/`, Next.js, sin páginas todavía).

## Requisito crítico #6: SQL como única implementación de negocio

Precio, disponibilidad, descuentos y locking viven en funciones SQL
(`backend/database/migrations/0004`-`0007`), no reimplementadas en Node. Los
servicios (`services/pricing-service.ts`, `services/availability-service.ts`) son
wrappers delgados que invocan esas funciones vía `pg` (`config/database.ts:query()`).
Esto se violó una vez (ambos servicios tenían reimplementaciones completas en JS con
constantes hardcodeadas) y se corrigió — cualquier ventana nueva que agregue una regla
de negocio debe agregar la función en SQL primero, nunca reimplementarla en Node.

## Jerarquía anti-overbooking (Requisito crítico #1)

Tres capas independientes, de mayor a menor autoridad:

1. **Constraint `EXCLUDE USING gist`** sobre `reservation_beds` (migración `0003`) —
   autoridad final, garantía declarativa de Postgres. Imposible de evadir desde
   ningún bug de trigger o de aplicación. Probado insertando una reserva superpuesta
   a propósito contra el Supabase real: rechazada con `23505`.
2. **Advisory locks** (`acquire_bed_locks()`, namespace fijo `78901234`) — optimización
   que evita el costo de un rollback bajo alta contención, ordena los UUIDs de camas
   antes de bloquear para prevenir deadlocks. No es un sustituto de la capa 1.
3. **Trigger `trg_prevent_overbooking`** (`BEFORE INSERT`) — backstop con un mensaje de
   error más claro que el de la capa 1, redundante a propósito.

Regla de implementación no negociable: todo el flujo lock → check → insert corre
dentro de una única transacción (`withTransaction`, mismo `PoolClient` de principio a
fin) — `pg_advisory_xact_lock` solo protege dentro de la misma conexión física.
Verificado con una carrera real de 2 `POST /bookings` simultáneos por la última cama:
uno `201`, el otro `409` con el conflicto — nunca `500` ni doble asignación.

`trg_release_beds_on_status_change` (`AFTER UPDATE OF status`) libera las camas
automáticamente al cancelar o marcar no-show, sin código Node adicional.

## Por qué la comisión de canal nunca toca el precio del huésped

`calculate_final_price()` calcula lo que paga el huésped, igual en los 4 canales.
`calculate_channel_net_revenue()` es una función **separada**, usada solo para
reportes de ingreso neto del hostel — nunca se invoca en el flujo de creación de una
reserva ni se suma al precio mostrado. Este split intencional es lo que garantiza el
Requisito crítico #3 (consistencia de precios entre canales).

## Por qué Google Sheets es solo lectura hacia afuera

La base (Supabase) es la única fuente de verdad. La exportación a Sheets
(`integrations/google-sheets/`) es unidireccional: DB → Sheets, vía un service
account con permiso de Editor solo sobre ese spreadsheet. Nunca se lee de Sheets
hacia la aplicación — evita que una edición manual de la hoja corrompa datos reales
o bypasee el anti-overbooking.

## Mecanismo anti-bucle de iCal y deduplicación

- Los eventos iCal que el propio sistema **exporta** llevan un UID propio
  (`ical-generator`) que lo distingue de una reserva genuina — al reimportar el
  mismo feed (por ejemplo si una OTA lo hace de vuelta), el parser lo reconoce y no
  lo vuelve a crear como reserva nueva.
- `external_reservation_id` + `channel_id` tienen un índice único parcial
  (`idx_reservations_external_unique`) — deduplica entre el webhook de una reserva
  (Booking.com/Expedia) y esa misma reserva reimportada más tarde por iCal.

## Por qué no hay fallback cross-provider de pagos

El depósito inicial define el proveedor (Stripe o MercadoPago) para toda la reserva.
Los reintentos del saldo restante (`payment_retries`, máx. 3, 24h de separación)
**siempre usan el mismo proveedor que el depósito** — nunca caen a un proveedor
distinto si el original falla. Razón: cada proveedor tiene su propio flujo de
autenticación/tokenización del método de pago del huésped (ej. un `payment_method`
guardado en Stripe no es transferible a MercadoPago) — un fallback automático
implicaría pedirle al huésped que vuelva a cargar sus datos de pago a mitad de un
reintento fallido, lo cual es peor UX que escalar a resolución manual (lo que hace
el sistema tras agotar los 3 intentos, ver `PAYMENT_RETRIES_EXHAUSTED`).

## Webhooks: por qué necesitan el body crudo

Stripe, y los webhooks de OTA (Booking.com/Expedia), verifican la autenticidad del
request con una firma HMAC calculada sobre los **bytes exactos** del body recibido.
`app.ts` monta `express.json()` de forma global (antes de cualquier router) y usa su
`verify` callback para guardar ese buffer crudo en `req.rawBody` antes de parsearlo —
cualquier handler de webhook nuevo debe verificar su firma contra `req.rawBody`,
nunca contra `req.body` (que ya es un objeto JS re-serializado, con espacios/orden de
claves distintos a lo que el proveedor firmó). Ver `routes/webhooks/ota.routes.ts` y
`routes/payments/handle-webhook.ts`.

## Observabilidad (Ventana 6)

- `GET /health`: chequeo mínimo (solo DB), es el que usa Render como
  `healthCheckPath` — tiene que responder rápido.
- `GET /api/health`: chequeo extendido (DB, Redis, colas BullMQ, Stripe/MP/email
  configurados) — `src/monitoring/health.ts`.
- `GET /api/metrics`: requests/min, latencia, tasa de error, en memoria por proceso —
  `src/monitoring/metrics.ts`.
- Alertas (`src/monitoring/alerts.ts` + `conflict-service.ts` +
  `remaining-payment-retries.worker.ts`): overbooking/conflicto detectado, pago
  fallido recurrente, servicio caído, fechas de Carnaval del año siguiente
  faltantes — todas vía `emailService.sendAdminAlert()`.

## Escalar a más de una propiedad

No implementado hoy (fuera de alcance de Ventana 6) — el schema asume un solo
hostel (no hay tabla `properties`). Camino más directo si esto se necesita: agregar
`property_id` a `room_types` y propagarlo por FK a `beds`/`reservations`, particionar
`availability_cache` por propiedad. El constraint EXCLUDE seguiría funcionando igual
(sigue siendo por `bed_id`, que ya sería único por propiedad transitivamente).
