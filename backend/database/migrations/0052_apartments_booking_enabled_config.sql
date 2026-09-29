-- 0052_apartments_booking_enabled_config.sql
--
-- Antes, si un apartamento se veía o no en el sitio dependía únicamente
-- de la aprobación de contenido (0051_apartment_listing_approval.sql).
-- Pero el motor de reservas de apartamentos en sí (frontend/src/components/
-- booking/apartment-engine.tsx) tenía un interruptor total, hardcodeado en
-- el código (APARTMENTS_BOOKING_ENABLED = false), sin forma de prenderlo/
-- apagarlo sin un deploy. Esta migración lo mueve a system_config y lo
-- deja en true a pedido explícito (arrancar en vivo ya, junto con
-- 0053_bulk_approve_existing_apartment_listings.sql que aprueba lo que
-- había quedado pendiente) -- se apaga/prende desde /admin (pestaña
-- Configuración de apartamentos) sin necesitar otro deploy.
--
-- Leído por GET /availability/apartment-config (público, ver
-- availability.routes.ts) y editado por PUT /admin/pricing.

INSERT INTO system_config (key, value, description) VALUES
  (
    'apartments_booking_enabled',
    'true',
    'Interruptor general del motor de reservas de apartamentos (Sí/No). Con esto en false la página de apartamentos muestra "Reservas em breve" en vez del wizard, aunque haya apartamentos aprobados. Editable desde /admin/apartments.html (pestaña Configuración).'
  )
ON CONFLICT (key) DO NOTHING;
