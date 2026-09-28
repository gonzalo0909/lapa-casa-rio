-- 0055_apartments_visible_but_unbookable.sql
--
-- Corrige 0054: despublicar (published_snapshot = NULL) sacaba los
-- apartamentos del todo del sitio público -- a pedido explícito, lo que
-- se quiere es que SIGAN VISIBLES (fotos, nombre, precio) pero que NO
-- se puedan reservar. Eso ya existe como concepto en la API pública:
-- el campo "available" (availability.routes.ts / apartment-availability.ts)
-- es lo que hoy hace que la tarjeta muestre "Indisponível" y el botón
-- "Selecionar" se deshabilite, sin ocultar la tarjeta -- se reusa esa
-- misma señal en vez de inventar una nueva.
--
-- 1) Repuebla published_snapshot (con el contenido en vivo actual) para
--    los apartamentos que 0054 dejó en NULL, así vuelven a aparecer en
--    el listado público. listing_status queda en 'pending_review' (no
--    se tocan acá) -- apartment-availability.ts (próximo commit) exige
--    listing_status = 'approved' además de que no haya conflicto de
--    fechas para que "available" dé true, así que quedan visibles pero
--    no reservables hasta que un admin los apruebe.
-- 2) Cinelândia 185 no se toca -- ya tiene snapshot y sigue 'approved'.

UPDATE room_types rt
SET published_snapshot = jsonb_build_object(
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
