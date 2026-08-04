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
| Deploy | Railway o Render (plan gratuito) — **`render.yaml` actualmente apunta a una base de datos propia de Render, no a Supabase; hay que corregirlo antes de desplegar en serio** |
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
- `services/payment-service.ts`, `services/ical-sync-service.ts`, integraciones de Google Sheets y WhatsApp — código presente, sin verificar contra el schema real
- `database/repositories/booking-repository.ts` → `markRemainingPaid()` — sigue con columnas inexistentes
- BullMQ / colas — no implementado, los procedimientos `sp_*` existen en SQL pero nada los invoca todavía
- `render.yaml` — apunta a una base de datos propia de Render, no a Supabase; corregir antes de desplegar

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

VENTANA 6: DEPLOY Y PRODUCCIÓN (v2.0 — reescrita contra la implementación real, verificada 2-3 agosto 2026)

> Esta versión reemplaza a la v1.3. La jerarquía anti-overbooking (EXCLUDE constraint como autoridad final, advisory locks como optimización, trigger como backstop) y los `sp_*`/`booking_conflicts` que asume el checklist existen de verdad — no hace falta corregir esa parte. Lo que sí cambia: qué ventanas están realmente completas, y un bug concreto de configuración de deploy que hay que corregir antes de desplegar nada.

CONTEXTO PREVIO (verificado)
Confirmado y probado hoy: solo Ventana 1 (base de datos, en el Supabase real `rpowardrcwnhbkzjsiok`, `sa-east-1`) y la parte de Ventana 2 ya construida (disponibilidad, precios, reservas). **No** están verificadas Ventana 3 (pagos), Ventana 4 (BullMQ/emails/Sheets/admin) ni Ventana 5 (iCal/OTAs) — existen como especificación o como código sin auditar, no como sistema probado de punta a punta. No asumir "todos los tests pasando": no hay una suite de tests formal commiteada al repo todavía.

Dos correcciones puntuales para esta ventana:
* `render.yaml` (ya existe en el repo) **apunta a una base de datos propia de Render, no a Supabase** — hay que corregirlo antes de cualquier deploy real, o el sistema se desplegaría contra la base equivocada (vacía, sin el schema).
* El Supabase real del proyecto (`rpowardrcwnhbkzjsiok`, `sa-east-1`) ya tiene las 8 migraciones + seed aplicadas — el checklist de deploy de este documento debe apuntar a ESE proyecto existente, no crear uno nuevo.
* El logger real (`logger.ts`) **no es Winston** — es un logger propio y liviano. Ajustar cualquier punto de este documento que asuma Winston específicamente (rotación de logs, formato) a lo que el logger real soporte, o evaluar si vale la pena migrar a Winston recién en esta ventana.

ESTA VENTANA (VENTANA 6): DEPLOY Y PRODUCCIÓN
OBJETIVO
Desplegar el sistema completo en producción, con monitoreo, backups, seguridad hardening y documentación. Al final, el channel manager estará vivo, operativo y listo para recibir reservas reales. **Precondición real:** antes de llegar a esta ventana, Ventanas 3, 4 y 5 tienen que estar efectivamente probadas (no solo escritas) — desplegar pagos sin probar o iCal sin auditar es desplegar bugs conocidos a producción.

ENTREGABLES

1. Configuración de deploy:
   * `railway.json` o `render.yaml` - **corregir `render.yaml` existente para que apunte al Supabase real (`rpowardrcwnhbkzjsiok`), no a una base propia de Render**
   * `Dockerfile` - Contenedor para el backend (multi-stage build)
   * `docker-compose.yml` - Stack completo local (opcional, para desarrollo)
   * `.dockerignore` - Archivos excluidos del contenedor

2. Landing estática para el dominio raíz:
   * `public/landing/index.html` servido en `lapacasahostel.com` hasta que exista el frontend público de Fase 2 — no se deja el dominio raíz sin resolver
   * Contenido mínimo: info del hostel, contacto directo (WhatsApp/email), links a perfiles de Booking.com/Airbnb/Hostelworld para reservar mientras no hay frontend propio de reservas
   * `api.lapacasahostel.com` sigue siendo el backend (sin cambios)

3. Variables de entorno (`.env.production`):
   * `DATABASE_URL` — **apunta al proyecto Supabase real `rpowardrcwnhbkzjsiok` (`sa-east-1`), ya migrado y con seed**, no a un proyecto nuevo
   * `REDIS_URL` — **pendiente de Ventana 4**: BullMQ necesita Redis real, hoy el "caché" es un stub en memoria; resolver qué instancia se usa (Upstash u otra) antes de esta ventana
   * `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   * `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`
   * `JWT_SECRET`, `ADMIN_PASSWORD_HASH`
   * `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`
   * `RESEND_API_KEY`, `FROM_EMAIL`
   * `ENCRYPTION_KEY`
   * `TZ=America/Sao_Paulo`
   * `NODE_ENV=production`

4. Scripts de operaciones (`scripts/`):
   * `deploy.sh` - Deploy automatizado a Railway/Render
   * `rollback.sh` - Rollback a versión anterior
   * `backup-db.sh` - Backup de base de datos (`pg_dump` contra el Supabase real)
   * `restore-db.sh` - Restaurar backup
   * `health-check.sh` - Verificar que todos los servicios respondan

5. Monitoreo y health checks (`src/monitoring/`):
   * `health.ts` - Endpoint `GET /api/health` con estado de DB, Redis, Stripe, MP, colas — el health check básico (`testConnection()`) ya existe en `app.ts`, extenderlo para cubrir los demás servicios
   * `metrics.ts` - Métricas básicas (requests por minuto, latencia, errores)
   * `alerts.ts` - Alertas configurables (overbooking detectado, conflicto entre canales sin resolver, pago fallido recurrente, servicio caído, y fechas de Carnaval del año siguiente faltantes en `system_config` — dispara `sendAdminAlert('carnival_dates_missing', ...)` si faltan menos de 60 días para fin de año y no están cargadas)

6. Seguridad hardening:
   * helmet configurado con CSP, HSTS, etc. — verificar qué tanto ya está activo en `app.ts` (no auditado en detalle hoy) antes de asumir que falta todo
   * rate limiting por endpoint (disponibilidad: 10 req/s, reservas: 3 req/s, admin: 5 req/s)
   * CORS restrictivo (solo lapacasahostel.com y admin) — `cors.ts` ya existe y fue corregido hoy (leía `env.CORS_ORIGIN` en vez de `env.CORS_ORIGINS`), verificar la config final de producción
   * Validación de API keys para webhooks de Booking.com y Expedia (firma HMAC)
   * Sanitización de inputs contra XSS e inyección
   * Límite de tamaño de payload (10kb para disponibilidad, 50kb para reservas)

7. Documentación (`docs/`):
   * `API.md` - Documentación completa de endpoints con ejemplos request/response, distinguiendo lo verificado de lo no probado
   * `DEPLOY.md` - Guía de deploy paso a paso, apuntando al Supabase real existente
   * `MAINTENANCE.md` - Guía de mantenimiento diario/semanal/mensual (incluye actualización anual de fechas de Carnaval en `system_config`, reforzada por la alerta automática del entregable 5)
   * `TROUBLESHOOTING.md` - Problemas comunes y soluciones
   * `ARCHITECTURE.md` - Diagrama de arquitectura y decisiones técnicas (incluye jerarquía de mecanismos anti-overbooking — EXCLUDE constraint como autoridad final, advisory locks como optimización, trigger como backstop —, por qué la comisión de canal nunca toca el precio del huésped, por qué Sheets es solo lectura, el mecanismo anti-bucle de iCal y la deduplicación webhook/iCal por `external_reservation_id`, y por qué no hay fallback cross-provider de pagos)

8. Colección Postman (`docs/postman/`):
   * `Lapa_Casa_Channel_Manager.postman_collection.json`
   * Environment de desarrollo y producción (apuntando al Supabase real)
   * Tests automatizados para cada endpoint

9. Checklist pre-producción:
   * [ ] Base de datos con backups automáticos (Supabase real `rpowardrcwnhbkzjsiok`, no uno nuevo)
   * [ ] `render.yaml` corregido para apuntar al Supabase real, no a la base propia de Render
   * [ ] Redis real configurado (no el stub en memoria) — bloqueante para BullMQ (Ventana 4)
   * [ ] Ventanas 3, 4 y 5 verificadas de punta a punta, no solo escritas
   * [ ] Webhooks de Stripe, MP, Booking.com y Expedia registrados
   * [ ] Emails probados en producción (Resend)
   * [ ] Google Sheets exportando correctamente (solo lectura)
   * [ ] iCal feeds accesibles públicamente, con UID propio verificado
   * [ ] Panel admin protegido con JWT
   * [ ] Rate limiting activo
   * [ ] Logs con timestamps en America/Sao_Paulo (logger propio, no Winston)
   * [ ] Health check respondiendo
   * [ ] Fechas de Carnaval del año en curso cargadas en `system_config`
   * [ ] Landing estática de lapacasahostel.com publicada (dominio raíz resuelto)
   * [ ] Evaluado el upgrade de tier pago en Railway/Render/Supabase/Upstash antes de recibir pagos reales de producción (riesgo de cold-start perdiendo webhooks documentado en el Maestro)
   * [ ] Suite de tests formal commiteada al repo (pendiente desde Ventana 2)

LO QUE QUEDA PARA EL FUTURO (FASE 2)
* Frontend público de booking en Next.js (reemplaza la landing estática del entregable 2)
* PWA con notificaciones push
* SEO y analytics
* Integración nativa con API de Booking.com (certificación de partner ampliada)
* Certificación como partner de Airbnb (para eventualmente tener webhooks de reservas en lugar de solo iCal)
* App móvil para administración
* Multi-idioma en frontend (PT/EN/ES)

CONSIDERACIONES ESPECIALES
* El deploy se hace en Railway o Render (gratuito para empezar); ver riesgo aceptado de cold-starts en el Maestro antes de operar con pagos reales
* Supabase tiene backups automáticos en plan gratuito
* Upstash Redis tiene persistencia en plan gratuito — evaluar si se adopta ahora, dado que hoy el caché/BullMQ dependen de un stub en memoria
* Los workers de BullMQ corren en el mismo proceso del backend (una vez implementados en Ventana 4)
* Los logs no rotan vía Winston (no está en el proyecto) — definir el mecanismo real de rotación antes de asumir que existe
* Health check se puede conectar a UptimeRobot para monitoreo 24/7
* El dominio lapacasahostel.com apunta a la landing estática de esta ventana (no queda sin servir nada); el backend va en api.lapacasahostel.com

CRITERIOS DE ACEPTACIÓN
* Backend responde en api.lapacasahostel.com (o URL de Railway/Render), contra el Supabase real
* lapacasahostel.com sirve la landing estática (no 404 ni placeholder de la plataforma de hosting)
* Health check retorna 200 con todos los servicios OK
* Webhooks de Stripe, MP, Booking.com y Expedia reciben eventos correctamente
* iCal feeds accesibles vía URL pública
* Panel admin accesible con login
* Backup de base de datos se puede restaurar
* Documentación clara para un desarrollador nuevo, que distinga lo verificado de lo no probado
* Colección Postman permite probar todos los endpoints
* Alerta de fechas de Carnaval faltantes se dispara correctamente en un test simulado

PREGUNTAS QUE DEBEN QUEDAR RESPONDIDAS
1. ¿`render.yaml` ya quedó corregido para apuntar al Supabase real antes de este deploy?
2. ¿Cómo hacemos deploy sin downtime?
3. ¿Cómo monitoreamos overbooking y conflictos entre canales en producción?
4. ¿Cómo hacemos backup y restore de la base de datos?
5. ¿Qué alertas configuramos y quién las recibe?
6. ¿Cómo escalamos si el hostel crece a más propiedades?
7. ¿Qué sirve el dominio raíz mientras no existe el frontend de Fase 2?

ENTREGA FINAL
Al final de esta ventana se entrega el sistema completo en producción:
* URL del backend
* URL del panel admin
* URL de feeds iCal
* URL de la landing estática del dominio raíz
* Colección Postman
* Documentación completa
* Checklist de todo lo implementado verificado (no solo escrito)
* Guía para la Fase 2 (frontend público, que reemplaza la landing estática)
