-- 0048_owner_password_reset.sql
--
-- "Esqueci minha senha" para el login de administradores de apartamento
-- (0031_apartment_owner_login.sql). Hasta ahora un admin que olvidaba su
-- contraseña no tenía forma de recuperar el acceso por sí mismo -- había
-- que pedirle a la plataforma que se la reseteara a mano.
--
-- reset_token_hash guarda el hash SHA-256 del token (nunca el token en
-- texto plano, igual que password_hash con bcrypt) para que un dump de la
-- base no alcance para generar un link de reset válido. expires_at le da
-- una ventana corta de validez (1 hora, ver owner-auth.routes.ts).

ALTER TABLE apartment_owners
  ADD COLUMN IF NOT EXISTS reset_token_hash       TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_apartment_owners_reset_token_hash
  ON apartment_owners (reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;
