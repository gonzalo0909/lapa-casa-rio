# Reporte de auditoría — Motor de reservas Hostel (Lapa Casa Rio)

Fecha: 2026-10-03 · Rama auditada: `claude/nifty-archimedes-hdccys` (= `definitivo2026`, 61 commits, 2026-09-26 → 2026-10-03)
Alcance: foco en el motor hostel (`frontend/src/components/booking/hostel-*`, `use-hostel-*`, `backend/src/routes/bookings/create-hostel-booking.ts` y servicios que usa), más un barrido de todo el repo para código muerto, conflictos y rastros de IA.
Método: lectura del código, `tsc --noEmit`, `eslint`, y un script propio que lista exports sin consumidores y archivos sin imports (en scratchpad, no versionado). **No se modificó código ni se hizo commit.**

> Limitación: `npm ci` se corrió con `--ignore-scripts`, así que `prisma generate` no corrió y `tsc` del backend marca 3 errores de Prisma (`PrismaClient`/`Prisma` no exportados). Son un artefacto de mi entorno, no un bug del repo. El `tsc` del frontend pasa limpio.

---

## 1. Rastros de Claude Code / Anthropic

| Hallazgo | Detalle | Gravedad |
|---|---|---|
| **Autoría 100 % Claude** | Los 61 commits tienen autor `Claude <noreply@anthropic.com>`. No hay un solo commit con identidad humana. | Informativo (pero relevante para quien audite el repo) |
| Trailers en commits | 58 commits con `Co-Authored-By: Claude Sonnet 5 / 5.5 <noreply@anthropic.com>` y ~58 con `Claude-Session: https://claude.ai/code/session_...` (6 sesiones distintas). Los URLs de sesión quedan en el historial público. | Medio: filtra IDs de sesión; reescribir historial no es recomendable, mejor decidir si se quiere seguir agregándolos |
| Ramas | `claude/dazzling-pascal-cgf34q` mergeada a `definitivo2026`; la rama actual es `claude/nifty-archimedes-hdccys` | Bajo |
| `.gitignore` | Ignora `.claude/` (correcto: no hay config de Claude versionada). | OK |
| `AUDIT_FIXES.md` (raíz) | Documento generado por IA, con IDs tipo `CAL-01`, `VES-05`, `BUG-03`. Es un changelog de una auditoría anterior, no documentación del producto. Ver §4: **algunas afirmaciones no coinciden con el código actual**. | Medio |
| Jerga de "ventanas" | Comentarios y docs hablan de "Ventana 1/2/4/6" (fases del plan de trabajo con la IA): `database/migrations/0002, 0004, 0005, 0007`, `backend/database/README.md:111,138,158`, y en `.gitignore:16` (`# ventana4: dump de redis...`). Referencian un plan que no existe en el repo. | Bajo |
| Referencias a `roadmap.html` / "idea #NN" | `frontend/src/components/layout/whatsapp-float-button.tsx:2` (idea #48), `app/[locale]/layout.tsx:45,106` (idea #45), `apartment-engine.types.ts:57` (idea #49). `AUDIT_FIXES.md` dice que se limpiaron del motor hostel (VES-05..08), pero siguen en otros archivos. `roadmap.html` no existe. | Bajo |
| Comentarios "narrativos" | Muchos comentarios explican la historia del cambio en vez del código: `backend/src/templates/render.ts:54` ("BUG (encontrado armando el email de referidos…)"), `config/prisma.ts` ("causó la eliminación de Prisma en el commit fb1f4ea"), `routes/bookings/create-hostel-booking.ts` (cutoff, "no mezclar con comparación de string…"). Estilo típico de sesiones de IA; útiles pero ruidosos. | Bajo |
| Datos de ejemplo hardcodeados | `whatsapp-notification-service.ts`: `ADMIN_PHONES = ['+5521999999999']` (número placeholder) y un `TODO: activar WhatsApp Business API` en la cabecera. | Medio (ver §3) |
| Dependencias de SDK | No hay `@anthropic-ai/*` ni llamadas a la API de Claude en el producto. No hay llaves ni referencias a Anthropic en el código ejecutable. | OK |

## 2. Código spaghetti (motor hostel y alrededores)

1. **Lógica de feriados triplicada.** Frontend `hostel-engine.utils.ts` (Butcher + lista de feriados), backend `utils/brazil-holidays.ts` (misma lista), y `special_period_rules` / `holiday_default_blocks` en SQL (migraciones 0039–0045, 0049). El propio comentario del frontend admite "duplica la lógica del backend". Cualquier cambio de negocio hay que hacerlo en 3 lugares. Además, el motor **bloquea por completo** ±7 días alrededor de cada feriado nacional (≈15 días × 17 feriados/año; ver `hostel-calendar.tsx:97` y `backend/src/utils/brazil-holidays.ts:106-118`) mientras que 0045 introdujo reglas de período especial con noches mínimas: dos modelos distintos para el mismo problema.
2. **Temporada duplicada y desalineada.** `getSeason()` en `hostel-engine.utils.ts` hardcodea meses y multiplicadores (alta 1.5, baja 0.8, `minNights` 2) y se usa para pintar el calendario, validar mínimo de noches (`use-hostel-wizard.ts:239`) y mostrar un precio de referencia. La fuente de verdad real es SQL (`get_season_type`, `season-type.ts`) + `dynamic-pricing`. Si cambian las reglas en backend, el front sigue validando con las viejas.
3. **Hooks con dependencias incompletas** (eslint `react-hooks/exhaustive-deps`): `use-hostel-wizard.ts:94` (`showToast` se usa en un effect y se declara *después* — funciona solo por el cierre tardío), `use-hostel-pricing.ts:68` (`totalBeds`), `use-hostel-payment.ts:157` (`setForm`).
4. **Regla "cuarto 6 es femenino" copiada dos veces** en `use-hostel-payment.ts` (`handleConfirm` y `handleGroupSession`, mismo cálculo de `c6`/`gender`). `handleGroupSession` además tipa `'male'` que nunca se produce.
5. **God-hook de pago.** `use-hostel-payment.ts` (339 líneas) mezcla timer, Pix, Stripe, WhatsApp, pago grupal, referidos y reset de ~25 estados; `handleNewBooking` resetea a mano cada `useState`. Frágil: agregar un estado y olvidar el reset es fácil.
6. **Handler de creación de reserva (backend) hace de todo** (`create-hostel-booking.ts`, 306 líneas): validación de fechas, feriados, blacklist, pricing, cupones con SQL inline, código de referido (SELECT + INSERT en `apartment_offers` — el hostel escribe en una tabla "apartment"), subida de fotos, `booking_guests`, notificaciones y respuesta. Se repite en gran parte en `create-apartment-booking.ts` (406 líneas).
7. **Pares de rutas casi idénticos** en `backend/src/routes/payments/`: `deposit-mp-card.ts` vs `apartment-deposit-mp-card.ts` (171/185 líneas) y `process-deposit.ts` vs `apartment-process-deposit.ts` (129/136). Diferencias de ~70–100 líneas de diff; copy-paste con retoques.
8. **Dos clases llamadas `NotificationService`**: `services/notification-service.ts:81` (email) y `services/whatsapp-notification-service.ts:40` (WhatsApp, exportada como `whatsappNotificationService`). Confuso al importar/depurar.
9. **Dos capas de Redis**: `config/redis.ts` (envoltorio `redisCache`) encima de `cache/redis-client.ts` (485 líneas); los consumidores importan ya sea uno o el otro.
10. **Dos accesos a base de datos**: SQL crudo con `pg` para el núcleo y Prisma solo para owners/apartamentos (`config/prisma.ts`, un segundo `Pool`). Está documentado como decisión consciente, pero duplica pools y modelos mentales.
11. **Strings hardcodeados con fallback** que `AUDIT_FIXES.md` dice haber eliminado: `hostel-engine.tsx` mantiene `t.lblName ?? 'Nome completo'` y `t.lblEmail ?? 'E-mail'`. También `'Santa Teresa'`, `'Hostel'` y `'Rio de Janeiro'` directos en el JSX.
12. **Tipado débil**: 191 warnings de eslint en backend (casi todos `no-explicit-any`; concentrados en `admin.routes.ts` (15) y `apartment-owners.routes.ts` (10)) y 30 en el frontend revisado (`lib/api.ts` con 14 `any`). Un error real de eslint: `property-selector-hero.tsx:7` (`react` importado dos veces).
13. **Archivos largos**: `admin.routes.ts` 1386 líneas, `email-service.ts` 1310, `grupos/page.tsx` 1065, `group-payment-service.ts` 949, `owner/apartments/[id]/page.tsx` 951.

## 3. Código muerto / inerte

**Confirmado sin ningún uso (exports con 0 referencias, ni siquiera internas):**

- Frontend: `isBrazilHoliday` (`hostel-engine.utils.ts:74`), `generateFAQSchema` (`seo/structured-data.tsx`), tipo `APIResponse` (`lib/api.ts`), `viewport` en `[locale]/layout.tsx` (Next lo usa por convención: **falso positivo**, no borrar).
- Backend: `ICAL_ONLY_CHANNELS`, `ICAL_IMPORT_INTERVAL_MINUTES`, `WEBHOOK_PATHS` (`config/channels.ts`), `getClient` (`config/database.ts`), `disconnectPrisma` (`config/prisma.ts`), `getRedisClient` y `CacheKeys` (`config/redis.ts`), `releaseLock` (`database/lock-middleware.ts`), `messageTemplates` y `whatsAppClient` (`integrations/whatsapp/`).
- **Archivo huérfano**: `backend/src/integrations/whatsapp/message-templates.ts` (351 líneas, nadie lo importa).

**Funcionalidad desactivada de facto:**

- **WhatsApp Business**: todo el stack (`whatsapp-client.ts` 397 líneas + `message-templates.ts` 351 + `whatsapp-notification-service.ts` ~300) está apagado salvo que `WHATSAPP_ENABLED=true`, y el cliente se carga con `require()` dinámico. La reserva hostel igual llama `sendBookingNotification` en cada alta (no hace nada). Casi 1000 líneas sin efecto hasta que se active.
- **Sheets export** (`queues/sheets-export.queue.ts`, `integrations/google-sheets`): verificar que realmente se use en producción (no lo comprobé).
- **Migraciones que se anulan entre sí** (historial acumulado en vez de estado): `0039_remove_carnival` vs `0041_fix_carnival_holiday_dates`, `0014_no_refund` vs `0046_restore_flexible_cancellation_policy`, `0053_bulk_approve…` vs `0054_unpublish_apartments_except_cinelandia`, `0042/0043/0049` (bloques de feriados corregidos tres veces). Son legítimas para una DB viva, pero el esquema final es difícil de leer.
- **Variables que sobran en el estado del hostel**: `reservationId`, `timerSecs` y `minNightsNotice` se devuelven de los hooks y solo se usan internamente / una vez; `price.season` se calcula pero el resumen no lo muestra (solo `pbn` y `subtotal`). Bajo impacto.

**Exports "solo tipo"** (interfaces/props exportadas y no importadas en ningún lado, ~25 en `ui/*`, `ical-service.ts`, `stats-service.ts`, `group-payment-service.ts`): ruido, no código ejecutable.

## 4. Conflictos y contradicciones

1. **`AUDIT_FIXES.md` ≠ código actual** en el punto más sensible: `BUG-01` dice que `isBrazilHoliday` pasó de `<= WEEK` a "igualdad exacta" para evitar rechazar reservas válidas. Hoy el front sigue bloqueando ±7 días (`getBrazilHolidaySet`) y el backend rechaza con `diffDays <= 7` (`brazil-holidays.ts:117`). Ambos están alineados entre sí, pero **no con lo que el changelog afirma**. Confirmar con negocio cuál es la regla correcta y corregir el documento (o el código).
2. **Migraciones con el mismo número**: `0021` (×2), `0032` (×2), `0033` (×3), `0034` (×3), `0039` (×2). `migrate.js` ordena por nombre de archivo (`.sort()`), así que hoy es determinista, pero depende del texto después del número; un renombre cambia el orden y puede romper dependencias (ej. `0039_remove_carnival` / `0039_apartment_holiday_periods`).
3. **Hostel usa `apartment_offers`** para cupones y para el código de referido (`create-hostel-booking.ts`): el esquema mezcla ambos productos y por eso el handler tiene que rechazar explícitamente códigos de referido para hostel.
4. **Prefijos de reserva** (`LCH` hostel / `LCA` apartamento, migraciones 0058–0059): el hostel manda `bookingPrefix: 'LCH'` hardcodeado en el handler; OTA/iCal tiene su propia lógica. Tres sitios deciden el prefijo.
5. **Conflicto de nombres**: dos `NotificationService` (ver §2.8).
6. **Hostel frontend vs backend, rango con feriados**: el calendario deshabilita días sueltos, no el *rango*; elegir check-in antes de una ventana de feriado y check-out después no se detecta en el cliente (no verifiqué que el hover/rango lo impida). El backend responde 422 genérico y el wizard muestra `t.errorBooking`, sin explicar el motivo. Probar manualmente.
7. **CI/hooks**: el pre-commit corre `tsc` de frontend y backend; el `tsc` del backend requiere `prisma generate` previo (el script `postinstall` lo hace; con `--ignore-scripts` falla). Documentar para quien instale sin scripts.
8. **Ramas**: `definitivo2026` y `claude/nifty-archimedes-hdccys` están en el mismo punto; no hay conflictos de merge pendientes.

## 5. Recomendaciones priorizadas

1. Decidir con negocio la regla de feriados (±7 días vs exacto vs `special_period_rules`) y dejar **una sola fuente** (idealmente el backend vía endpoint de disponibilidad, que el front solo pinte).
2. Corregir o borrar `AUDIT_FIXES.md` (rastro de IA con afirmaciones desactualizadas).
3. Borrar el código inerte: `message-templates.ts`, los exports sin uso de §3, y decidir si WhatsApp se activa o se elimina.
4. Renumerar (o al menos congelar con un test) las migraciones duplicadas.
5. Unificar los pares `apartment-*` de pagos en handlers parametrizados.
6. Extraer de `create-hostel-booking.ts` el cupón/referido y las notificaciones a servicios; renombrar `NotificationService` de WhatsApp.
7. Arreglar los 3 warnings de hooks del wizard y el error de eslint en `property-selector-hero.tsx`.
8. Decidir política de trailers (`Co-Authored-By`, `Claude-Session`) y limpiar jerga "Ventana N", "idea #NN", "roadmap.html".
9. Reemplazar el número placeholder de `ADMIN_PHONES` por variable de entorno antes de activar WhatsApp.

---
*Reporte generado por Claude Code a partir de análisis estático; los puntos marcados "no verifiqué" requieren prueba manual.*
