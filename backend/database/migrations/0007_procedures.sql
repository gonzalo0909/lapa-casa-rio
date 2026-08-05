-- 0007_procedures.sql
-- Lapa Casa Hostel - Channel Manager
--
-- Procedimientos programados. Estos procedimientos NO se autoejecutan y
-- NO usan pg_cron: quedan inertes hasta que Ventana 4 los invoque desde
-- BullMQ con `CALL sp_x()` (ver ARQUITECTURA DEL SISTEMA, punto 6, y
-- REQUISITO CRITICO #1, punto 7 del Maestro).

-- ============================================================
-- sp_cleanup_expired_pending: libera reservas directas con pago
-- pendiente vencido (>15 min). Las reservas OTA (pending_expires_at IS
-- NULL) estan exentas -- no requieren pago en el sistema. El DELETE de
-- reservation_beds ocurre solo, disparado por trg_release_beds_on_status_change
-- (migracion 0006) al cambiar el status a 'cancelled'.
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_cleanup_expired_pending()
LANGUAGE plpgsql AS $$
BEGIN
  WITH cancelled AS (
    UPDATE reservations
    SET status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = 'auto_timeout_15min'
    WHERE status = 'pending_payment'
      AND pending_expires_at IS NOT NULL
      AND pending_expires_at < now()
    RETURNING id, guest_id, reservation_number
  )
  INSERT INTO audit_logs (entity_type, entity_id, operation, guest_id, reservation_id, new_data)
  SELECT 'reservation', id, 'CANCEL', guest_id, id,
         jsonb_build_object('reason', 'auto_timeout_15min', 'reservation_number', reservation_number)
  FROM cancelled;
END;
$$;

-- ============================================================
-- sp_release_no_show: marca no_show a reservas confirmadas cuyo
-- check-in ya paso las 23:59 America/Sao_Paulo del dia de check-in sin
-- que se haya registrado el ingreso (checked_in_at IS NULL). Usa
-- check_in_date <= hoy (no solo "= hoy") para ser robusto ante corridas
-- tardias del proceso programado (catch-up).
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_release_no_show()
LANGUAGE plpgsql AS $$
BEGIN
  WITH released AS (
    UPDATE reservations
    SET status = 'no_show'
    WHERE status = 'confirmed'
      AND checked_in_at IS NULL
      AND check_in_date <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND now() >= brt_midnight(check_in_date) + interval '23 hours 59 minutes'
    RETURNING id, guest_id, reservation_number
  )
  INSERT INTO audit_logs (entity_type, entity_id, operation, guest_id, reservation_id, new_data)
  SELECT 'reservation', id, 'CONVERT', guest_id, id,
         jsonb_build_object('reason', 'no_show_release_2359_america_sao_paulo', 'reservation_number', reservation_number)
  FROM released;
END;
$$;

-- ============================================================
-- sp_process_flexible_conversion: evalua, para cada habitacion flexible
-- y cada fecha de check-in dentro de la ventana configurada en
-- system_config.flexible_conversion_hours (48h por defecto), si
-- corresponde convertir esa fecha especifica a mixto (REQUISITO CRITICO
-- #2). Es idempotente: NOT EXISTS sobre room_conversion_logs asegura
-- que una fecha ya decidida jamas se reevalua (irreversibilidad). El
-- rango de fechas candidatas (current_date .. +3 dias) es deliberadamente
-- mas amplio que la ventana de conversion para tolerar que el
-- proceso no corra exactamente en el instante del corte de 48h.
-- ============================================================
CREATE OR REPLACE PROCEDURE sp_process_flexible_conversion()
LANGUAGE plpgsql AS $$
DECLARE
  v_conversion_hours NUMERIC;
BEGIN
  SELECT COALESCE((value #>> '{}')::NUMERIC, 48) INTO v_conversion_hours
  FROM system_config WHERE key = 'flexible_conversion_hours';
  v_conversion_hours := COALESCE(v_conversion_hours, 48);

  WITH candidate_dates AS (
    SELECT generate_series(current_date, current_date + interval '3 days', interval '1 day')::date AS target_date
  ),
  converted AS (
    INSERT INTO room_conversion_logs (room_type_id, target_date, converted_from, converted_to, reason)
    SELECT rt.id, cd.target_date, 'female', 'mixed', 'no_female_reservations_within_conversion_window'
    FROM room_types rt
    CROSS JOIN candidate_dates cd
    WHERE rt.is_flexible = true
      AND brt_midnight(cd.target_date) > now()
      AND EXTRACT(EPOCH FROM (brt_midnight(cd.target_date) - now())) / 3600 <= v_conversion_hours
      AND NOT EXISTS (
        SELECT 1 FROM room_conversion_logs rcl
        WHERE rcl.room_type_id = rt.id AND rcl.target_date = cd.target_date
      )
      AND NOT EXISTS (
        SELECT 1
        FROM reservation_beds rb
        JOIN reservations r ON r.id = rb.reservation_id
        JOIN beds b ON b.id = rb.bed_id
        WHERE b.room_type_id = rt.id
          AND rb.check_in = cd.target_date
          AND r.guest_gender = 'female'
      )
    RETURNING id, room_type_id, target_date
  )
  INSERT INTO audit_logs (entity_type, entity_id, operation, new_data)
  SELECT 'room_conversion', id, 'CONVERT',
         jsonb_build_object('room_type_id', room_type_id, 'target_date', target_date)
  FROM converted;
END;
$$;
