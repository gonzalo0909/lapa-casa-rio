# Correcciones — Motor de Reservas de Apartamentos
**Fecha:** 17 de septiembre de 2026  
**Rama:** `definitivo2026`  
**Archivos modificados:** 4

---

## Bug 1 — Pantalla de pago se abría sin estado `paySuccessOpen`

**Problema:** Al confirmar la reserva, el flujo avanzaba al paso 4 (pago) pero `paySuccessOpen` no se inicializaba en `true`, por lo que el componente de pago arrancaba en un estado inconsistente.

**Archivo:** `frontend/src/components/booking/apartment-engine.tsx`

**Corrección:** Se añadió `setPaySuccessOpen(true)` antes de `setStep(4)` dentro de `handleReserve()`.

---

## Bug 2 — Campos de acompañantes no se validaban al intentar reservar

**Problema:** Al pulsar "Reservar", los campos de nombre y documento de los acompañantes no mostraban error aunque estuvieran vacíos o con DNI/CPF inválido. El formulario permitía avanzar con datos de acompañantes incompletos.

**Archivos:**
- `frontend/src/components/booking/apartment-engine.tsx`
- `frontend/src/components/booking/apartment-guest-form.tsx`

**Corrección:**
- Se añadió el estado `submitAttempted` en el motor principal y se pasa como prop al formulario.
- Se implementó la validación `companionsOk` en `canReserve`: verifica nombre no vacío y, si el documento es numérico, que sea un CPF de 11 dígitos válido.
- En el formulario, los bordes rojos de los campos de acompañantes se activan con `submitAttempted || companionTouched`.
- Al volver del paso 3 al paso 2 se resetea `submitAttempted` a `false`.

---

## Bug 3 — Foto de documento del titular no era obligatoria

**Problema:** Se podía completar la reserva sin subir la foto del documento de identidad del titular. El campo de carga no mostraba ningún error visual al intentar avanzar sin foto.

**Archivos:**
- `frontend/src/components/booking/apartment-engine.tsx`
- `frontend/src/components/booking/apartment-guest-form.tsx`
- `frontend/src/components/booking/apartment-engine.module.css`

**Corrección:**
- Se añadió `documentPhoto` a la condición `canReserve`.
- Se añadió la clase CSS `.docUploadSlotError` con borde rojo (paleta `#FCA5A5`) para modo claro y oscuro.
- El slot de carga aplica `.docUploadSlotError` cuando `submitAttempted` es `true` y no hay foto subida.

---

## Bug 4 — No se hacía scroll al seleccionar fechas (paso 1 → 2)

**Problema:** Al confirmar las fechas en el paso 1 y avanzar al paso 2 (selector de apartamento), la vista no hacía scroll hacia el contenido del paso 2. El usuario debía desplazarse manualmente.

**Archivo:** `frontend/src/components/booking/apartment-engine.tsx`

**Corrección:** Se añadió la llamada a `scrollToContent()` al final de `handleDatesContinue()`, justo después de `setStep(2)` y `loadApartments()`.

---

## Bug 5 — Condición de carrera en el mini-calendario de apartamento

**Problema:** Si el usuario cambiaba las fechas varias veces rápido desde el mini-calendario del apartamento seleccionado, varias peticiones de disponibilidad podían resolverse fuera de orden. La última respuesta en llegar (no necesariamente la más reciente) sobreescribía el estado de disponibilidad, pudiendo dejar el estado inconsistente.

**Archivo:** `frontend/src/components/booking/apartment-engine.tsx`

**Corrección:** Se introdujo un ref contador de secuencia `miniCalSeq`. Cada llamada a `handleMiniCalendarApply` captura su número de secuencia; si al resolverse la promesa el contador ya fue incrementado por una llamada más reciente, la respuesta se descarta silenciosamente. El `setIsLoadingApartments(false)` en `finally` solo se ejecuta si la secuencia sigue siendo la activa.

---

## Bug 6 — Sin indicador de carga al cambiar fechas con apartamento ya seleccionado

**Problema:** Cuando el usuario ajustaba las fechas desde el mini-calendario con un apartamento seleccionado (estados A o B del selector), no había ninguna indicación visual de que se estaba recargando la disponibilidad. El botón "Continuar" permanecía activo durante la carga.

**Archivos:**
- `frontend/src/components/booking/apartment-selector-step.tsx`
- `frontend/src/components/booking/apartment-engine.module.css`

**Corrección:**
- En el estado A (seleccionado y disponible): se reemplaza el `<h2>` del nombre del apartamento por un indicador de texto `tc('loading')` mientras `isLoading` es `true`; además, `onContinue` se pasa como `undefined` (deshabilitando el botón) durante la carga.
- En el estado B (seleccionado pero no disponible): se añade el mismo indicador de texto bajo el datePill.
- Se añadió la clase CSS `.loadingInline` con tipografía reducida y color muted.

---

## Bug 7 — `selectedApartment` se perdía al cambiar fechas

**Problema:** Al cambiar las fechas desde el mini-calendario, si la nueva lista de disponibilidad no incluía el apartamento previamente seleccionado (o lo incluía pero sin disponibilidad), `selectedApartment` se reseteaba a `null` en lugar de preservarse para mostrar el banner de "no disponible para estas fechas" con alternativas.

**Archivo:** `frontend/src/components/booking/apartment-engine.tsx`

**Corrección:** En la función que actualiza `selectedApartment` tras recargar disponibilidad, se cambió `updated ?? null` por `updated ?? prev`, de modo que si el apartamento seleccionado no aparece en la nueva lista, el estado conserva el valor anterior en lugar de vaciarse.

---

*Todas las correcciones fueron mergeadas directamente a `definitivo2026` el 17 de septiembre de 2026.*
