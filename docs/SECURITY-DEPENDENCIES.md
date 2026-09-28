# Dependencias con vulnerabilidades conocidas — riesgo aceptado

Sección 10 de la auditoría de 17 secciones (Seguridad — Backend, "Dependencias/npm audit").
Evaluación caso por caso de las vulnerabilidades que reporta `npm audit` en `backend/` y
`frontend/`, después de aplicar todo lo que sí se pudo resolver sin romper nada:

- `backend`: `npm audit fix` (sin `--force`) se corrió realmente — no aplicó ningún cambio.
  El propio JSON de `npm audit` marca algunas entradas como `fixAvailable: true`, pero al
  intentar aplicarlas de verdad, npm no logra resolverlas sin forzar un upgrade mayor en un
  paquete padre (`node-ical`, `mercadopago`, `googleapis`). El hallazgo original de la
  auditoría ("ninguna con fix sin upgrade mayor") queda confirmado empíricamente, no solo
  leyendo el reporte.
- `frontend`: se eliminaron `mercadopago` y `@mercadopago/sdk-react`, dos dependencias
  completamente muertas (0 imports reales en `frontend/src`, confirmado por grep) que traían
  la vulnerabilidad de `uuid` -- esto sacó una vulnerabilidad "high" de raíz, sin ningún riesgo,
  ya que el código eliminado nunca se ejecutaba. `npm audit` pasó de 9 a 7 vulnerabilidades.

Lo que queda abajo es lo que **no se puede resolver sin un upgrade mayor** (`isSemVerMajor: true`
en el reporte de npm, o -- en el caso de Next.js -- un salto de major version completo). Para cada
uno: qué es, si el código de este proyecto realmente ejercita la ruta vulnerable, y la decisión.

## Backend

### axios / uuid (vía `node-ical`) — high / moderate
`node-ical` (`0.18.0`, fix requiere `0.27.1`, breaking) trae internamente una versión vieja de
`axios` con vulnerabilidades reales (SSRF, prototype pollution, ReDoS) y de `uuid` (bug de bounds
check en las variantes v3/v5/v6 cuando se le pasa un buffer propio).

**No se ejercitan en este proyecto.** Verificado en `backend/src/integrations/ical/ical-parser.ts`:
el feed iCal se descarga con `fetch()` nativo de Node, con su propio `validateUrl()` (resuelve DNS,
bloquea rangos internos/metadata de nube, no sigue redirects -- fix de una auditoría anterior).
`node-ical` se usa **solo** para `ical.async.parseICS(icalString)`, parseo puro de un string ya
descargado -- su `axios` interno nunca hace una request HTTP real en este código, así que la
vulnerabilidad de SSRF/prototype-pollution de ese `axios` es una ruta muerta. La de `uuid` requiere
pasarle un buffer propio a la función de generación, algo que ni node-ical ni este proyecto hacen.

**Decisión: riesgo aceptado, no se fuerza el upgrade.** Forzar `node-ical@0.27.1` (salto de versión
semver-mayor según la convención 0.x) arriesga romper el parseo real de los feeds de Airbnb/
Hostelworld sin ningún beneficio de seguridad real, dado que la ruta vulnerable no se ejecuta.

### googleapis / gaxios / googleapis-common (vía `uuid`) — moderate
Mismo CVE de `uuid` (bounds check con buffer propio) que arriba, a través de la integración de
Google Sheets (exportación de reservas). El fix requiere `googleapis@176.0.0` (desde `^144.0.0`
actual), un salto mayor de una librería generada automáticamente por Google con superficie enorme.

**Riesgo real bajo**: la condición de la vulnerabilidad (pasar un buffer propio a `uuid`) no es un
patrón que el SDK de Google use internamente para IDs de request. **Decisión: riesgo aceptado.**
Un upgrade de 32 versiones mayores de `googleapis` necesita probarse contra la integración real de
Sheets antes de siquiera considerarlo -- no es algo para forzar en una corrección de auditoría.

### mercadopago (vía `uuid`) — moderate
Mismo CVE de `uuid`, esta vez a través del SDK de Mercado Pago que sí se usa activamente en el
backend para crear pagos/PIX reales (`^2.0.6` actual, fix requiere `3.6.0`, mayor). Mismo
razonamiento de no-explotabilidad que arriba (el SDK no pasa buffers propios a `uuid`).
**Decisión: riesgo aceptado por ahora**, pero es el de más prioridad de esta lista para revisar
cuando haya tiempo de probar un pago real de PIX/tarjeta contra el SDK v3 en un entorno de test de
Mercado Pago -- es la única dependencia de esta lista que toca dinero real de un huésped.

### @typescript-eslint/* y minimatch — high (solo devDependencies)
Herramientas de lint, nunca se ejecutan en producción. `npm audit fix` (sin --force, corrido de
verdad) no logró resolverlas sin forzar `@typescript-eslint` a su v7/v8 -- otro salto de versión
mayor. **Decisión: riesgo aceptado**, impacto real nulo (no corren en el servidor desplegado).

## Frontend

### next.js (`14.2.35` → `16.3.3`) — high, la más seria de toda la lista
El reporte de `npm audit` lista más de 20 CVEs reales sobre Next.js: SSRF y HTTP request
smuggling en `rewrites()`, bypass de middleware, DoS/SSRF en Server Actions, cache poisoning,
entre otros. **Este proyecto sí usa las features nombradas**: `rewrites()` (proxy a `/api/*` en
`next.config.js`), `middleware.ts` (ruteo de locale vía next-intl), y Server Actions habilitadas
(`experimental.serverActions` en `next.config.js`) -- a diferencia de `node-ical`, acá no se puede
argumentar que la ruta vulnerable esté muerta.

El fix requiere saltar de Next 14 a Next 16 (saltándose la 15 entera) -- cambios de breaking cambios
conocidos (APIs de request asíncronas, requiere React 19, cambios en `next/image`, etc.). Migrar
esto a ciegas, sin poder desplegar y probar en un navegador real contra Stripe/Mercado Pago/GA4 en
vivo, es más riesgoso que el problema que resuelve.

**Decisión: riesgo aceptado por ahora, pero es la prioridad #1 de esta lista.** Recomendación
explícita: dedicar una sesión aparte, exclusiva, a la migración a Next 15 primero (paso intermedio)
y después 16, con testing manual completo del flujo de reserva/pago end-to-end en cada paso -- no
intentarlo como parte de una corrección de auditoría más amplia.

### next-intl (`^3.17.1` → `4.14.1`) — moderate
Dos CVEs: open redirect, y prototype pollution vía `experimental.messages.precompile`.
Confirmado por grep: **`precompile` no se usa en este proyecto** -- esa vulnerabilidad puntual no
aplica. El open redirect sí podría aplicar al ruteo de locale. **Decisión: riesgo aceptado**, con
prioridad media -- vale la pena revisar cuando se actualice next-intl junto con el resto del stack
de i18n (ver también la tarea pendiente del locale "it", sección 5).

### sharp (`^0.33.4` → `0.35.4`) — high
CVEs de `libvips` (la librería de procesamiento de imágenes que usa `sharp` por debajo) --
corrupción de memoria al procesar archivos de imagen maliciosos. No se usa directamente en el
código (0 imports en `frontend/src`) -- lo usa `next/image` internamente para optimizar imágenes.
Esto es relevante porque esta misma auditoría (sección 2) migró `guest-gallery.tsx` a `next/image`,
que procesa fotos subidas por huéspedes vía el panel admin -- son imágenes con más influencia
externa que assets estáticos propios, aunque no son subidas directas de un usuario anónimo del
sitio (pasan por moderación del admin antes de publicarse). **Decisión: riesgo aceptado**, pero
por este motivo puntual es la segunda prioridad de la lista, después de Next.js (con el que además
comparte parte del breaking-change).

### glob / eslint-config-next — high (solo devDependencies)
Command injection en la CLI de `glob` vía flags `-c`/`--cmd` -- ESLint nunca invoca `glob` de esa
forma (solo como librería de matching de archivos). Dev-only, no llega a producción.
**Decisión: riesgo aceptado**, impacto real nulo.

## Resumen de prioridad si se decide invertir tiempo en esto

1. **Next.js 14→16** -- la única con vector de ataque real y alcanzable (rewrites, middleware,
   Server Actions activamente usados). Requiere una migración dedicada, no un fix rápido.
2. **sharp** -- relacionado con next/image, mismo bloque de trabajo que el anterior.
3. **mercadopago (backend)** -- toca pagos reales, aunque la condición de explotación es
   improbable.
4. El resto (`node-ical`, `googleapis`, `next-intl`, herramientas de dev) -- riesgo real bajo o
   nulo, sin apuro.
