-- lapa-casa-hostel/backend/database/migrations/0032_referral_codes.sql
--
-- Programa de referidos (idea #49, roadmap.html): cada huésped que
-- completa una reserva recibe un código propio para compartir. Reusa
-- apartment_offers en vez de una tabla nueva -- create-booking.ts y
-- POST /offers/validate ya validan y aplican códigos de ahí para
-- CUALQUIER reserva (hostel o apartamento: la única restricción que
-- chequean es apartment_ids, y NULL/vacío ahí significa "aplica a
-- todos"), así que un código de referido es, funcionalmente, una fila
-- más en esa tabla -- sin tocar la lógica de precios ya en producción.
--
-- referral_owner_guest_id es lo único nuevo: NULL en los cupones que ya
-- existían (los crea el admin a mano) y con el guest_id del titular en
-- los que genera el sistema al confirmar una reserva. Sirve para saber,
-- cuando alguien redime un código, a quién premiar.

ALTER TABLE apartment_offers
  ADD COLUMN IF NOT EXISTS referral_owner_guest_id UUID REFERENCES guests(id);

CREATE INDEX IF NOT EXISTS idx_apartment_offers_referral_owner
  ON apartment_offers (referral_owner_guest_id)
  WHERE referral_owner_guest_id IS NOT NULL;
