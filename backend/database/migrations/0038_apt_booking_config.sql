-- 0038_apt_booking_config.sql
--
-- Configuración editable del motor de reservas de apartamentos:
--   checkin_times  : horarios disponibles para la hora de llegada (selector en paso 3)
--   max_apt_guests : límite de huéspedes por reserva de apartamento
--
-- Ambos valores se muestran y editan desde /admin/pricing.html.
-- El frontend los obtiene via GET /availability/apartment-config y usa
-- los valores hardcodeados como fallback si la API no responde.

INSERT INTO system_config (key, value, description) VALUES
  (
    'checkin_times',
    '["14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00"]',
    'Horarios de check-in disponibles para apartamentos (array JSON de strings HH:MM). Editable desde /admin/pricing.html.'
  ),
  (
    'max_apt_guests',
    '2',
    'Máximo de huéspedes por reserva de apartamento. Editable desde /admin/pricing.html.'
  );
