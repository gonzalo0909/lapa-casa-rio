-- 0031_apartment_owner_login.sql
--
-- Login propio para cada administrador de apartamento. Hasta ahora
-- apartment_owners solo guardaba datos de contacto y Stripe Connect --
-- no había forma de que un administrador entrara a ningún panel, solo
-- existía la contraseña única del admin de la plataforma
-- (ADMIN_PASSWORD_HASH, ver admin-auth.routes.ts).
--
-- password_hash empieza NULL: se completa recién cuando la plataforma
-- genera una contraseña temporal al crear el administrador (ver
-- apartment-owners.routes.ts). must_change_password fuerza que la
-- cambie en su primer login -- la temporal viaja en texto plano una
-- sola vez, en la respuesta de creación, para que la plataforma se la
-- pase al administrador por fuera (WhatsApp/email), igual que ya se
-- hace con el link de onboarding de Stripe.

ALTER TABLE apartment_owners
  ADD COLUMN IF NOT EXISTS password_hash        TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at         TIMESTAMPTZ;
