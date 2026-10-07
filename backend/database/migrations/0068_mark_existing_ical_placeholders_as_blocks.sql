-- 0068: las reservas importadas por iCal sin huésped real ("<canal> (iCal)") son bloqueos de fechas, no
-- ventas. Se marcan como `<canal>_ical_block` y sin precio para sacarlas de estadísticas y conteos
-- (siguen ocupando la unidad). Solo toca vigentes (check-out de hoy en adelante). Idempotente.
UPDATE reservations r
   SET source = c.code::text || '_ical_block',
       final_price = 0
  FROM guests g, channels c
 WHERE g.id = r.guest_id
   AND c.id = r.channel_id
   AND r.channel_id IS NOT NULL
   AND g.full_name ~* '\(iCal\)\s*$'
   AND COALESCE(r.source, '') !~ '_ical_block$'
   AND r.status <> 'cancelled'
   AND r.check_out_date >= CURRENT_DATE;
