-- 0053_bulk_approve_existing_apartment_listings.sql
--
-- 0051_apartment_listing_approval.sql dejó todos los apartamentos que ya
-- estaban publicados como 'pending_review' (a pedido explícito), sin
-- published_snapshot -- correcto en el momento, pero significó que la
-- página pública se quedó sin ningún apartamento para mostrar hasta que
-- un admin los aprobara uno por uno.
--
-- Para arrancar en vivo ya (junto con 0052, que prende el motor de
-- reservas): aprueba en bloque, con el contenido que cada apartamento
-- tiene cargado ahora mismo, todo lo que sigue sin published_snapshot.
-- De acá en más, cualquier edición nueva (owner-apartments.routes.ts)
-- sigue requiriendo aprobación normal -- esto es un empujón de una sola
-- vez para los que quedaron pendientes por este cambio, no un cambio en
-- las reglas de moderación futuras.

UPDATE room_types rt
SET listing_status = 'approved',
    listing_reviewed_at = now(),
    listing_review_notes = NULL,
    published_snapshot = jsonb_build_object(
      'name', rt.name,
      'description', rt.description,
      'neighborhood', rt.neighborhood,
      'bedrooms', rt.bedrooms,
      'bathrooms', rt.bathrooms,
      'amenities', rt.amenities,
      'address', rt.address,
      'address_number', rt.address_number,
      'cep', rt.cep,
      'photos', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'image_url', p.image_url,
            'display_order', p.display_order,
            'is_primary', p.is_primary,
            'alt_text', p.alt_text
          )
          ORDER BY p.display_order ASC, p.created_at ASC
        )
        FROM room_type_photos p
        WHERE p.room_type_id = rt.id
      ), '[]'::jsonb)
    )
WHERE rt.property_type = 'apartment' AND rt.published_snapshot IS NULL;
