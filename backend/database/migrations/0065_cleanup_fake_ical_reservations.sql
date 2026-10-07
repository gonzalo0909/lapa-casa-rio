-- 0065: limpieza única de reservas FALSAS importadas por iCal ("<canal> (iCal)", sin huésped real).
-- Se cancelan (igual que una cancelación de la OTA: status = 'cancelled', libera las fechas) las que:
--   1) duran más de 180 noches: son el "cierre de horizonte" de la OTA, no una estadía;
--   2) (solo apartamentos) tienen TODAS sus noches ya ocupadas por algo que nació en Lapa Casa
--      (reserva de otro canal/directa o un bloqueo): son el eco de lo que Lapa le exportó a la OTA.
-- Solo toca reservas vigentes (check-out de hoy en adelante). Idempotente. El código de sync
-- (ical-service.ts) ya no vuelve a crear ninguna de las dos clases.
WITH fake AS (
  SELECT r.id
  FROM reservations r
  JOIN guests g ON g.id = r.guest_id
  WHERE r.channel_id IS NOT NULL
    AND r.status IN ('confirmed', 'pending_ota_confirmation')
    AND r.check_out_date >= CURRENT_DATE
    AND g.full_name ~* '\(iCal\)\s*$'
    AND (
      (r.check_out_date - r.check_in_date) > 180
      OR (
        COALESCE(r.source, '') !~ '_ical_block$'
        AND EXISTS (
          SELECT 1
          FROM reservation_beds rb
          JOIN room_types rt ON rt.id = rb.room_type_id AND rt.property_type = 'apartment'
          WHERE rb.reservation_id = r.id
            AND NOT EXISTS (
              SELECT 1
              FROM generate_series(rb.check_in, rb.check_out - 1, interval '1 day') d
              WHERE NOT (
                EXISTS (
                  SELECT 1
                  FROM reservation_beds o
                  JOIN reservations ores ON ores.id = o.reservation_id
                  WHERE o.room_type_id = rb.room_type_id
                    AND ores.id <> r.id
                    AND ores.status <> 'cancelled'
                    AND ores.channel_id IS DISTINCT FROM r.channel_id
                    AND d::date >= o.check_in AND d::date < o.check_out
                )
                OR EXISTS (
                  SELECT 1 FROM room_blocks bl
                  WHERE bl.room_type_id = rb.room_type_id
                    AND d::date >= bl.start_date AND d::date < bl.end_date
                )
              )
            )
        )
      )
    )
)
UPDATE reservations
   SET status = 'cancelled',
       cancelled_at = now(),
       cancellation_reason = 'ota_cancellation'
 WHERE id IN (SELECT id FROM fake);
