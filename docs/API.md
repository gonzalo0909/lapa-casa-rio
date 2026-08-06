# API — Lapa Casa Hostel Channel Manager

Base URL: `https://api.lapacasahostel.com/api/v1` (producción) /
`http://localhost:3001/api/v1` (desarrollo).

Colección Postman completa con todos los endpoints: `docs/postman/`.

## Leyenda

- ✅ **Verificado**: probado por HTTP contra el Supabase real (ver Maestro,
  "CORRECCIONES APLICADAS HOY" y "Ya resuelto").
- ⚠️ **Sin verificar**: código presente, no probado de punta a punta contra la base
  real. No asumir que funciona sin probarlo primero.

## Envelope de respuesta

Casi todos los endpoints devuelven:

```json
// éxito
{ "success": true, "data": { ... }, "message": "opcional", "timestamp": "..." }

// error
{ "success": false, "error": "mensaje", "data": { "detalles": "opcional" }, "timestamp": "..." }
```

Excepciones: `GET /health`, `GET /ready`, `GET /api/health`, `GET /api/metrics`
(shape propio, ver `docs/ARCHITECTURE.md`), y los endpoints legacy montados
directo en `routes/index.ts` (`GET /api/v1/health`, `GET /api/v1/info`).

## Autenticación

- Endpoints públicos (rooms, availability, bookings, payments, ical/export): sin auth.
- Endpoints `/admin/*`: JWT Bearer, obtenido en `POST /admin/login`.
  `Authorization: Bearer <token>`. Expira en 24h (`JWT_EXPIRES_IN`).
- Webhooks OTA (`/webhooks/*`): `X-Api-Key` + `X-Signature` (HMAC-SHA256), no JWT.
- Webhook Stripe (`/payments/webhook/stripe`): header `stripe-signature`, verificado
  contra el body crudo.

## Rate limiting (Ventana 6)

Por IP, ver `routes/index.ts`:

| Grupo | Límite |
|---|---|
| `/availability/*`, `/rooms/*` | 10 req/s |
| `/bookings/*`, `/payments/*` | 3 req/s |
| `/admin/login` | 10 req/min (anti fuerza bruta) |
| `/admin/*` (autenticado) | 5 req/s |
| Todo `/api/*` (general) | 100 req/min |

## Límite de payload (Ventana 6)

`/availability/*`: 10kb. `/bookings/*`: 50kb. El resto: 10mb (límite general de
`express.json()`).

---

## Rooms ✅

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/rooms` | — | Las 5 habitaciones reales (45 camas) |
| GET | `/rooms/:id` | — | Detalle de una habitación (`id` = UUID real de `room_types`) |
| GET | `/rooms/:id/amenities` | — | Amenities de la habitación |
| GET | `/rooms/:id/photos` | — | Fotos de la habitación |
| GET | `/rooms/flexible/status` | — | Estado actual de Flexible 7 (`get_flexible_room_status()`) |

```
GET /api/v1/rooms

200
{
  "success": true,
  "data": [
    { "id": "<uuid>", "code": "mixto_12a", "name": "Mixto 12A", "capacity": 12, "gender": "mixed", "basePrice": 60 },
    ...
  ]
}
```

## Availability ✅

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/availability/check?checkIn&checkOut&bedsCount` | — | Disponibilidad agregada (`check_availability()`) |
| GET | `/availability/room/:roomId?checkIn&checkOut` | — | Disponibilidad de una habitación puntual |
| GET | `/availability/calendar?month=YYYY-MM` | — | Calendario de ocupación |
| GET | `/availability/summary` | — | Resumen general |

## Bookings ✅

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/bookings` | — | Crea una reserva. Dentro de transacción: locks → re-check → insert. `409` si pierde la carrera |
| GET | `/bookings/:id` | — | Detalle de una reserva |
| GET | `/bookings/:id/confirmation` | — | Detalle de confirmación (para la página de gracias) |
| PATCH | `/bookings/:id` | — | Actualización limitada (no fechas/habitaciones/status) |
| DELETE | `/bookings/:id?reason=` | — | Cancela — libera camas automáticamente vía trigger |
| GET | `/bookings?status&checkInFrom&checkInTo&page&limit` | — | Listado paginado |

```
POST /api/v1/bookings
{
  "checkIn": "2026-09-10",
  "checkOut": "2026-09-13",
  "rooms": [{ "roomId": "<uuid>", "bedsCount": 8 }],
  "guest": { "firstName": "Maria", "lastName": "Silva", "email": "maria@example.com" },
  "specialRequests": "Chegada tarde",
  "language": "pt"
}

201
{ "success": true, "data": { "id": "<uuid>", "reservationNumber": "...", "status": "pending_payment", ... } }

409 (perdió la carrera por la última cama)
{ "success": false, "error": "Disponibilidad insuficiente", "data": { "conflictingBeds": [...] } }
```

## Payments ⚠️

Código presente y probado contra Postgres local con el schema real; las llamadas
reales a Stripe/MercadoPago siguen sin probar por falta de salida de red en el
sandbox de pruebas (ver Maestro).

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/payments/intent` | — | Crea payment intent (`deposit` o `remaining`) |
| POST | `/payments/confirm` | — | Confirma un pago |
| POST | `/payments/deposit` | — | Procesa el depósito inicial |
| POST | `/payments/webhook/stripe` | firma Stripe | Webhook de eventos Stripe |
| POST | `/payments/webhook/mercadopago` | — | Webhook de eventos MercadoPago |
| GET | `/payments/:id/status` | — | Estado de un pago |
| GET | `/payments/reservation/:reservationId` | — | Pagos de una reserva |

## iCal / OTA

| Método | Ruta | Auth | Estado |
|---|---|---|---|
| GET | `/ical/export` | — | ✅ export combinado |
| GET | `/ical/export/:roomId` | — | ✅ export por habitación |
| GET | `/ical/feeds` | admin | ⚠️ |
| POST | `/ical/import/config` | admin | ⚠️ |
| PATCH / DELETE | `/ical/feeds/:id` | admin | ⚠️ |
| POST | `/ical/sync` | admin | ⚠️ fuerza el sync horario manualmente |
| GET | `/ical/status` | admin | ⚠️ |
| POST | `/webhooks/booking` | API key + IP + HMAC | ✅ (lógica de seguridad probada; integración real con Booking.com sin probar) |
| POST | `/webhooks/expedia` | API key + IP + HMAC | ✅ (ídem, Expedia) |

## Admin ⚠️ (routes/admin/*, no auditadas end-to-end en Ventana 6)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/admin/login` | Login, devuelve JWT |
| GET | `/admin/dashboard` | KPIs, check-ins próximos, revenue por canal |
| GET / PUT | `/admin/bookings` / `/admin/bookings/:id` | Listado / corrección manual |
| POST | `/admin/bookings/:id/resend-confirmation` | Reenvía el email de confirmación |
| POST | `/admin/bookings/:id/confirm` | Confirma manualmente sin depender de un pago |
| PUT | `/admin/rooms/:id/settings` | Precio base / flag flexible |
| GET / PUT | `/admin/pricing` | `rate_plans` + fechas de Carnaval |
| GET | `/admin/audit-logs` | Auditoría |
| GET | `/admin/stats/{occupancy,revenue,channels,groups}` | Reportes |
| POST | `/admin/sync/sheets` | Sincroniza Google Sheets manualmente |
| GET / GET / POST | `/admin/conflicts`, `/admin/conflicts/:id`, `/admin/conflicts/:id/resolve` | Conflictos entre canales |

## System (Ventana 6)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Chequeo mínimo (solo DB) — usado por Render como `healthCheckPath` |
| GET | `/api/health` | Chequeo extendido: DB, Redis, colas, Stripe/MP/email configurados |
| GET | `/ready` | Readiness |
| GET | `/api/metrics` | Requests/min, latencia, tasa de error (ventana de 60s, en memoria) |

Códigos de error comunes: `400` validación, `401` no autenticado / firma inválida,
`403` rol insuficiente / IP no autorizada, `404` no encontrado, `409` conflicto de
disponibilidad, `413` payload demasiado grande, `429` rate limit, `500` error no
esperado (mensaje genérico en producción, detallado en desarrollo).
