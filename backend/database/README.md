# Ventana 1 — Base de datos (Channel Manager, Lapa Casa Hostel)

Capa SQL completa: extensiones, ENUMs, 17 tablas, constraint `EXCLUDE`
anti-overbooking, funciones de pricing/disponibilidad/locks, triggers y
procedimientos programados. Es deliberadamente independiente de Prisma:
Ventana 2 introduce el schema de Prisma **sincronizado** con lo que hay
acá (ver `REQUISITO CRÍTICO #6` del Prompt Maestro — Prisma consume estas
funciones vía `$queryRaw`, nunca reimplementa la lógica).

## Estructura

```
database/
├── migrations/        # DDL, en orden, cada archivo idempotente vía schema_migrations
│   ├── 0001_extensions_and_enums.sql
│   ├── 0002_tables.sql
│   ├── 0003_exclude_constraint.sql
│   ├── 0004_pricing_functions.sql
│   ├── 0005_availability_and_locks.sql
│   ├── 0006_triggers.sql
│   └── 0007_procedures.sql
├── seeds/
│   └── 0001_seed.sql  # 45 camas, 5 habitaciones, canales, rate_plans, etc.
├── scripts/
│   ├── db.js           # conexion pg compartida
│   ├── migrate.js       # aplica migraciones pendientes
│   ├── seed.js           # aplica seeds (una sola vez)
│   └── reset.js          # SOLO DEV: DROP SCHEMA public CASCADE
└── tests/
    └── test-scenarios.js # los 13 escenarios de validacion (ver mas abajo)
```

## Instalación y arranque local

Requiere Postgres 16+ con las extensiones `btree_gist` y `pgcrypto`
disponibles (ambas vienen por defecto en Supabase).

```bash
# 1. Crear base y usuario de desarrollo (una sola vez)
sudo -u postgres psql -c "CREATE USER lapa_dev WITH PASSWORD 'lapa_dev_pw' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE lapa_casa_hostel OWNER lapa_dev;"

# 2. Configurar la conexion
cp ../.env.example ../.env
# editar DATABASE_URL si hace falta

# 3. Instalar dependencias (pg)
cd .. && npm install

# 4. Migrar y sembrar
npm run db:migrate
npm run db:seed

# 5. Correr los 13 escenarios de prueba
npm run db:test
```

Para reiniciar todo desde cero en desarrollo:

```bash
npm run db:reset   # pide --yes-i-am-sure internamente si se corre directo
node database/scripts/reset.js --yes-i-am-sure
npm run db:migrate
npm run db:seed
```

## Qué garantiza esta capa (REQUISITO CRÍTICO #1)

Jerarquía de mecanismos anti-overbooking, de mayor a menor autoridad:

1. **`EXCLUDE USING gist`** sobre `reservation_beds` (migración 0003) — autoridad
   final. Verificado en los tests: incluso deshabilitando el trigger de
   aplicación, un `INSERT` con fechas solapadas para la misma cama es
   rechazado por Postgres.
2. **`acquire_bed_locks()`** — advisory locks (`pg_advisory_xact_lock`) para
   evitar reintentos costosos bajo alta contención. Los `bed_id` se ordenan
   antes de bloquear para prevenir deadlocks entre transacciones concurrentes.
3. **`trg_prevent_overbooking`** — backstop con mensaje de error claro,
   redundante a propósito con la verificación que hará la capa de aplicación
   (Ventana 2) antes del `INSERT`.

El mecanismo de liberación real es `trg_release_beds_on_status_change`: al
pasar una reserva a `cancelled` o `no_show`, borra sus filas de
`reservation_beds` — es lo que efectivamente libera la cama a nivel del
`EXCLUDE` constraint, sin importar qué código cambió el estado.

## Funciones SQL (única fuente de verdad — REQUISITO CRÍTICO #6)

| Función | Volatilidad | Uso |
|---|---|---|
| `check_availability(check_in, check_out, gender)` | STABLE | disponibilidad detallada por cama |
| `acquire_bed_locks(bed_ids[])` | VOLATILE | advisory locks, dentro de la transacción activa |
| `get_flexible_room_status(room_type_id, target_date)` | STABLE | estado/predicción de conversión de Flexible 7 |
| `calculate_season_multiplier(check_in)` | STABLE | lee `rate_plans` + `system_config.carnival_dates` |
| `calculate_group_discount(beds)` | IMMUTABLE | tramos fijos 7-15/16-25/26+ |
| `calculate_early_bird_discount(booking_date, check_in)` | IMMUTABLE | 5% si 30+ días |
| `calculate_final_price(base, nights, beds, check_in, booking_date)` | STABLE | orden exacto del Maestro |
| `calculate_channel_net_revenue(guest_price, channel_id)` | STABLE | reporting interno, nunca afecta el precio del huésped |
| `calculate_deposit(total, beds)` | IMMUTABLE | 30% / 50% |
| `calculate_cancellation_refund(final_price, check_in, cancel_at)` | STABLE | tramos de `cancellation_policies` |
| `get_min_nights(check_in)` | STABLE | mínimo de noches por temporada |

Ventana 2 debe invocarlas todas vía `$queryRaw` / `$executeRaw` de Prisma.
Ninguna debe reimplementarse en JavaScript.

## Decisiones de diseño que van más allá del Maestro (documentadas a propósito)

- **`payment_type` y `payment_provider`**: no están en la lista literal de
  "ESTADOS DEL SISTEMA" del Maestro, pero son necesarios para modelar
  depósito/saldo y Stripe/MercadoPago. Se agregan en Ventana 1 para no violar
  la política de "nunca `ALTER TYPE` en silencio en una ventana posterior".
- **`reservations.guest_gender`**: no aparece explícito en el Maestro, pero es
  necesario para poder validar la regla "solo mujeres en F1-F7 hasta 48h antes".
- **`audit_logs.guest_id` / `audit_logs.reservation_id`**: columnas explícitas
  además del par genérico `entity_type`/`entity_id`, para poder cumplir
  literalmente la política de FK del Maestro (`guests`/`reservations` →
  `audit_logs` = `RESTRICT`). Confirmado en los tests: no se puede borrar una
  reserva que ya generó un registro de auditoría sin borrar antes ese registro.
- **`calculate_cancellation_refund`**: no está en la lista explícita de
  REQUISITO CRÍTICO #6, se agregó igual por ser una regla de negocio con
  tramos fijos que no debe reimplementarse en JS.
- **Carnaval en `system_config`**: sembrado solo para 2026 y 2027 como
  ejemplo — requiere verificación y mantenimiento anual contra el calendario
  oficial (ver Maestro, alerta de Ventana 6). Cualquier fecha fuera de esos
  años cae en el cálculo mensual genérico (alta/media/baja), **no** en
  Carnaval, hasta que se cargue el año correspondiente.

## Los 13 escenarios de prueba (`npm run db:test`)

1. Reserva directa feliz — precio y depósito vía funciones SQL
2. Concurrencia real (2 conexiones separadas) por la última cama de una sala de prueba
3. El `EXCLUDE` constraint rechaza el overlap con el trigger deshabilitado
4. OTA con webhook (Booking.com) → `confirmed` inmediato, sin timeout
5. OTA solo iCal (Hostelworld) → `pending_ota_confirmation`, igual bloquea la cama
6. `sp_cleanup_expired_pending` cancela y libera camas tras 15 min
7. Reservas OTA exentas del timeout de 15 min
8. `sp_release_no_show` libera camas a las 23:59 América/São Paulo
9. Flexible 7 se convierte a mixto sin reservas femeninas dentro de la ventana
10. Flexible 7 permanece femenino con una reserva femenina dentro de la ventana
11. La conversión es por fecha específica (otra fecha no se afecta) y es idempotente
12. Matriz de precios (temporada × grupo × early bird), comisión de canal independiente
13. Depósitos 30%/50% según tamaño de grupo

Corren contra Postgres real (no mocks), limpian sus propios datos al final
y son re-ejecutables sin dejar residuos.

## Pendiente para Ventana 2

- `prisma/schema.prisma` sincronizado con este schema (UUID, todos los enums,
  incluido `pending_ota_confirmation`)
- Servicios Node (`availability-service.js`, `booking-service.js`,
  `pricing-service.js`, etc.) que invocan estas funciones vía `$queryRaw`
  dentro de `prisma.$transaction`
- El código TypeScript viejo bajo `backend/src/` (services, routes,
  repositories) queda obsoleto: fue escrito contra un schema distinto
  (`cuid`, sin `reservation_beds`/`channels`/etc.) y será reemplazado
  íntegramente en Ventana 2. `backend/src/database/prisma/seed.ts` quedó
  además colgando sin su `schema.prisma` (se borró en esta ventana junto con
  las migraciones viejas, incompatibles con este diseño).
