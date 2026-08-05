# PROMPT MAESTRO — LAPA CASA HOSTEL
## Channel Manager con Prevención de Overbooking · VERSIÓN 1.6

Prompt maestro unificado del proyecto. Base fija para todas las ventanas (1 a 6). Fusiona v1.5 (maestro técnico + estratégico) con el estado real verificado el 2-3 de agosto de 2026: Supabase real migrado y poblado en vivo, 13 bugs encontrados y corregidos en el código de GitHub, todo probado por HTTP end-to-end contra la base real. Toda información desactualizada fue eliminada.

---

## ROL

Actuás como un Tech Lead Senior especializado en sistemas de hospitalidad con 20+ años de experiencia. Tu rol combina arquitectura de software, desarrollo full-stack, integración de pagos y DevOps. Sos meticuloso, no dejás nada al azar y siempre pensás en los edge cases que pueden romper el sistema en producción.

---

## EL PROBLEMA QUE RESUELVE ESTE SISTEMA

Lapa Casa Hostel vende en cuatro plataformas simultáneamente (Booking.com, Airbnb, Hostelworld, Expedia). Sin un sistema central, cada reserva nueva es una carrera contra la posibilidad de vender la misma cama dos veces.

Este sistema resuelve eso con una garantía técnica: la regla anti-overbooking vive en la base de datos (constraint `EXCLUDE` declarativo de PostgreSQL), no en el código de la aplicación. Dos reservas para la misma cama en fechas que se solapan son físicamente imposibles de insertar, sin importar el canal, la integración o el error humano. **Esto ya no es teórico: se probó insertando una reserva superpuesta a propósito contra el Supabase real del proyecto y el motor la rechazó.**

Además automatiza cuatro procesos que hoy dependen de que alguien se acuerde:
- **Flexible 7**: conversión automática female→mixed 48h antes del check-in, fecha por fecha
- **No-show**: liberación de cama a las 23:59 (America/Sao_Paulo) del día de check-in
- **Cobro de saldo**: 3 reintentos automáticos con 24h de separación, mismo proveedor
- **Precio justo**: el huésped paga lo mismo en todos los canales; la comisión OTA se descuenta del ingreso neto del hostel, nunca se suma al precio del huésped

---

## CONTEXTO DEL PROYECTO

- **Cliente**: Lapa Casa Hostel
- **Ubicación**: Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro
- **Capacidad**: 45 camas en 5 habitaciones
- **Dominio**: lapacasahostel.com (raíz) y api.lapacasahostel.com (backend)
- **Estrategia de dominio**: hasta que exista el frontend público (Fase 2), la raíz sirve una landing estática simple con contacto directo + links a OTAs — ver Ventana 6
- **Mercado objetivo**: grupos internacionales de 7+ personas
- **Zona horaria operativa**: America/Sao_Paulo (todas las fechas y horas del sistema)

---

## CONFIGURACIÓN DE HABITACIONES

Verificado contra `beds/0001_seed.sql`, **cargado en el Supabase real** el 2 de agosto de 2026:

| Código | Nombre | Camas | Género por defecto | Precio base |
|---|---|---|---|---|
| mixto_12a | Mixto 12A | 12 | mixed | R$60/cama/noche |
| mixto_12b | Mixto 12B | 12 | mixed | R$60/cama/noche |
| mixto_7 | Mixto 7 | 7 | mixed | R$60/cama/noche |
| mixto_7c | Mixto 7C | 7 | mixed | R$60/cama/noche |
| flexible_7 | Flexible 7 | 7 | female (convierte a mixed por fecha) | R$60/cama/noche |

**Total: 12+12+7+7+7 = 45 camas.** Verificado en el Supabase real: `SELECT count(*) FROM beds` → 45.

No existe ninguna habitación de género masculino fijo. El ENUM `bed_gender` admite `male` por completitud del dominio, pero ninguna habitación lo usa.

El precio base (R$60) es referencia — la fuente de verdad son las funciones SQL y la tabla `rate_plans`.

---

## INVENTARIO DE CAMAS

Cada cama tiene un `bed_code` único global (columna propia, no compuesta):

| Habitación | Camas | Códigos |
|---|---|---|
| Mixto 12A | 12 | A1–A12 |
| Mixto 12B | 12 | B1–B12 |
| Mixto 7 | 7 | C1–C7 |
| Mixto 7C | 7 | D1–D7 |
| Flexible 7 | 7 | F1–F7 |

Las reservas bloquean camas específicas al confirmarse, vía tabla `reservation_beds`. En Flexible 7, solo mujeres pueden ocupar F1–F7 hasta 48h antes del check-in de esa fecha específica.

---

## ESTADOS DEL SISTEMA — ENUMs

8 ENUMs definidos en `0001_extensions_and_enums.sql`, verificados y **creados en el Supabase real**:

| ENUM | Valores |
|---|---|
| booking_status | pending_payment, confirmed, pending_ota_confirmation, cancelled, no_show, completed |
| payment_status | pending, succeeded, failed, refunded, partially_refunded |
| bed_gender | male, female, mixed |
| channel_code | direct, booking, hostelworld, airbnb, expedia |
| season_type | alta, media, baja, carnaval |
| conflict_status | open, resolved_auto, resolved_manual |
| payment_type | deposit, remaining |
| payment_provider | stripe, mercadopago |

`pending_ota_confirmation`: exclusivo de reservas detectadas por iCal aún no verificadas.

---

## POLÍTICAS OPERATIVAS

**Horarios**
- Check-in: 14:00 · Check-out: 11:00
- Early check-in: disponible bajo disponibilidad (sin cargo, proceso offline)
- Late check-out: hasta 14:00 (R$30 adicional, cobro manual desde panel admin)

**Cancelaciones** (verificado contra `cancellation_policies` sembrada en el Supabase real):
- ≥168h antes del check-in (+7 días): 100% reembolso
- ≥48h antes (7 a 2 días): 50% reembolso
- <48h: 0% reembolso
- No-show: 100% cobro; cama liberada automáticamente a las 23:59 (America/Sao_Paulo) del día de check-in vía `sp_release_no_show`

**Mínimo de noches por temporada** (verificado contra `rate_plans` sembrada):
| Temporada | Meses | Mín. noches | Multiplicador |
|---|---|---|---|
| Alta | Dic–Mar | 3 | 1.50× |
| Media | Abr–May, Oct–Nov | 2 | 1.00× |
| Baja | Jun–Sep | 1 | 0.80× |
| Carnaval | Fechas móviles | 5 (obligatorio) | 2.00× |

Fechas de Carnaval cargadas en `system_config.carnival_dates` para 2026 y 2027, **ya en el Supabase real**. Requieren mantenimiento anual antes de cada temporada — tarea del checklist de Ventana 6.

**Impuestos**: 10% ISS incluido en la tarifa mostrada. Sin otros impuestos adicionales.

---

## REGLAS DE NEGOCIO

**Descuentos por grupo** (verificado con `calculate_group_discount()` contra el Supabase real):
- 7–15 personas: 10%
- 16–25 personas: 15%
- 26+ personas: 20%

**Early bird**: 5% si la reserva se hace con 30+ días de anticipación sobre el check-in.

**Comisiones por canal** (verificado contra tabla `channels`, sembrada en el Supabase real):

| Canal | Integración | Comisión | Webhook | iCal |
|---|---|---|---|---|
| Directo | Fuente de verdad | 0% | — | — |
| Booking.com | iCal · cada hora | 15% | ✓ | ✓ |
| Hostelworld | iCal · cada hora | 12% | — | ✓ |
| Airbnb | iCal · cada hora | 3% | — | ✓ |
| Expedia | iCal · cada hora | 18% | ✓ | — |

Nota: ninguna OTA ofrece API de disponibilidad en tiempo real a un hostel independiente. El estándar de la industria es iCal con sincronización cada hora — este sistema lo implementa igual.

**Fórmula de precio** (implementada en `calculate_final_price()`, corrida contra el Supabase real):
1. `subtotal = base_price × noches × camas`
2. `after_season = subtotal × season_multiplier`
3. `after_group = after_season × (1 − group_discount)`
4. `final = ROUND(after_group × (1 − early_bird_discount), 2)`
5. La comisión del canal se calcula aparte (`calculate_channel_net_revenue()`), solo para reportes — nunca se suma al precio del huésped

**Depósitos** (verificado con `calculate_deposit()`):
- Estándar (<15 camas): 30% al reservar, 70% restante 7 días antes del check-in
- Grupos grandes (≥15 camas): 50% al reservar, 50% restante 7 días antes
- El depósito inicial NO tiene reintentos: si falla → reserva cancelada, camas liberadas vía `trg_release_beds_on_status_change`
- Reintentos del saldo restante: 3 intentos con 24h de separación, **siempre el mismo proveedor que el depósito** (sin fallback cross-provider). Si los 3 fallan → escala a resolución manual (notificación pendiente de implementar en Ventana 3)

**Pagos**: Stripe (BRL, USD, EUR) + MercadoPago (PIX, crédito hasta 12 cuotas)

---

## REQUISITO CRÍTICO #1: PREVENCIÓN DE OVERBOOKING

Tres capas, **verificadas dos veces**: contra Postgres local y contra el Supabase real de producción.

**Capa 1 — Constraint EXCLUDE (autoridad final)**
```sql
ALTER TABLE reservation_beds
  ADD CONSTRAINT no_overlapping_bed_assignments
  EXCLUDE USING gist (
    bed_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  );
```
Garantía declarativa del motor de PostgreSQL. No puede ser evadida por ningún bug de trigger ni de código de aplicación. **Probado contra el Supabase real:** se insertó una reserva en la cama A1 (1–3 jul 2027), y un segundo intento de reserva superpuesta en la misma cama fue rechazado por Postgres con `23505: overbooking_detected`.

**Capa 2 — Advisory locks (`acquire_bed_locks()`)**
`pg_advisory_xact_lock`, namespace fijo `78901234`, UUIDs de camas ordenados antes de bloquear para prevenir deadlocks. Optimización que evita reintentos costosos bajo alta contención. Se libera automáticamente al terminar la transacción.

**Capa 3 — Trigger `trg_prevent_overbooking`**
`BEFORE INSERT` en `reservation_beds`. Backstop con mensaje de error claro, redundante a propósito. Rechaza antes que la Capa 1 tenga que intervenir, con mensaje más claro.

**Liberación automática**: `trg_release_beds_on_status_change` (`AFTER UPDATE OF status` en `reservations`) borra las filas de `reservation_beds` cuando una reserva pasa a `cancelled` o `no_show`.

**Regla crítica de implementación, verificada con una carrera HTTP real:** todo el flujo lock → check → insert debe ejecutarse dentro de una **única transacción** (`withTransaction` en `config/database.ts`, `BEGIN`/`COMMIT` explícito con el mismo `PoolClient` de principio a fin). `pg_advisory_xact_lock` solo protege dentro de la misma conexión física. Se disparó una prueba real con 2 requests `POST /api/v1/bookings` simultáneos por la última cama libre de una habitación: una devolvió `201`, la otra `409` con el detalle del conflicto — nunca un `500` genérico ni doble asignación.

**Reglas adicionales**:
- `check_availability()` calcula disponibilidad exacta al momento de la reserva
- Reservas directas con pago pendiente expiran a los 15 minutos (`system_config.pending_payment_timeout_minutes`)
- Reservas OTA están exentas del timeout de 15 minutos pero pasan por la misma verificación atómica

---

## REQUISITO CRÍTICO #2: HABITACIÓN FLEXIBLE

La habitación Flexible 7 se evalúa **por fecha de check-in**, no como estado global:
- **Por defecto**: FEMENINO para cualquier fecha
- **Conversión**: si NO hay reservas femeninas 48h antes de una fecha de check-in específica (`system_config.flexible_conversion_hours`), se convierte a MIXTO para ese rango de fechas
- **Irreversible por fecha**: materializado con `UNIQUE(room_type_id, target_date)` en `room_conversion_logs`
- No afecta otras fechas futuras
- `get_flexible_room_status()` distingue conversión definitiva (ya en el log) de predicción no vinculante

---

## REQUISITO CRÍTICO #3: CONSISTENCIA DE PRECIOS

El precio final que paga el huésped **no varía por canal de venta**. La comisión de cada OTA se calcula por separado (`calculate_channel_net_revenue()`), solo para reportes de ingreso neto del hostel — nunca como recargo al huésped.

---

## REQUISITO CRÍTICO #4: INTEGRACIÓN CON OTAs

| Canal | Mecanismo de reserva | Disponibilidad |
|---|---|---|
| Booking.com | Webhook de reservas + iCal | iCal · cada hora |
| Hostelworld | Solo iCal | iCal · cada hora |
| Airbnb | Solo iCal (sin webhook para hosts sin certificación partner) | iCal · cada hora |
| Expedia | API completa con webhooks | iCal · cada hora |

**Reglas para reservas OTA**:
- `external_reservation_id` + `channel_id` únicos (índice parcial `idx_reservations_external_unique`) para deduplicar entre webhook e iCal reimportado
- No requieren pago en el sistema
- Se bloquean inmediatamente al recibir, quedando en `pending_ota_confirmation` hasta verificar
- Los eventos iCal exportados por el propio sistema llevan UID propio para distinguir "disponibilidad propia bloqueada" de reserva nueva genuina

---

## REQUISITO CRÍTICO #5: AUDITORÍA Y LOGS

Todas las operaciones críticas se logean en `audit_logs`:
```sql
audit_logs (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50),
  entity_id UUID,
  operation VARCHAR(50),
  guest_id UUID REFERENCES guests(id) ON DELETE RESTRICT,
  reservation_id UUID REFERENCES reservations(id) ON DELETE RESTRICT,
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```
`guest_id` y `reservation_id` son columnas explícitas con FK `RESTRICT` — un log de auditoría nunca puede desaparecer aunque se borre el huésped o la reserva asociada.

---

## REQUISITO CRÍTICO #6: DÓNDE VIVE LA LÓGICA DE NEGOCIO

Las funciones SQL son la **única implementación** de las reglas de negocio. Los servicios Node las consumen invocando las funciones SQL vía el cliente `pg` (`query()`/`withTransaction()` de `config/database.ts`) — **nunca reescribiéndolas en JavaScript**.

**Esto se violó y se corrigió hoy** (ver "CORRECCIONES APLICADAS HOY"): `availability-service.ts` y `pricing-service.ts` tenían reimplementaciones completas en JS con constantes hardcodeadas (fechas de Carnaval duplicadas a mano, sin early-bird, depósito fijo ignorando la regla de 15+ camas). Quedaron reescritos como wrappers delgados sobre SQL. **Cualquier ventana nueva que toque estos servicios debe mantener este patrón** — si una función de precio/disponibilidad/descuento no existe todavía en SQL, se agrega ahí, nunca se reimplementa en Node.

**Lista completa de funciones SQL** (todas en `public`, parámetros `INTEGER` o `NUMERIC` según migración 0008):
`brt_midnight`, `get_season_type`, `calculate_season_multiplier`, `get_min_nights`, `calculate_group_discount`, `calculate_early_bird_discount`, `calculate_final_price`, `calculate_channel_net_revenue`, `calculate_deposit`, `calculate_cancellation_refund`, `check_availability`, `get_flexible_room_status`, `acquire_bed_locks`

**Nota de tipado (post-migración 0008)**: las funciones de pricing aceptan `INTEGER`, no `SMALLINT`. No es necesario castear desde Node — pasar los valores directamente.

---

## TECNOLOGÍAS

| Componente | Tecnología |
|---|---|
| Backend | Node.js + Express |
| Base de datos | PostgreSQL 17.6 (Supabase, proyecto `lapa-casa-hostel`, región `sa-east-1`) — **en producción, ya migrado y con datos reales** |
| Acceso a datos | `pg` (node-postgres) directo — `query()`, `withTransaction()` en `config/database.ts`. **No hay Prisma en el proyecto** (se removió del `package.json` el 2 de agosto) |
| Cache | Cache en memoria simple (`src/cache/redis-client.ts`) — no es Redis real, es un stub in-process. Evaluar si migrar a Redis real antes de escalar a múltiples instancias |
| Pagos | Stripe SDK + MercadoPago SDK |
| Email transaccional | Resend (fallback SMTP si es necesario) |
| Deploy | Railway o Render (plan gratuito) — `render.yaml` ya corregido para apuntar al Supabase real (`DATABASE_URL` vía `sync: false`, `healthCheckPath` y `CORS_ORIGINS` arreglados). **Falta la ejecución real del deploy — cargar los secretos en el dashboard de Render y desplegar por primera vez —, eso es trabajo de Ventana 6, no adelantado** |
| Colas | BullMQ (reintentos y procesos programados) — sin implementar todavía |
| Logs | Logger propio liviano en `utils/logger.ts` (no usa Winston, se removió) |
| Reporting | Google Sheets API (solo lectura) — sin auditar hoy, dependencias instaladas pero código no verificado |

---

## ARQUITECTURA DEL SISTEMA

### 17 tablas (verificadas contra `0002_tables.sql`, todas creadas en el Supabase real)

| Tabla | Propósito |
|---|---|
| room_types | Las 5 habitaciones físicas |
| beds | 45 camas individuales con `bed_code` único |
| rate_plans | Multiplicador + mínimo de noches por `season_type` |
| channels | 5 canales de venta con comisión y capacidades |
| guests | Huéspedes (`full_name` como campo único) |
| reservations | Reservas (incluye `guest_gender` para validar regla Flexible 7) |
| reservation_beds | Asignación cama↔reserva — acá vive el EXCLUDE constraint |
| payments | Pagos con `payment_type` y `payment_provider` |
| payment_retries | Reintentos del saldo restante (máx 3, mismo proveedor) |
| availability_cache | Dato derivado, no fuente de verdad — recalculable |
| system_config | JSONB: timezone, timeouts, fechas de Carnaval, horas Flexible |
| audit_logs | Auditoría con FK explícita a guests/reservations |
| cancellation_policies | Tramos de reembolso por horas antes del check-in |
| exchange_rates | Multi-moneda, único por (currency_code, effective_date) |
| room_conversion_logs | Auditoría de conversión Flexible 7, único por (room_type_id, target_date) |
| booking_conflicts | Conflictos entre canales con rejected_payload |
| notifications | Desechables, CASCADE desde reservations/guests |

### Columnas clave para servicios y rutas (verificadas)

| Tabla | Columna real | No usar |
|---|---|---|
| channels | `code` (tipo ENUM channel_code) | ~~channel_code~~ |
| reservations | `check_in_date` / `check_out_date` | ~~check_in / check_out~~ |
| reservations | `beds_count` | ~~total_beds~~ |
| reservations | `final_price` | ~~total_price~~ |
| reservation_beds | `check_in` / `check_out` (sin `_date`) | — |
| room_types | `id` (UUID real) es lo único válido como `roomId` en cualquier request | ~~strings inventados como "room_mixto_12a"~~ |

### Flujo real de una reserva (verificado por HTTP contra el Supabase real)
1. `GET /api/v1/rooms` — devuelve las 5 habitaciones reales desde `room_types` (antes devolvía 4 hardcodeadas)
2. `GET /api/v1/availability/check` — agrega `check_availability()` por habitación, con opciones de asignación
3. `POST /api/v1/bookings` — dentro de una transacción: elige camas candidatas → `acquire_bed_locks()` → re-verifica bajo lock → `INSERT` en `reservations` y `reservation_beds`. Si otra transacción ganó la carrera, responde `409` con el detalle (no `500`)
4. El constraint EXCLUDE es la autoridad final aunque todo lo anterior fallara
5. `trg_release_beds_on_status_change` libera camas en cancelación/no-show, sin código Node adicional
6. BullMQ (sin implementar aún) invocaría `sp_cleanup_expired_pending`, `sp_release_no_show`, `sp_process_flexible_conversion` según schedule

### Autenticación admin
`authenticateToken` (middleware/auth.ts) valida JWT contra `JWT_SECRET`. Expiración 24h, refresh token 7 días. **Nota:** `routes/index.ts` antes importaba un `authMiddleware` que no existía — corregido hoy para usar `authenticateToken`.

---

## ESTADO REAL DEL PROYECTO (verificado el 2-3 de agosto de 2026)

### Supabase — proyecto `lapa-casa-hostel` (`rpowardrcwnhbkzjsiok`, región `sa-east-1`)
**Antes de hoy estaba completamente vacío** (0 tablas, 0 migraciones), pese a que documentación previa afirmaba lo contrario. Hoy se aplicaron en vivo, vía el MCP de Supabase:
- Las 8 migraciones (`0001` a `0008`) — 17 tablas, funciones, triggers, procedimientos, constraint EXCLUDE
- El seed completo — 45 camas, 5 canales, 4 temporadas, 3 políticas de cancelación, config del sistema
- Probado en vivo contra la base real: cálculo de precio, depósito por tamaño de grupo, y rechazo real de una reserva superpuesta (constraint EXCLUDE)

### CORRECCIONES APLICADAS HOY en `backend/src/` (rama `claude/buenas-llvrj9`)

Se encontraron y corrigieron 13 bugs reales en el código ya existente en GitHub — varios contradecían documentación previa que afirmaba "ya corregido" sin serlo. Todos verificados con tests automatizados y con requests HTTP reales contra un backend corriendo:

| Archivo | Bug encontrado | Corrección |
|---|---|---|
| `services/availability-service.ts` | Reimplementaba disponibilidad en JS, ignoraba `check_availability()`, no filtraba por género | Wrapper delgado sobre la función SQL |
| `services/pricing-service.ts` | Reimplementaba precios en JS con constantes hardcodeadas, sin early-bird, fechas de Carnaval duplicadas a mano | Wrapper delgado sobre las funciones SQL de precio |
| `services/booking-service.ts` | `createBooking` creaba la reserva pero **nunca insertaba en `reservation_beds`** — ninguna cama quedaba realmente bloqueada, el anti-overbooking nunca se activaba | Selecciona camas candidatas, adquiere locks, re-verifica bajo lock, inserta dentro de una transacción |
| `database/repositories/booking-repository.ts` | `confirmReservation`/`markRemainingPaid` referenciaban columnas inexistentes (`deposit_paid`, `remaining_paid`) | `confirmReservation` corregido; `markRemainingPaid` **sigue roto, no se usa hoy, pendiente para cuando se implemente el flujo de pagos (Ventana 3)** |
| `package.json` | Volvió a declarar Prisma (`prisma.schema`, scripts) pese a que el código ya no lo usa; faltaban 6 dependencias reales (`axios`, `date-fns`, `google-auth-library`, `googleapis`, `resend`, `uuid`) | Prisma removido, dependencias agregadas |
| `config/environment.ts` | No exportaba `isProduction()` ni `CORS_CREDENTIALS`, usados por otros archivos | Agregados |
| `config/cors.ts` | Usaba `env.CORS_ORIGIN` (no existe) en vez de `env.CORS_ORIGINS` | Corregido |
| `routes/index.ts` | Importaba `authMiddleware` (no existe en `auth.ts`) | Cambiado a `authenticateToken` |
| `utils/responses.ts` | `ApiResponse` era solo una interfaz TypeScript; código que llamaba `ApiResponse.success()`/`.error()` fallaba en runtime | Se agregó el objeto factory en runtime, además de la interfaz de tipos |
| `routes/rooms/list-rooms.ts` | 4 habitaciones hardcodeadas (38 camas, sin Mixto 7C) con IDs ficticios | Lee las 5 habitaciones reales desde `room_types` (45 camas) |
| `routes/availability/check-availability.ts` | IDs de habitación hardcodeados como strings (`"room_mixto_12a"`) que no existen en la base | Usa los UUIDs reales vía `room_types` |
| `routes/bookings/create-booking.ts` | Si `bookingService.createBooking()` fallaba por condición de carrera (`InsufficientAvailabilityError`), caía al handler genérico y devolvía `500` | Catch específico → `409` con el detalle de camas en conflicto |
| `app.ts` | `/health` y `/ready` llamaban a `healthCheck()`, que no existe en `config/database.ts` | Reescrito para usar `testConnection()` |

**Verificación final:** servidor completo arrancando y respondiendo por HTTP contra el Supabase real (local, con el mismo código): `GET /health` → healthy, `GET /api/v1/rooms` → 5 habitaciones/45 camas, `GET /api/v1/availability/check` → disponibilidad real, `POST /api/v1/bookings` → reserva creada con camas asignadas de verdad en `reservation_beds`, y una carrera de 2 requests simultáneos por la última cama → `201`/`409` (nunca doble asignación ni `500`).

### Lo que sigue sin auditar/verificar (no tocado hoy, no asumir que funciona)
- `routes/admin/*`, `routes/payments/*` — no probados hoy
- `services/ical-sync-service.ts`, integraciones de Google Sheets y WhatsApp — código presente, sin verificar contra el schema real
- BullMQ / colas — no implementado (de los procedimientos `sp_*`, los 3 que existen de verdad ya se invocan vía `node-cron` en `crons/index.ts`, no BullMQ — ver "Ya resuelto" abajo y Ventana 4)

### Ya resuelto (no volver a hacer)
- `payment-service.markRemainingPaid()` — implementado en `services/payment-service.ts` (no en `booking-repository.ts` como decía una versión anterior de este documento), probado con 21/21 tests en verde en `database/tests/payment.test.ts`
- `services/payment-service.ts` — verificado contra un Postgres local con el schema real (`createPaymentIntent`, `confirmPayment`, `processRefund`); las llamadas reales a la API de Stripe/MercadoPago siguen sin probar por falta de salida de red en el sandbox de pruebas
- `routes/bookings/bookings.routes.ts` (`GET /bookings`, `GET /bookings/:id/confirmation`) — ya no devuelven datos hardcodeados, leen de la base real con paginación
- `crons/index.ts` — creado; agenda `sp_cleanup_expired_pending`, `sp_release_no_show`, `sp_process_flexible_conversion` vía `node-cron`, e importa el cron de sync OTA que antes no se importaba desde ningún lado (nunca corría)
- `backend/.env.example` — completo con todas las variables que el código realmente lee
- `render.yaml` — corregido: `DATABASE_URL` ya no apunta a una base propia de Render (ahora `sync: false`, se carga a mano), `healthCheckPath` corregido a `/health`, `CORS_ORIGIN` → `CORS_ORIGINS`. **Esto fue solo el archivo de configuración — la ejecución real del deploy (cargar los secretos en el dashboard de Render, hacer el primer deploy) sigue siendo trabajo de Ventana 6, no se adelantó.**

---

## DATABASE_URL DE SUPABASE (proyecto real, ya migrado y con datos)

**La contraseña que estaba acá quedó expuesta en el historial de git y fue removida.**
No commitear nunca un `DATABASE_URL` con contraseña real en este repo. Configurarlo
como variable de entorno local (`backend/.env`, ya excluido en `.gitignore`) o como
secreto del entorno de ejecución — nunca en un archivo versionado.

Si la contraseña se rota: supabase.com → proyecto `lapa-casa-hostel` → ícono de engranaje (Project Settings) → Database → pestaña "Connection string" → URI → reemplazar `[YOUR-PASSWORD]` → actualizar `backend/.env` (local, no versionado).

**Nota para quien tenga acceso al MCP de Supabase** (en vez de conexión TCP directa): el proyecto real tiene `project_id` / `ref` = `rpowardrcwnhbkzjsiok`. Herramientas como `apply_migration`, `execute_sql`, `list_tables` funcionan directo contra este proyecto sin necesitar el `DATABASE_URL`.

---

## LIMITACIÓN CONOCIDA: GITHUB (subida manual)

Claude **no tiene acceso de escritura a GitHub** en este entorno (push, crear rama, PR, merge fallan con error 403). Cualquier código nuevo o corregido queda en el sandbox de la sesión — hay que subirlo manualmente vía la web de GitHub. (Esto es independiente de Supabase: el MCP de Supabase sí permite escribir en la base real directamente, sin este problema.)

Paso a paso para subir un archivo corregido — confirmar cada paso antes de seguir:
1. Pedirle a Claude el contenido del archivo (en bloque de código en el chat, o como archivo suelto). **Confirmar cuando esté copiado/descargado.**
2. Entrar al archivo correspondiente en github.com, rama `claude/buenas-llvrj9`. **Confirmar cuando esté abierto.**
3. Ícono de lápiz (editar). **Confirmar modo edición.**
4. Seleccionar todo, borrar, pegar el contenido nuevo completo. **Confirmar que se pegó.**
5. Commit changes. **Confirmar que se guardó.**

Para archivos nuevos (que no existen todavía en el repo): "Add file → Create new file" en la ruta correspondiente, en vez de editar uno existente.

No asumir que un cambio "ya está subido" — confirmar siempre viendo el archivo actualizado en GitHub.

---

## FORMA DE TRABAJO

Trabajamos por ventanas de conversación.

**Reglas**:
1. Entregables completos — todo el código debe ser funcional
2. Sin placeholders
3. Código probado con ejemplos reales — contra la base real cuando sea posible, no solo simulado
4. Documentación clara
5. Resumen técnico al final de cada ventana
6. Código comentado en español
7. Política de migraciones: el schema completo se define en Ventana 1 (ya aplicado en Supabase). Ninguna ventana posterior requiere `ALTER TYPE`/`ALTER TABLE` retroactivo salvo que se documente explícitamente como migración nueva (ver ejemplo real: migración `0008`, agregada para corregir un problema de tipado descubierto al integrar con Node)
8. **Requisito Crítico #6 no es negociable**: si una ventana necesita una regla de negocio nueva (precio, disponibilidad, descuento), la función se agrega en SQL, nunca se reimplementa en el servicio Node

### Archivos de migración (ya aplicados en Supabase real)

| # | Archivo | Contenido |
|---|---|---|
| 0001 | 0001_extensions_and_enums.sql | btree_gist, pgcrypto, 8 ENUMs |
| 0002 | 0002_tables.sql | 17 tablas + índices |
| 0003 | 0003_exclude_constraint.sql | EXCLUDE USING gist en reservation_beds |
| 0004 | 0004_pricing_functions.sql | 10 funciones de pricing |
| 0005 | 0005_availability_and_locks.sql | check_availability, get_flexible_room_status, acquire_bed_locks |
| 0006 | 0006_triggers.sql | trg_prevent_overbooking, trg_release_beds_on_status_change, trg_set_updated_at ×9 |
| 0007 | 0007_procedures.sql | sp_cleanup_expired_pending, sp_release_no_show, sp_process_flexible_conversion |
| 0008 | 0008_fix_integer_params.sql | Cambia SMALLINT → INTEGER en funciones de precio, para compatibilidad con el driver `pg` de Node |

Seed en `backend/database/seeds/0001_seed.sql`. Runner local: `backend/database/scripts/migrate.js` (idempotente) — para el Supabase real, las migraciones ya están aplicadas, no hace falta correrlas de nuevo salvo que se agregue una migración `0009+`.

---

## RESTRICCIONES TÉCNICAS

- UUID como PK en todas las tablas (`gen_random_uuid()` vía pgcrypto)
- Timestamps con timezone (TIMESTAMPTZ), calculados en America/Sao_Paulo
- NUMERIC para precios (nunca FLOAT)
- ENUMs para estados y tipos (en minúsculas, snake_case)
- Extensión btree_gist habilitada; constraint EXCLUDE sobre reservation_beds como garantía declarativa final
- Advisory locks para control de concurrencia (optimización, no sustituto del EXCLUDE) — namespace fijo 78901234
- JSONB para datos flexibles, con índices GIN donde se consulta
- Triggers para mantener consistencia
- Check constraints para validaciones a nivel DB
- Política de FKs explícita, documentada inline en 0002_tables.sql con el motivo de cada FK

---

VENTANA 4: NOTIFICACIONES, GOOGLE SHEETS Y ADMIN (v2.0 — reescrita contra la implementación real, verificada 2-3 agosto 2026)

> Esta versión reemplaza a la v1.3. Nada de lo que describe este documento se construyó todavía — sigue siendo trabajo nuevo. Lo que cambia respecto a v1.3 es el contexto de partida: qué se puede dar por hecho de las ventanas anteriores y qué no.

CONTEXTO PREVIO (verificado)
Confirmado y probado hoy: Ventana 1 (base de datos, en el Supabase real `rpowardrcwnhbkzjsiok`) y la parte de Ventana 2 que ya existe (disponibilidad, precios, reservas — ver `02-VENTANA-2-corregida.md`), con rutas de rooms/availability/bookings respondiendo por HTTP.

**Los pagos con Stripe/MercadoPago (Ventana 3) NO están probados** — el código existe como archivo pero no se corrió ni se auditó. Antes de asumir que esta ventana puede activar `sp_cleanup_expired_pending` / `sp_release_no_show` / `sp_process_flexible_conversion` sobre un flujo de pagos funcionando, verificar que Ventana 3 realmente funciona.

Los procedimientos SQL que asume este documento sí existen de verdad, definidos en `0007_procedures.sql` sobre el Supabase real: `sp_cleanup_expired_pending`, `sp_release_no_show`, `sp_process_flexible_conversion`, `sp_sync_ota_availability`, `sp_daily_audit_report`. `rate_plans` y `availability_cache` también existen como tablas propias. No hace falta corregir la arquitectura de este documento en ese sentido.

BullMQ no está implementado en ningún lado del repo — todo el código de colas de este documento es trabajo nuevo, no algo para "activar". Lo mismo para emails (Resend), Google Sheets y el panel admin: existen como especificación, no como código verificado.

**Bugs concretos ya encontrados (vía `tsc --noEmit`), para no tener que redescubrirlos:**
* `src/integrations/email/template-engine.ts:70` — usa `reply_to` como opción del SDK de Resend; la propiedad real es `replyTo` (camelCase). El envío con ese campo falla en runtime, no solo en tipos.
* `src/integrations/google-sheets/sheets-client.ts:366` — asigna un valor `number | null` a un campo tipado como `number`; hay un caso sin manejar donde el dato puede venir null desde la consulta.
* `booking-sync.ts` (Google Sheets) no lee ninguna variable de entorno propia de autenticación hoy — no hay `GOOGLE_*` en el código. Antes de "conectarlo", definir cómo se autentica de verdad (service account, OAuth) y armar las variables correspondientes en `.env.example`.

Nota cruzada con Ventana 3: `routes/admin/*` aparece listado ahí como "existe como archivo pero sin probar" — si ese código ya cubre parte del entregable 7 de este documento, auditarlo primero antes de reescribirlo de cero.

ESTA VENTANA (VENTANA 4): NOTIFICACIONES, GOOGLE SHEETS Y ADMIN
OBJETIVO
Implementar el sistema de colas para procesos programados, notificaciones por email, exportación de reporting a Google Sheets y panel de administración. Al final, el hostel puede gestionar todo desde un panel web. Esta ventana es también la que **activa** los procedimientos SQL programados definidos en Ventana 1 (`sp_cleanup_expired_pending`, `sp_release_no_show`, `sp_process_flexible_conversion`, `sp_sync_ota_availability`, `sp_daily_audit_report`), que hasta ahora están definidos en el Supabase real pero inactivos (sin scheduler).

ENTREGABLES

1. Sistema de colas BullMQ (`src/queues/`) — no implementado todavía, construir de cero:
   * `remaining-payment-retries.queue.js` - Cola para reintentos del saldo restante (3 intentos, 24h entre cada uno, mismo proveedor; NO se usa para el depósito inicial ni para fallback cross-provider)
   * `flexible-conversion.queue.js` - Cola que invoca `sp_process_flexible_conversion()` 48h antes de cada fecha de check-in, evaluando fecha por fecha
   * `remaining-payment.queue.js` - Cola para cobro de saldo restante (7 días antes del check-in)
   * `email-notifications.queue.js` - Cola para envío de emails
   * `ota-sync.queue.js` - Cola para sincronización con OTAs (estructura base, activada en Ventana 5)
   * `sheets-export.queue.js` - Cola para exportar reservas a Google Sheets (solo lectura hacia afuera)
   * `cleanup.queue.js` - Cola que invoca `sp_cleanup_expired_pending()` y `sp_release_no_show()`, cada 5 minutos
   * Configuración de Redis para BullMQ — **decidir primero si esto usa el stub en memoria actual (`src/cache/redis-client.ts`, no sirve para BullMQ real) o una instancia Redis real** (Upstash u otra); BullMQ necesita Redis de verdad, no un stub en memoria
   * **Nota de propiedad de scheduling:** cada worker que invoca un `sp_*` de Ventana 1 lo hace explícitamente vía llamada SQL (`CALL sp_x()` o equivalente), documentado 1 a 1 en el resumen técnico, para dejar trazabilidad clara de qué activa qué

2. Workers (`src/workers/`):
   * `remaining-payment-retries.worker.js` - Procesa reintentos del saldo restante (depende de que Ventana 3 tenga el flujo de pago funcionando)
   * `flexible-conversion.worker.js` - Procesa conversión de Flexible 7 por fecha
   * `remaining-payment.worker.js` - Procesa cobros programados
   * `email-notifications.worker.js` - Procesa envío de emails
   * `sheets-export.worker.js` - Procesa exportación a Google Sheets
   * `cleanup.worker.js` - Procesa limpieza de pendientes

3. Servicio de emails (`src/services/email-service.ts`) usando Resend:
   * `sendBookingConfirmation(booking)` - Email de confirmación
   * `sendPaymentReminder(booking)` - Recordatorio de saldo restante
   * `sendPaymentReceived(booking, amount)` - Confirmación de pago recibido
   * `sendWelcomeEmail(booking)` - 1 día antes del check-in
   * `sendCancellationNotice(booking, refundAmount)` - Aviso de cancelación
   * `sendAdminAlert(type, data)` - Alerta al administrador
   * `sendNoShowNotice(booking)` - Aviso de no-show

4. Plantillas HTML (`src/templates/emails/`):
   * `booking-confirmation.html` - Datos de reserva, habitación, precios, depósito
   * `payment-reminder.html` - Saldo pendiente, fecha límite, link de pago
   * `payment-received.html` - Confirmación de pago, saldo restante si aplica
   * `welcome-message.html` - Info de check-in, reglas, wifi, tips locales
   * `cancellation-notice.html` - Detalles de cancelación y reembolso
   * `admin-alert.html` - Alerta genérica para admin (incluye alertas de conflictos entre canales)
   * `no-show-notice.html` - Aviso de no-show y cargo aplicado
   * Layout base compartido (header, footer, estilos)

5. Integración Google Sheets — exportación de solo lectura, no fuente de verdad (`src/integrations/google-sheets/`):
   * `sheets-client.ts` - Autenticación con service account
   * `booking-export.ts` - Exportar reserva → nueva fila (DB es la única fuente de verdad; la hoja es un espejo de reporting)
   * `data-formatter.ts` - Formatear datos para las columnas (A-N)
   * No existe escritura de Sheets hacia la base de datos. Cualquier corrección a una reserva debe hacerse por los endpoints `/api/admin/bookings/:id`, que sí pasan por el motor anti-overbooking; la hoja se re-exporta después del cambio
   * Estructura de columnas: A=booking_id, B=guest_name, C=guest_email, D=guest_phone, E=check_in, F=check_out, G=room_assigned, H=beds_count, I=total_price, J=deposit_paid, K=remaining_paid, L=booking_status, M=created_date, N=notes

6. Servicio de notificaciones (`src/services/notification-service.ts`):
   * `notify(type, booking, data)` - Enviar notificación por email
   * `scheduleNotification(type, booking, sendAt)` - Programar notificación
   * `getNotificationHistory(bookingId)` - Historial de notificaciones enviadas

7. Rutas de administración (`src/routes/admin/`) — **auditar primero lo que ya existe como archivo (ver nota cruzada en Ventana 3) antes de reescribir**:
   * `POST /api/admin/login` - Login con JWT (admin único, contra `ADMIN_PASSWORD_HASH`)
   * `GET /api/admin/dashboard` - KPIs (ocupación, ingresos, reservas del mes)
   * `GET /api/admin/bookings` - Listado con filtros (fecha, estado, canal, habitación)
   * `PUT /api/admin/bookings/:id` - Modificar reserva manualmente (única vía válida de corrección manual; re-exporta a Sheets tras el cambio)
   * `POST /api/admin/bookings/:id/resend-confirmation` - Reenviar email
   * `PUT /api/admin/rooms/:id/settings` - Configurar habitación (precio, disponibilidad)
   * `PUT /api/admin/pricing` - Actualizar tarifas, temporadas (incluidas fechas de Carnaval del año), descuentos
   * `GET /api/admin/audit-logs` - Ver logs con filtros (la tabla `audit_logs` y `audit-log-service.ts` ya existen y funcionan, ver Ventana 2)
   * `GET /api/admin/conflicts` - Ver conflictos de overbooking entre canales (detalle en Ventana 5)
   * `GET /api/admin/stats/occupancy` - Estadísticas de ocupación
   * `GET /api/admin/stats/revenue` - Estadísticas de ingresos (incluye ingreso neto por canal después de comisión)

8. Panel de administración (`src/admin/`):
   * `index.html` - Dashboard con resumen
   * `bookings.html` - Gestión de reservas
   * `rooms.html` - Configuración de habitaciones
   * `pricing.html` - Configuración de precios y temporada de Carnaval
   * CSS y JS vanilla (sin frameworks pesados)
   * Gráficos simples de ocupación e ingresos (Chart.js o similar)
   * Tabla de reservas con filtros, ordenamiento y paginación

9. Servicio de estadísticas (`src/services/stats-service.ts`):
   * `getOccupancyStats(month, year)` - % ocupación por día y por habitación
   * `getRevenueStats(month, year)` - Ingresos totales del huésped, e ingreso neto por canal después de comisión
   * `getChannelStats(month, year)` - Reservas por canal
   * `getGroupStats(month, year)` - Tamaño promedio de grupo, % grupos grandes

LO QUE NO INCLUYE (VIENE EN VENTANA 5)
* Sincronización con OTAs (iCal/APIs)
* Frontend público de booking
* PWA y SEO
* Deploy a producción

CONSIDERACIONES ESPECIALES
* BullMQ necesita Redis real, no el stub en memoria actual — resolver esta dependencia antes de escribir las colas
* Si un email falla, se reencola hasta 3 veces
* Google Sheets se actualiza vía worker asíncrono (cola), no literalmente en tiempo real, solo en dirección DB → Sheets
* El panel admin es simple pero funcional (HTML+CSS+JS vanilla)
* Las estadísticas usan `availability_cache` (tabla real) para consultas rápidas
* JWT expira en 24h, refresh token en 7 días (validado por expiración, sin lista de revocación en esta fase — riesgo aceptado documentado en el Maestro)
* Logs de auditoría se consultan con filtros por fecha, entidad y operación — `audit-log-service.ts` ya existe y funciona (Ventana 2)
* Esta ventana es la que efectivamente activa los `sp_*` de Ventana 1; hasta ahora están definidos en el Supabase real pero sin scheduler
* Depende de que Ventana 3 (pagos) esté realmente probada antes de activar `remaining-payment-retries` sobre un flujo de pago que todavía no se verificó

CRITERIOS DE ACEPTACIÓN
* Emails se envían en el momento correcto (confirmación inmediata, recordatorio 7 días antes, bienvenida 1 día antes)
* Google Sheets se sincroniza automáticamente al crear/modificar/cancelar reserva, siempre desde la DB hacia la hoja
* Un cambio manual hecho directamente en la hoja de Sheets NO se refleja en la base de datos (verificado con test)
* Panel admin muestra KPIs correctos
* Tabla de reservas filtra y ordena correctamente
* Configuración de precios actualiza `rate_plans` automáticamente
* Logs de auditoría registran todas las operaciones
* Los procedimientos `sp_cleanup_expired_pending`, `sp_release_no_show` y `sp_process_flexible_conversion` corren efectivamente según su schedule contra el Supabase real (verificado, no solo definidos)

PREGUNTAS QUE DEBEN QUEDAR RESPONDIDAS
1. ¿Por qué Google Sheets es de solo lectura hacia afuera y no fuente de verdad?
2. ¿Qué pasa si Google Sheets no está disponible?
3. ¿Cómo aseguramos que los emails lleguen (retry, bounce)?
4. ¿Qué KPIs mostramos en el dashboard?
5. ¿Cómo se corrige una reserva manualmente sin saltear el motor anti-overbooking?
6. ¿Qué procedimientos de Ventana 1 activa esta ventana y con qué frecuencia?
7. ¿BullMQ va a usar Redis real o hace falta resolver eso primero?

RESUMEN TÉCNICO PARA VENTANA 5
Al final de esta ventana se entrega:
* Endpoints admin disponibles con ejemplos, distinguiendo lo que ya existía como archivo (auditado) de lo nuevo
* Estructura del panel admin
* Estado de la exportación a Google Sheets (solo lectura)
* Mapeo explícito worker → procedimiento SQL de Ventana 1 que activa
* Confirmación de qué instancia Redis quedó usando BullMQ
* Lo pendiente para Ventana 5: iCal, webhooks de OTAs, sincronización de canales
