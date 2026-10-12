-- 0072: el hostel no exige estadia minima en ninguna temporada (alta y media pasan a 1 noche, igual que baja).
-- Se puede volver a poner desde el panel admin (rate_plans.min_nights). Los periodos especiales
-- (special_period_rules) que cargo el admin no se tocan.
UPDATE rate_plans SET min_nights = 1 WHERE min_nights <> 1;
