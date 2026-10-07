-- 0066: token de exportación iCal PROPIO de cada apartamento.
-- NULL = el apartamento sigue usando el token global ICAL_EXPORT_TOKEN (los enlaces
-- existentes siguen funcionando). Al "Regenerar enlace" se guarda uno nuevo y el
-- anterior (y el global) dejan de valer para ESE apartamento.
ALTER TABLE room_types ADD COLUMN IF NOT EXISTS ical_export_token text;
