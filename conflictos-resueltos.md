# Conflictos resueltos — Motor de reservas de apartamentos
Fecha: 2026-09-16 · Rama: `claude/apartment-booking-engine-errors-xw2584` → mergeado a `definitivo2026`

---

## 1. Stale closure bug — `guestCount` faltaba en `useCallback`
**Archivo:** `frontend/src/components/booking/apartment-engine.tsx` · línea 185

**Problema:** `handleMiniCalendarApply` usaba la variable `guestCount` dentro del callback pero no estaba declarada en el array de dependencias de `useCallback`. Esto generaba un "stale closure": si el usuario cambiaba el número de huéspedes en el Paso 2 y luego ajustaba fechas desde el mini-calendario, la consulta de disponibilidad se hacía con el valor viejo de `guestCount`, pudiendo mostrar resultados incorrectos.

**Corrección:**
```diff
- [locale],
+ [locale, guestCount],
```

---

## 2. Non-null assertions sobre `currentPhoto` en la card de apartamento
**Archivo:** `frontend/src/components/booking/apartment-card.tsx` · líneas 110–111

**Problema:** Se usaba `currentPhoto!.url` y `currentPhoto!.altText` con aserciones non-null (`!`). Si `photoIdx` quedara fuera de rango (por ejemplo, al cambiar el array `apartment.photos` mientras el índice es mayor que cero), `currentPhoto` sería `undefined` y causaría un error en runtime.

**Corrección:**
```diff
- src={currentPhoto!.url}
- alt={currentPhoto!.altText ?? apartment.name}
+ src={currentPhoto?.url ?? ''}
+ alt={currentPhoto?.altText ?? apartment.name}
```

---

## 3. Non-null assertion en `Intl.DateTimeFormat.formatToParts().find()` — utils
**Archivo:** `frontend/src/components/booking/apartment-engine.utils.ts` · línea 80

**Problema:** `hourParts.find((p) => p.type === 'hour')!.value` usaba `!` para forzar un valor que `.find()` podría no encontrar. Si el entorno no retornara un part de tipo `'hour'`, el acceso a `.value` lanzaría un `TypeError`.

**Corrección:**
```diff
- const hourBrt = parseInt(hourParts.find((p) => p.type === 'hour')!.value, 10);
+ const hourBrt = parseInt(hourParts.find((p) => p.type === 'hour')?.value ?? '0', 10);
```

---

## 4. Non-null assertion en `Intl.DateTimeFormat.formatToParts().find()` — mini-calendario
**Archivo:** `frontend/src/components/booking/apartment-mini-calendar.tsx` · línea 61

**Problema:** Mismo patrón que el punto 3, duplicado en el componente de mini-calendario.

**Corrección:**
```diff
- const hourBrt = parseInt(hourParts.find((p) => p.type === 'hour')!.value, 10);
+ const hourBrt = parseInt(hourParts.find((p) => p.type === 'hour')?.value ?? '0', 10);
```

---

## Resumen de impacto

| # | Tipo | Severidad | Efecto en producción |
|---|------|-----------|----------------------|
| 1 | Bug lógico (stale closure) | Alta | Búsqueda de disponibilidad con huéspedes incorrectos al cambiar fechas en Paso 2 |
| 2 | Posible crash en runtime | Media | `TypeError` si `photoIdx` queda fuera de rango al cambiar fotos |
| 3 | Posible crash en runtime | Baja | `TypeError` en entornos donde `Intl` no retorna part `hour` |
| 4 | Posible crash en runtime | Baja | Ídem punto 3, en el mini-calendario |

---

**Commit:** `3af7fcd`
**Pusheado a:** `origin/definitivo2026`
