-- 0013_fix_pending_timeout_label.sql
--
-- sp_cleanup_expired_pending() (0007_procedures.sql) etiquetaba la
-- cancelación automática por hold vencido como 'auto_timeout_15min',
-- pero el hold real siempre fue de 5 minutos (ver
-- booking-service.ts::createBooking, `Date.now() + 5 * 60 * 1000`) --
-- la etiqueta nunca reflejo el valor real. Se renombra a un valor que no
-- depende del numero de minutos (para que un cambio futuro del hold no
-- vuelva a desincronizar la etiqueta del valor real).

CREATE OR REPLACE PROCEDURE sp_cleanup_expired_pending()
LANGUAGE plpgsql AS $$
BEGIN
  WITH cancelled AS (
    UPDATE reservations
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'auto_timeout_pending_expired'
    WHERE status = 'pending_payment'
      AND pending_expires_at IS NOT NULL
      AND pending_expires_at < now()
    RETURNING id, guest_id, reservation_number
  )
  INSERT INTO audit_logs (entity_type, entity_id, operation, guest_id, reservation_id, new_data)
  SELECT 'reservation', id, 'CANCEL', guest_id, id,
         jsonb_build_object('reason', 'auto_timeout_pending_expired', 'reservation_number', reservation_number)
  FROM cancelled;
END;
$$;
