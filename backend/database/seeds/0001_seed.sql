-- 0001_seed.sql
-- Lapa Casa Hostel - Channel Manager
--
-- Datos iniciales: 45 camas en 5 habitaciones (Maestro, "CONFIGURACION DE
-- HABITACIONES" e "INVENTARIO DE CAMAS"), canales, reglas de temporada,
-- politica de cancelacion y configuracion operativa.

-- ============================================================
-- room_types
-- ============================================================
INSERT INTO room_types (code, name, capacity, default_gender, is_flexible, base_price) VALUES
  ('mixto_12a',   'Mixto 12A',  12, 'mixed',  false, 60.00),
  ('mixto_12b',   'Mixto 12B',  12, 'mixed',  false, 60.00),
  ('mixto_7',     'Mixto 7',     7, 'mixed',  false, 60.00),
  ('mixto_7c',    'Mixto 7C',    7, 'mixed',  false, 60.00),
  ('flexible_7',  'Flexible 7',  7, 'female', true,  60.00);

-- ============================================================
-- beds: A1-A12, B1-B12, C1-C7, D1-D7, F1-F7 (45 camas totales)
-- ============================================================
INSERT INTO beds (room_type_id, bed_code)
SELECT rt.id, 'A' || g
FROM room_types rt, generate_series(1, 12) AS g
WHERE rt.code = 'mixto_12a';

INSERT INTO beds (room_type_id, bed_code)
SELECT rt.id, 'B' || g
FROM room_types rt, generate_series(1, 12) AS g
WHERE rt.code = 'mixto_12b';

INSERT INTO beds (room_type_id, bed_code)
SELECT rt.id, 'C' || g
FROM room_types rt, generate_series(1, 7) AS g
WHERE rt.code = 'mixto_7';

INSERT INTO beds (room_type_id, bed_code)
SELECT rt.id, 'D' || g
FROM room_types rt, generate_series(1, 7) AS g
WHERE rt.code = 'mixto_7c';

INSERT INTO beds (room_type_id, bed_code)
SELECT rt.id, 'F' || g
FROM room_types rt, generate_series(1, 7) AS g
WHERE rt.code = 'flexible_7';

-- ============================================================
-- channels (REQUISITO CRITICO #4)
-- ============================================================
INSERT INTO channels (code, name, commission_rate, has_webhook, ical_enabled) VALUES
  ('direct',      'Reserva Directa', 0.00, false, false),
  ('booking',     'Booking.com',     0.15, true,  true),
  ('hostelworld', 'Hostelworld',     0.12, false, true),
  ('airbnb',      'Airbnb',          0.03, false, true),
  ('expedia',     'Expedia',         0.18, true,  false);

-- ============================================================
-- rate_plans: multiplicador de temporada + minimo de noches
-- ============================================================
INSERT INTO rate_plans (season_type, multiplier, min_nights, description) VALUES
  ('alta',     1.5000, 3, 'Alta temporada (Dic-Mar)'),
  ('media',    1.0000, 2, 'Media temporada (Abr-May, Oct-Nov)'),
  ('baja',     0.8000, 1, 'Baja temporada (Jun-Sep)'),
  ('carnaval', 2.0000, 5, 'Carnaval (fechas moviles, ver system_config.carnival_dates)');

-- ============================================================
-- cancellation_policies
-- ============================================================
INSERT INTO cancellation_policies (label, min_hours_before, refund_percent) VALUES
  ('full_refund',    168, 1.0000),  -- +7 dias antes
  ('partial_refund',  48, 0.5000),  -- 7 a 2 dias antes
  ('no_refund',        0, 0.0000);  -- menos de 48h / no-show

-- ============================================================
-- system_config
-- ============================================================
INSERT INTO system_config (key, value, description) VALUES
  ('timezone', '"America/Sao_Paulo"', 'Zona horaria operativa unica del sistema'),
  ('pending_payment_timeout_minutes', '5', 'Timeout de reservas directas con pago pendiente'),
  ('flexible_conversion_hours', '48', 'Horas antes del check-in en que se evalua la conversion de Flexible 7'),
  ('no_show_release_time', '"23:59"', 'Hora local (America/Sao_Paulo) de liberacion automatica por no-show'),
  (
    'carnival_dates',
    '[
      {"year": 2026, "start_date": "2026-02-14", "end_date": "2026-02-18"},
      {"year": 2027, "start_date": "2027-02-06", "end_date": "2027-02-10"}
    ]',
    'IMPORTANTE: fechas moviles de Carnaval, requieren verificacion y mantenimiento anual (ver Maestro, MINIMO DE NOCHES POR TEMPORADA, y checklist de Ventana 6). Los valores de ejemplo aca cargados deben confirmarse contra el calendario oficial antes de cada temporada.'
  );

-- ============================================================
-- exchange_rates: baseline ilustrativo, requiere sincronizacion real
-- con una API de tasas de cambio (fuera del alcance de Ventana 1).
-- ============================================================
INSERT INTO exchange_rates (currency_code, rate_to_brl, effective_date, source) VALUES
  ('BRL', 1.000000, CURRENT_DATE, 'manual'),
  ('USD', 5.000000, CURRENT_DATE, 'manual'),
  ('EUR', 5.400000, CURRENT_DATE, 'manual');
