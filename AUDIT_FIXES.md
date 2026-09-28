# Auditoría del motor de reservas — conflictos resueltos

## Calidad (CAL)

| ID | Archivo | Descripción |
|----|---------|-------------|
| CAL-01 | `hostel-guest-form.tsx` | `EMAIL_RE` extraída como constante de módulo (evita recompilación por render) |
| CAL-02 | `hostel-calendar.tsx` | `MS_PER_DAY = 86_400_000` reemplaza magic number `86400000` |
| CAL-03 | `hostel-step4-summary.tsx` | Check-in usa `fmtDate(checkIn)` en vez de string hardcodeado |
| CAL-04 | `hostel-step4-summary.tsx` | Porcentaje de depósito calculado dinámicamente (`Math.round(...)`) |
| CAL-05 | `hostel-step4-summary.tsx` | Porcentaje restante calculado como `100 - Math.round(...)` |
| CAL-06 | `hostel-step4-summary.tsx` | Nota de depósito usa `{t.checkin}` en vez de `'Check-in'` hardcodeado |
| CAL-07 | `hostel-engine.tsx` + 6 mensajes JSON | `← Home` reemplazado por `{t.navHome}`; clave añadida a pt/es/en/fr/de/it |
| CAL-08 | `hostel-success-panel.tsx` | Eliminado fallback hardcodeado `?? 'Ir al pago con tarjeta →'` |
| CAL-09 | `hostel-step4-summary.tsx`, `hostel-success-panel.tsx` | `'...'` → `'…'` (elipsis Unicode real) en botones de carga |
| CAL-10 | `hostel-success-panel.tsx` | Eliminado `t.pixKey` duplicado del `he-success-note` |
| CAL-11 | `hostel-guest-form.tsx` | `RULE_ICONS` declarado como constante de módulo con tipo explícito |
| CAL-12 | `hostel-success-panel.tsx` | `COPY_FEEDBACK_MS = 3_000` reemplaza magic number `3000` |
| CAL-13 | `hostel-guest-form.tsx` | `DOC_PHOTO_MAX_PX = 900` y `DOC_PHOTO_JPEG_QUALITY = 0.82` como constantes |
| CAL-14 | `hostel-room-selector.tsx` | `revealed: Record<string, boolean>` en vez de tipo fijo `{ cuarto3; cuarto5 }` |
| CAL-15 | `hostel-room-selector.tsx` | `overflowId` dinámico para lógica `plusDisabled`; eliminado cast hardcodeado |

## Vestigios (VES)

| ID | Archivo | Descripción |
|----|---------|-------------|
| VES-01 | `hostel-engine.tsx` | Eliminado comentario de ruta de archivo (`// frontend/src/...`) |
| VES-02 | `hostel-engine.types.ts` | Eliminado comentario de ruta de archivo |
| VES-03 | `hostel-calendar.tsx` | Eliminado comentario de ruta de archivo |
| VES-04 | `hostel-engine.styles.ts` | Eliminado comentario de ruta de archivo |
| VES-05 | `hostel-engine-lazy.tsx` | Eliminada referencia `(idea #28, roadmap.html)` del comentario |
| VES-06 | `hostel-guest-form.tsx` | Eliminada referencia `(idea #49, roadmap.html)` del JSDoc |
| VES-07 | `hostel-guest-form.tsx` | Eliminado comentario JSX con referencia al roadmap |
| VES-08 | `hostel-success-panel.tsx` | Eliminada referencia `(idea #49, roadmap.html)` del JSDoc |

## Código muerto (MUERTO)

| ID | Archivo | Descripción |
|----|---------|-------------|
| MUERTO-01 | `hostel-engine.utils.ts` | Eliminada constante `WEEK` (solo existía para comparación incorrecta) |
| MUERTO-02 | `hostel-calendar.tsx` | Eliminado IIFE `minNightsWarn` y `div.he-min-warn` (nunca se mostraba) |

## Strings hardcodeados — i18n roto (I18N)

| ID | Archivo | Descripción |
|----|---------|-------------|
| I18N-01 | `hostel-step4-summary.tsx` | Fechas de check-in/checkout usan `fmtDate()` + claves `t.*` |
| I18N-02 | `hostel-step4-summary.tsx` | Porcentajes y etiqueta de check-in localizados |
| I18N-03 | `hostel-engine.tsx` | Botón "← Home" / "← Inicio" internacionalizado con `t.navHome` |
| I18N-04 | `hostel-success-panel.tsx` | Fallback de tarjeta eliminado; queda solo `t.cardGoToPayment` |

## TypeScript inseguro (TS)

| ID | Archivo | Descripción |
|----|---------|-------------|
| TS-01 | `lib/api.ts`, `use-hostel-wizard.ts` | `ApiRoom` interface exportada; `any[]` → `ApiRoom[]`; cast `(ar: any)` eliminado |
| TS-02 | `lib/api.ts`, `hostel-engine.tsx` | `ValidateCouponResponse` interface exportada; cast manual eliminado en call site |

## Bugs altos — datos incorrectos para el usuario (BUG)

| ID | Archivo | Descripción |
|----|---------|-------------|
| BUG-01 | `hostel-engine.utils.ts` | `isBrazilHoliday`: comparación `<= WEEK` → igualdad exacta; evitaba reservas válidas |
| BUG-02 | `hostel-engine.utils.ts` | `getSeason()` alta temporada: `minNights:1` → `minNights:2`; validación de mínimo activa |
| BUG-03 | `use-hostel-wizard.ts` | `handleCalClick`: `date < checkIn` → `date <= checkIn`; bloquea reservas de 0 noches |
| BUG-04 | `use-hostel-payment.ts` | Fallback `Math.random()` como código de reserva eliminado; queda string vacío |
| BUG-05 | `hostel-step4-summary.tsx` | Fila "Total" aplica `mult` (recargo tarjeta) igual que depósito y saldo restante |

## Fix de compilación (BUILD)

| ID | Archivo | Descripción |
|----|---------|-------------|
| BUILD-01 | `backend/src/routes/bookings/create-hostel-booking.ts` | `monthly_limit: number \| null` añadido al tipo `appliedOffer`; `tsc` fallaba con TS2339 |
