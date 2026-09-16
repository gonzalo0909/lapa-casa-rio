-- 0002_seed_apartments.sql
--
-- 10 apartamentos reales. Cada uno es 1 fila en room_types + 1 fila en
-- beds (la unidad completa = 1 cama, ver comentario de diseño ya
-- existente en apartment-availability.ts). default_gender='mixed'
-- porque el camino de apartamentos no filtra por elegibilidad de
-- genero (ver availability-service.ts) -- mixed es lo semanticamente
-- correcto para una unidad completa sin logica de camas por sexo.
--
-- Datos (nombre, capacidad, precio) y orden de codigo tomados de
-- LCACOPIA (docs/mralapagon/lcacopia.html, array APARTMENTS) -- los
-- codigos apt-01..apt-10 ya coinciden con el mapa de iconos
-- hardcodeado en frontend/src/components/booking/apartment-card.tsx.
--
-- Requiere 0018_room_type_property_type.sql aplicada antes.

INSERT INTO room_types (code, name, capacity, default_gender, is_flexible, base_price, property_type) VALUES
  ('apt-01', 'Lapa Loft',            2, 'mixed', false, 280.00, 'apartment'),
  ('apt-02', 'Vista do Arco',        3, 'mixed', false, 320.00, 'apartment'),
  ('apt-03', 'Chalé da Rua',         2, 'mixed', false, 260.00, 'apartment'),
  ('apt-04', 'Apt. Selarón',         4, 'mixed', false, 380.00, 'apartment'),
  ('apt-05', 'Suíte Santa Teresa',   2, 'mixed', false, 350.00, 'apartment'),
  ('apt-06', 'Quarto do Samba',      2, 'mixed', false, 420.00, 'apartment'),
  ('apt-07', 'Estúdio Bohemio',      2, 'mixed', false, 240.00, 'apartment'),
  ('apt-08', 'Apt. Centro',          3, 'mixed', false, 480.00, 'apartment'),
  ('apt-09', 'Cobertura Lapa',       4, 'mixed', false, 550.00, 'apartment'),
  ('apt-10', 'Flat Cinelândia',      2, 'mixed', false, 270.00, 'apartment')
ON CONFLICT (code) DO NOTHING;

-- 1 cama = 1 unidad de apartamento completa. bed_code globalmente unico
-- (VARCHAR(10)); los codigos de dormitorios existentes no usan el
-- prefijo APT-, no hay colision posible.
INSERT INTO beds (room_type_id, bed_code)
SELECT rt.id, 'APT-' || RIGHT(rt.code, 2)
FROM room_types rt
WHERE rt.property_type = 'apartment'
ON CONFLICT (bed_code) DO NOTHING;
