-- 0059: LCH = Lapa Casa Hostel; ninguna reserva de apartamento puede llevar ese prefijo.
-- Las reservas de apartamento importadas de OTAs antes del arreglo salieron como LCH-...;
-- se renombran a LCA-... (el resto del numero queda igual). Idempotente.
UPDATE reservations r
   SET reservation_number = 'LCA-' || substr(r.reservation_number, 5)
 WHERE r.reservation_number LIKE 'LCH-%'
   AND EXISTS (
     SELECT 1
     FROM reservation_beds rb
     JOIN room_types rt ON rt.id = rb.room_type_id
     WHERE rb.reservation_id = r.id AND rt.property_type = 'apartment'
   )
   AND NOT EXISTS (
     SELECT 1 FROM reservations x WHERE x.reservation_number = 'LCA-' || substr(r.reservation_number, 5)
   );
