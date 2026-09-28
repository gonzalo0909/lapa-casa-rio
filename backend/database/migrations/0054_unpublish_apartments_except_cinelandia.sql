-- 0054_unpublish_apartments_except_cinelandia.sql
--
-- 0053 aprobó en bloque todos los apartamentos que habían quedado
-- pendientes, para que el sitio no quedara vacío -- fue un empujón de
-- emergencia, no una revisión real uno por uno. A pedido explícito:
-- se despublican todos de nuevo (vuelven a 'pending_review' y se les
-- borra el published_snapshot, así que desaparecen del sitio público y
-- quedan no reservables -- "estáticos", solo visibles/editables desde
-- /owner y /admin), excepto "Cinelândia 185", que se deja publicado y
-- reservable.
--
-- El owner sigue pudiendo editar/subir fotos de los despublicados como
-- siempre -- solo dejaron de estar aprobados para el público. Un admin
-- los vuelve a aprobar individualmente desde /admin/apartments.html
-- cuando los revise.

-- Salvaguarda: si por algún motivo el nombre no matchea ningún
-- apartamento (typo, ya renombrado, etc.), no hace nada en vez de
-- despublicar Cinelândia 185 también por accidente -- un RAISE
-- EXCEPTION acá tumbaría el deploy entero (migrate.js corre antes de
-- levantar el server), así que se avisa por NOTICE (queda en los logs
-- de Fly.io) y se sigue de largo sin tocar la tabla.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM room_types
    WHERE property_type = 'apartment' AND name ILIKE '%Cinel%185%'
  ) THEN
    UPDATE room_types
    SET listing_status = 'pending_review',
        listing_submitted_at = now(),
        published_snapshot = NULL
    WHERE property_type = 'apartment'
      AND name NOT ILIKE '%Cinel%185%';
  ELSE
    RAISE NOTICE 'Migración 0054: ningún apartamento matchea ''%%Cinel%%185%%'' -- no se despublicó nada, revisar el nombre real.';
  END IF;
END $$;
