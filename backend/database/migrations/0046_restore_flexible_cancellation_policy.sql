-- 0046_restore_flexible_cancellation_policy.sql
--
-- Cambio de politica explicito del dueño: se vuelve a permitir el
-- reembolso del deposito cuando la cancelacion ocurre con 7+ dias de
-- antelacion al check-in (tramo "full_refund", min_hours_before = 168 en
-- cancellation_policies, ver 0002_tables.sql y el seed 0001_seed.sql).
-- Cancelaciones dentro de esos 7 dias, o no-show, siguen sin reembolso
-- (tramos "partial_refund" y "no_refund" quedan en 0).
--
-- Reemplaza el criterio de 0014_no_refund_cancellation_policy.sql (sin
-- reembolso nunca, sin ventana de gracia) solo para el tramo de 7+ dias.
--
-- calculate_cancellation_refund() (0004_pricing_functions.sql) no
-- necesita cambios: la logica de tramos ya vive enteramente en esta
-- tabla, no hardcodeada en la funcion.

UPDATE cancellation_policies SET refund_percent = 1.0000, updated_at = now() WHERE label = 'full_refund';
