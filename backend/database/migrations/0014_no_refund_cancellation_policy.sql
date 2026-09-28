-- 0014_no_refund_cancellation_policy.sql
--
-- Cambio de politica explicito del dueño: se pasa de 3 tramos por
-- antelacion (100% / 7+ dias, 50% / 2-7 dias, 0% / <48h) a un solo
-- criterio, sin ventana de gracia -- el deposito pagado (unico monto que
-- se cobra online por defecto, ver 0012_card_surcharge_config.sql y el
-- cambio de "70% se paga en el hostel") se pierde siempre que la reserva
-- se cancele o sea no-show, sin importar con cuanta anticipacion.
--
-- calculate_cancellation_refund() (0004_pricing_functions.sql) no
-- necesita cambios: la logica de tramos ya vive enteramente en esta
-- tabla, no hardcodeada en la funcion.

UPDATE cancellation_policies SET refund_percent = 0, updated_at = now();
