# PROMPT MAESTRO — LAPA CASA HOSTEL
## Reconstrucción dirigida: cierre de Apartamentos + rescate de Hostel · 14-ago-2026

Prompt maestro generado a partir de una auditoría real con 3 sub-agentes sobre 2 artefactos de referencia (LCACOPIA y esquema explicativo) cotejados contra `origin/main` y las ramas remotas. No es especulativo — cada punto de este documento tiene evidencia verificada (archivo:línea o rama:archivo) en la auditoría del 14-ago-2026.

## ROL
Sos el desarrollador a cargo de cerrar dos frentes de trabajo independientes en lapacasa.com: (1) terminar 3 desviaciones puntuales del motor de Apartamentos, ya en producción; (2) rescatar el motor de Hostel, actualmente fuera de `main` pero recuperable desde una rama remota. Los dos frentes no comparten código ni bloquean entre sí — se pueden trabajar en paralelo o en cualquier orden.

## CONTEXTO DEL PROYECTO
lapacasa.com corre sobre un único backend (Express + PostgreSQL) que hoy sirve un solo motor activo: **Apartamentos** (`ApartmentEngine`). El motor de **Hostel** (`BookingEngine`) fue removido de `main` en el commit `e9a7800` por decisión deliberada del dueño del proyecto (no es un bug, fue una decisión de scope) — pero el código no se perdió, sigue existiendo en ramas remotas.

Diseño de referencia de Apartamentos: mockup **LCACOPIA**, flujo de 4 pasos (Datas → Apartamento → Resumo → Pagamento), paleta navy `#1E3A5F` / dorado `#C8870A`.

## ESTADO REAL VERIFICADO (auditoría 14-ago-2026, 3 sub-agentes, evidencia citada)

### Apartamentos — 7/10 conforme, 3 gaps reales
Archivos: `frontend/src/components/booking/apartment-engine.tsx` (839 líneas), `apartment-card.tsx`, `apartment-mini-calendar.tsx`, `apartment-seasons.ts`, `frontend/src/components/payment/{payment-processor,pix-payment,card-payment}.tsx`.

**Cumple exacto (no tocar):** hero/paleta, steps 1-4, contador de huéspedes, CPF/doble-email/teléfono, cancelación en acordeón, banner OTA, botón WhatsApp, pasarela real PIX/Tarjeta (Stripe + Mercado Pago — la sustitución del QR decorativo de LCACOPIA por pago real es correcta, no es un gap).

**Gap 1 — Calendario sin tinte de Carnaval.** `apartment-seasons.ts:9-13` documenta que las fechas de Carnaval viven en `system_config` sin endpoint que las exponga al frontend. Hoy solo existe un chip de leyenda estático (`seasonChipCarnaval`) que nunca se aplica a las celdas reales del calendario (`apartment-engine.tsx:230-282`).
→ Tarea: exponer un endpoint (`GET /system-config/carnival-dates` o similar) y aplicar la clase de tinte a las celdas del rango real.

**Gap 2 — Mini-calendario de cada tarjeta no avisa de días bloqueados.** La clase CSS `.miniDayBlocked{background:#FEE2E2;color:#991B1B}` existe en `apartment-engine.module.css:192` pero nunca se referencia en `apartment-mini-calendar.tsx`. El huésped solo se entera del conflicto después de tocar "Aplicar", no antes.
→ Tarea: aplicar `.miniDayBlocked` a los días no disponibles al renderizar el mini-calendario, no solo al validar el submit.

**Gap 3 — Confirmación de pago sin modal.** `apartment-engine.tsx:801-810` (`.paySuccess`) es un panel inline dentro de la página; LCACOPIA especifica un modal/overlay con fondo oscurecido.
→ Tarea: convertir el panel de confirmación en un modal (`position:fixed`, backdrop), reusando el patrón de overlay si ya existe uno en el proyecto.

**Pendiente de verificar antes de tocar Hostel (duda abierta del consolidador):** confirmar si `calendar.tsx` del motor de Hostel comparte código o lógica con el calendario de Apartamentos que tiene el Gap 1 — si comparten, arreglar el endpoint de Carnaval una sola vez puede resolver ambos motores a la vez.

### Hostel — recuperable, base clara identificada
El esquema explicativo lista 12 componentes esperados del `BookingEngine`. Ninguno vive en `main` hoy. Se auditaron 2 ramas candidatas:

| Rama | Completitud | Estado |
|---|---|---|
| `origin/Motorreservashostel` | **11/12 archivos**, todos con contenido real (imports, hooks, i18n `next-intl`, sin placeholders) | Base a usar |
| `origin/claude/hostel-booking-engine-ld40jx` | 7/12 — perdió `booking-engine.tsx` (orquestador), `room-card.tsx`, `room-selector.tsx`, `gender-selector.tsx`, `flexible-room-notice.tsx` | No usar como base — pivoteó a mitad de camino hacia trabajo de Apartamentos, último commit real del motor es del 09-ago |

**Tarea 1 — Portar el componente faltante.** `Motorreservashostel` no tiene `guest-count-stepper.tsx`; sí existe en `ld40jx` (66 líneas, componente chico y aislado). Portarlo tal cual o reconstruirlo desde `guest-form.tsx` de `Motorreservashostel` si el estilo no coincide.

**Tarea 2 — Reconciliar 2 archivos divergentes.** `calendar.tsx` y `pricing-calculator.tsx` existen en ambas ramas con implementaciones distintas (no son el mismo commit). Antes de integrar, decidir explícitamente cuál versión usar — no asumir que son intercambiables. (Ver duda abierta arriba: revisar primero si esto se conecta con el Gap 1 de Apartamentos.)

**Los 4 archivos idénticos entre ambas ramas** (`date-range-picker.tsx`, `group-discount-display.tsx`, `price-breakdown.tsx`, `season-multiplier-display.tsx`) no necesitan decisión — son el mismo código en las dos.

**Tarea 3 — Reintegración.** Una vez completo el set de 12 archivos sobre la base de `Motorreservashostel`, decidir cómo se reactiva la pestaña Hostel en el home (hoy el botón "Hostel" del hero es decorativo, sin acción — confirmado en auditoría previa `Esquema vs. Main`). Esto es una decisión de producto, no solo de código: implica volver a mostrar las 2 pestañas que el esquema explicativo describía originalmente.

## RESTRICCIONES
- No tocar nada del motor de Apartamentos que la tabla marcó como "cumple exacto" — son conformes, no se re-implementan.
- No reactivar la pestaña Hostel en el home sin confirmación explícita del dueño del proyecto — sacarla fue una decisión deliberada, no un error a revertir por default.
- Cualquier cambio a `calendar.tsx` (sea el de Apartamentos o el de Hostel) debe evaluar primero si afecta al otro motor, dada la duda abierta de código compartido.

## FORMA DE TRABAJO
Cada tarea de este prompt (Gaps 1-3 de Apartamentos, Tareas 1-3 de Hostel) es independiente y auditable por separado con el mismo patrón usado para generar este documento: sub-agente de implementación → sub-agente de auditoría (CLAIM/ARTEFACTO/BASELINE contra este prompt) → consolidador.
