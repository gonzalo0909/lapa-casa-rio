-- 0071: se quita la estadia minima de la media temporada (Abr-May, Oct-Nov) del hostel: antes 2 noches, ahora 1.
-- Alta temporada (Dic-Mar, 3 noches) y baja (1 noche) no cambian. Los periodos especiales (special_period_rules)
-- tampoco. Se puede volver a cambiar desde el panel admin (rate_plans.min_nights).
UPDATE rate_plans SET min_nights = 1 WHERE season_type = 'media' AND min_nights <> 1;
