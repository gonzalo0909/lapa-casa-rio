-- 0036_fix_apartment_property_type.sql
--
-- Corrige apartamentos que foram inseridos antes da migração 0018 e ficaram
-- com property_type = 'hostel' (o DEFAULT). O seed 0002 usa ON CONFLICT DO
-- NOTHING, portanto se as linhas já existiam não foram atualizadas.
--
-- Critério de identificação: code com prefixo 'apt-' — o mesmo padrão usado
-- no seed e no mapa de ícones do frontend (apartment-card.tsx).
--
-- Também garante que cada apartamento tenha exatamente 1 bed com prefixo
-- 'APT-', replicando o INSERT do seed para os casos onde o bed nunca foi
-- criado (e.g., seed rodado antes da coluna property_type existir, portanto
-- o WHERE do seed nunca encontrou as linhas).

UPDATE room_types
SET property_type = 'apartment'
WHERE code LIKE 'apt-%'
  AND property_type = 'hostel';

INSERT INTO beds (room_type_id, bed_code)
SELECT rt.id, 'APT-' || RIGHT(rt.code, 2)
FROM room_types rt
WHERE rt.property_type = 'apartment'
  AND NOT EXISTS (
    SELECT 1 FROM beds b WHERE b.room_type_id = rt.id
  )
ON CONFLICT (bed_code) DO NOTHING;
