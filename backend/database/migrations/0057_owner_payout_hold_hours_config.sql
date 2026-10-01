-- 0057_owner_payout_hold_hours_config.sql
-- Horas de espera después del check-out antes de transferirle al administrador
-- de un apartamento su parte (protege contra golpes/estafas del huésped).
-- Leído por owner-payout-service.ts (job automático) y editable desde
-- /admin/apartments.html (pestaña Configuración) vía PUT /admin/pricing.

INSERT INTO system_config (key, value, description) VALUES
  (
    'owner_payout_hold_hours',
    '48',
    'Horas de espera después del check-out antes de pagar automáticamente al administrador del apartamento. Editable desde /admin/apartments.html (pestaña Configuración).'
  )
ON CONFLICT (key) DO NOTHING;
