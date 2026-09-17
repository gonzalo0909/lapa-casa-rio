# Bugs Resueltos — Motor de Reservas de Apartamentos
**Repositorio:** gonzalo0909/lapa-casa-rio  
**Rama de trabajo:** claude/serene-gates-0b2z3s  
**Mergeado a:** definitivo2026  
**Fecha:** 2026-09-16  

---

## Bug 1 — Locale italiano ausente en el mini-calendario
**Archivo:** `frontend/src/components/booking/apartment-mini-calendar.tsx`  
**Descripción:** El mapa local `BCP47` no incluía la entrada `it: 'it-IT'`. Los usuarios con idioma italiano (IT) veían nombres de mes y día de semana en el fallback `pt-BR` en lugar de italiano.  
**Fix:** Se agregó `it: 'it-IT'` al mapa local `BCP47`.

---

## Bug 2 — Reserva duplicada al retroceder desde el paso de pago
**Archivo:** `frontend/src/components/booking/apartment-engine.tsx`  
**Descripción:** Al hacer clic en "Atrás" desde el paso 4 (pago), la función `goBack()` no limpiaba el estado `booking`. Al volver al paso 4, `handleReserve()` detectaba un `booking` existente y lo reutilizaba, o peor, podía crear un segundo booking sin anular el anterior. Esto generaba reservas duplicadas en estado `pending_payment`.  
**Fix:** Se agregó `setBooking(null)` en el caso `step === 4` de `goBack()`, de modo que el booking anterior expire naturalmente (~5 min) y se cree uno nuevo al re-enviar.

---

## Bug 3 — `aria-label` incorrecto en botones de cupón y foto
**Archivos:**  
- `frontend/src/components/booking/apartment-guest-form.tsx`  
- `frontend/src/messages/pt.json`, `en.json`, `es.json`, `fr.json`, `de.json`, `it.json`  

**Descripción:** Tres botones usaban erróneamente `aria-label={t('removeGuest')}` (etiqueta para eliminar huéspedes) en elementos que no tienen que ver con huéspedes:  
- El botón × para remover un cupón de descuento  
- El botón para limpiar la foto del titular  
- El botón para limpiar la foto del acompañante  

Esto afecta accesibilidad (lectores de pantalla) y es semánticamente incorrecto.  
**Fix:** Se crearon dos nuevas claves de traducción (`couponRemove`, `clearPhoto`) en los 6 archivos de mensajes, y se actualizaron los tres botones para usar la clave correcta.

---

## Bug 4 — `guestCount` no se pasaba a la API de disponibilidad en el mini-calendario
**Archivos:**  
- `frontend/src/components/booking/apartment-mini-calendar.tsx`  
- `frontend/src/components/booking/apartment-card.tsx`  
- `frontend/src/components/booking/apartment-selector-step.tsx`  

**Descripción:** Al verificar disponibilidad desde el mini-calendario (botón "Aplicar" con nuevas fechas), la llamada a `availabilityAPI.checkApartments()` omitía el parámetro `guests`. El backend podía devolver disponibilidad incorrecta si el número de huéspedes superaba la capacidad del apartamento.  
**Fix:** Se añadió la prop `guestCount?: number` a `ApartmentMiniCalendarProps` y a `ApartmentCardProps`, se enhebró el valor desde `ApartmentSelectorStep` → `ApartmentCard` → `ApartmentMiniCalendar`, y se incluye en la llamada a la API cuando está presente.

---

## Bug 5 — Límite de huéspedes hardcodeado en el selector de apartamento
**Archivo:** `frontend/src/components/booking/apartment-selector-step.tsx`  
**Descripción:** El counter de huéspedes del paso 2 usaba el literal `2` como máximo (`Math.min(2, guestCount + 1)` / `disabled={guestCount >= 2}`), en lugar de la constante `MAX_APT_GUESTS` definida en `apartment-engine.types.ts`. Si el valor de la constante cambiara en el futuro, el paso 2 quedaría desincronizado con los demás pasos.  
**Fix:** Se importó `MAX_APT_GUESTS` desde `apartment-engine.types` y se reemplazaron ambas referencias al literal `2`.

---

## Bug 6 — Condicional muerto `{guestCount > 0 && ...}` en el formulario de huéspedes
**Archivo:** `frontend/src/components/booking/apartment-guest-form.tsx`  
**Descripción:** El bloque que renderiza la sección de declaración de huéspedes estaba envuelto en `{guestCount > 0 && (...)}`. Como `guestCount` siempre es ≥ 1 cuando se llega al paso 3 (mínimo 1 huésped por diseño), la condición nunca podía ser falsa. Era código muerto que añadía confusión.  
**Fix:** Se eliminó el wrapper condicional. El bloque ahora se renderiza directamente.

---

**Total de archivos modificados:** 11  
**Inserciones:** 40  
**Eliminaciones:** 17  
**Commit de merge:** 056af0a (fast-forward a definitivo2026)
