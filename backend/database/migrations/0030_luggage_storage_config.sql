-- 0030_luggage_storage_config.sql
--
-- Guarda-equipaje (Malas/Guardavolumes): el dueño necesita poder ajustar
-- precio, dias y horario sin depender de un deploy -- son datos
-- operativos, no codigo. Mismo patron que card_surcharge_percent (0012)
-- y pix_discount_percent (0017): una clave en system_config, editable
-- desde /admin/pricing.html.

INSERT INTO system_config (key, value, description) VALUES
  (
    'luggage_storage',
    '{"price": 30, "currency": "BRL", "days": "Todos los días", "start_time": "08:00", "end_time": "22:00"}',
    'Guarda-equipaje del hostel (pagina /guardavolumes, publica para cualquier huesped en Rio, no solo del hostel): precio de la diaria (BRL), dias en que se ofrece el servicio y franja horaria en que se recibe/entrega equipaje. Editable desde /admin/pricing.html.'
  );
