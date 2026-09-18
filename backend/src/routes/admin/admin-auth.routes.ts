//
// Login del admin único, separado de admin.routes.ts a propósito: se
// monta ANTES del middleware authenticateToken en routes/index.ts (para
// poder pedir un token sin tener uno todavía), mientras que el resto de
// /admin/* sigue protegido.

import { Router } from 'express';
import { z } from 'zod';
import {
  verifyPassword,
  hashPassword,
  generateToken,
  durationToMs,
  durationToSeconds,
  generateCsrfToken,
} from '../../utils/encryption';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { verifyCsrf } from '../../middleware/csrf';
import { redisCache } from '../../config/redis';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';
import { getAdminTotpConfig, disableAdminTotp } from './admin-2fa.routes';
import { verifyTotpToken, hashBackupCode } from '../../utils/totp';

// Clave Redis donde se persiste el hash si el admin lo cambia en el panel.
// Sin TTL -- el hash vive indefinidamente hasta que se cambie de nuevo.
const ADMIN_PW_HASH_KEY = 'admin:password_hash';

/** Obtiene el hash actual de la contraseña admin:
 *  Redis tiene prioridad (cambio en panel) → si no, env var. */
async function getAdminPasswordHash(): Promise<string | null> {
  const stored = await redisCache.get<string>(ADMIN_PW_HASH_KEY);
  if (stored) { return stored; }
  return process.env.ADMIN_PASSWORD_HASH ?? null;
}

const LoginSchema = z.object({
  password: z.string().min(1),
  // Solo se exige si 2FA está activado (ver /admin/2fa) -- opcional para
  // no romper el login de nadie que no lo prendió.
  totpToken: z.string().optional(),
});

// M-03: prefijo para tokens revocados en Redis (TTL = expiración del token)
const REVOKED_PREFIX = 'revoked_token:';

const router = Router();

router.post('/', validate(LoginSchema), async (req, res, next) => {
  try {
    const { password, totpToken } = req.body as z.infer<typeof LoginSchema>;

    const passwordHash = await getAdminPasswordHash();
    if (!passwordHash) {
      logger.error('ADMIN_PASSWORD_HASH no configurado — login admin deshabilitado');
      res.status(500).json(ApiResponse.error('Login de administrador no configurado'));
      return;
    }

    const valid = await verifyPassword(password, passwordHash);
    if (!valid) {
      logger.warn('Intento de login admin fallido');
      res.status(401).json(ApiResponse.error('Credenciales inválidas'));
      return;
    }

    // 2FA opcional (idea #22, roadmap.html) -- solo se exige si el admin
    // lo activó desde /admin/2fa. Código 'TOTP_REQUIRED' distinto de
    // 'credenciales inválidas' para que el frontend sepa mostrar el
    // segundo campo en vez de decir que la contraseña está mal.
    const totpConfig = await getAdminTotpConfig();
    if (totpConfig.enabled && totpConfig.secret) {
      if (!totpToken) {
        res
          .status(401)
          .json(ApiResponse.error('Se requiere el código de 2FA', undefined, 'TOTP_REQUIRED'));
        return;
      }
      const totpValid = await verifyTotpToken(totpConfig.secret, totpToken);
      if (!totpValid) {
        logger.warn('Intento de login admin fallido -- código 2FA inválido');
        res
          .status(401)
          .json(ApiResponse.error('Código de 2FA inválido', undefined, 'TOTP_INVALID'));
        return;
      }
    }

    const payload = {
      userId: 'admin',
      email: process.env.ADMIN_EMAIL || 'lapalandiarj@gmail.com',
      role: 'admin' as const,
    };

    const token = generateToken(payload, process.env.JWT_EXPIRES_IN || '24h');

    logger.info('Login admin exitoso');

    // M-02: emitir el JWT como httpOnly cookie — inaccesible desde JS,
    // elimina el vector XSS de robo de token desde localStorage.
    const isProd = process.env.NODE_ENV === 'production';
    const cookieMaxAge = durationToMs(process.env.JWT_EXPIRES_IN || '24h', 24 * 60 * 60 * 1000);
    res.cookie('lch_admin', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: cookieMaxAge,
      path: '/',
    });

    // Cookie CSRF (patrón doble cookie, ver middleware/csrf.ts) -- a
    // propósito NO httpOnly, el frontend necesita leerla para reenviarla en
    // el header x-csrf-token de cada request que modifica datos.
    res.cookie('lch_admin_csrf', generateCsrfToken(), {
      httpOnly: false,
      secure: isProd,
      sameSite: 'strict',
      maxAge: cookieMaxAge,
      path: '/',
    });

    // M-06: el JWT viaja solo en la cookie httpOnly de arriba -- devolverlo
    // también acá en el body reintroducía la superficie de robo por XSS que
    // esa cookie buscaba eliminar. Ningún cliente real (el panel admin
    // vanilla JS de backend/src/admin/) lee este campo: confirmado por
    // grep, se autentica solo con la cookie (ver api.js, credentials:
    // 'include' + checkSession()).
    //
    // Tampoco se emite refreshToken: se generaba acá y solo viajaba en este
    // mismo body (nunca en cookie), y no existe ningún endpoint /refresh
    // que lo consuma -- era una pieza de un flujo de refresh que nunca se
    // terminó de construir. El default de JWT_EXPIRES_IN ya se acortó de
    // 90d a 24h (ver sección 8 auditoría 17 secciones) para que un olvido
    // de configurar la env var en los secrets de Fly.io falle corto, no
    // largo. Un flujo de refresh completo (endpoint dedicado + cookie
    // propia, para poder tener un access token de vida aún más corta sin
    // forzar reloguearse tan seguido) sigue pendiente -- requiere probarlo
    // con sesión de navegador real, no algo verificable solo desde el código.
    res
      .status(200)
      .json(
        ApiResponse.success({ expiresIn: process.env.JWT_EXPIRES_IN || '24h' }, 'Login exitoso'),
      );
  } catch (error) {
    next(error);
  }
});

const RecoverySchema = z.object({
  password: z.string().min(1),
  backupCode: z.string().min(1),
});

/**
 * POST /admin/login/2fa-recovery — desactiva 2FA usando el código de
 * respaldo, para el caso de perder el celular con la app y no poder
 * completar el login normal. A propósito público (mismo rate limit que
 * /admin/login): si tuviera que pasar por authenticateToken, la
 * recuperación sería inútil justo en el escenario que la necesita.
 * Requiere la contraseña Y el código de respaldo -- ninguno solo alcanza.
 */
router.post('/2fa-recovery', validate(RecoverySchema), async (req, res, next) => {
  try {
    const { password, backupCode } = req.body as z.infer<typeof RecoverySchema>;

    const passwordHash = await getAdminPasswordHash();
    if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
      logger.warn('Intento de recuperación de 2FA fallido -- contraseña inválida');
      res.status(401).json(ApiResponse.error('Credenciales inválidas'));
      return;
    }

    const totpConfig = await getAdminTotpConfig();
    if (!totpConfig.enabled || !totpConfig.backupCodeHash) {
      res.status(400).json(ApiResponse.error('2FA no está activado'));
      return;
    }

    if (hashBackupCode(backupCode) !== totpConfig.backupCodeHash) {
      logger.warn('Intento de recuperación de 2FA fallido -- código de respaldo inválido');
      res.status(401).json(ApiResponse.error('Código de respaldo inválido'));
      return;
    }

    await disableAdminTotp();
    logger.info('2FA de admin desactivado por recuperación con código de respaldo');
    res
      .status(200)
      .json(
        ApiResponse.success(null, '2FA desactivado. Iniciá sesión de nuevo con tu contraseña.'),
      );
  } catch (error) {
    next(error);
  }
});

// M-03: logout — revoca el token actual y el refreshToken si se envía.
// M-02: también limpia la cookie httpOnly (el token puede venir de ahí).
// El token queda en lista negra en Redis hasta que expire naturalmente.
router.post('/logout', authenticateToken, verifyCsrf('lch_admin_csrf'), async (req, res, next) => {
  try {
    // El token puede llegar como Bearer header (scripts/API) o como cookie httpOnly (panel admin)
    const authHeader = req.headers['authorization'];
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.['lch_admin'];
    const token = (authHeader && authHeader.split(' ')[1]) || cookieToken;

    if (token) {
      // TTL de la blacklist = TTL real del JWT (auditoría 17 secciones,
      // sección 15): antes estaba fijo en 86400s (24h) sin importar
      // JWT_EXPIRES_IN -- si ese valor se configura a más de 24h, el token
      // "revocado" volvía a ser válido apenas la entrada de Redis expiraba,
      // aunque el JWT real siguiera vigente.
      await redisCache.set(
        `${REVOKED_PREFIX}${token}`,
        '1',
        durationToSeconds(process.env.JWT_EXPIRES_IN || '24h', 86400),
      );
    }

    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      // Vestigial: no existe ningún endpoint /refresh que emita ni consuma
      // este token (ver comentario en el login de arriba) -- se mantiene el
      // no-op por compatibilidad hacia atrás si algún cliente viejo todavía
      // lo envía, sin agregarle lógica nueva.
      await redisCache.set(`${REVOKED_PREFIX}${refreshToken}`, '1', 7 * 86400);
    }

    // M-02: eliminar la cookie httpOnly del navegador
    res.clearCookie('lch_admin', { httpOnly: true, sameSite: 'strict', path: '/' });
    res.clearCookie('lch_admin_csrf', { httpOnly: false, sameSite: 'strict', path: '/' });

    logger.info('Logout admin — token revocado');
    res.status(200).json(ApiResponse.success(null, 'Sesión cerrada correctamente'));
  } catch (error) {
    next(error);
  }
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'La nueva contraseña debe tener al menos 12 caracteres'),
  confirmPassword: z.string().min(1),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

/**
 * POST /admin/login/change-password
 *
 * Requiere autenticación admin. Cambia la contraseña del panel:
 *   1. Verifica la contraseña actual
 *   2. Hashea la nueva y la persiste en Redis (sin TTL)
 *   3. Revoca el token activo para forzar re-login con la nueva contraseña
 */
router.post(
  '/change-password',
  authenticateToken,
  requireRole(['admin']),
  verifyCsrf('lch_admin_csrf'),
  validate(ChangePasswordSchema),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body as z.infer<typeof ChangePasswordSchema>;

      const currentHash = await getAdminPasswordHash();
      if (!currentHash) {
        res.status(500).json(ApiResponse.error('Contraseña admin no configurada'));
        return;
      }

      if (!(await verifyPassword(currentPassword, currentHash))) {
        logger.warn('Cambio de contraseña admin fallido — contraseña actual incorrecta');
        res.status(401).json(ApiResponse.error('La contraseña actual es incorrecta'));
        return;
      }

      const newHash = await hashPassword(newPassword);
      // Persistir sin TTL — el hash vive hasta que se cambie de nuevo
      await redisCache.set(ADMIN_PW_HASH_KEY, newHash, 0);

      // Revocar el token actual para forzar re-login
      const authHeader = req.headers['authorization'];
      const cookieToken = (req.cookies as Record<string, string> | undefined)?.['lch_admin'];
      const token = (authHeader && authHeader.split(' ')[1]) || cookieToken;
      if (token) {
        await redisCache.set(
          `${REVOKED_PREFIX}${token}`,
          '1',
          durationToSeconds(process.env.JWT_EXPIRES_IN || '24h', 86400),
        );
      }
      res.clearCookie('lch_admin', { httpOnly: true, sameSite: 'strict', path: '/' });
      res.clearCookie('lch_admin_csrf', { httpOnly: false, sameSite: 'strict', path: '/' });

      logger.info('Contraseña admin cambiada — sesión revocada');
      res.status(200).json(ApiResponse.success(null, 'Contraseña cambiada. Iniciá sesión de nuevo.'));
    } catch (error) {
      next(error);
    }
  }
);

export const adminAuthRouter = router;
export { REVOKED_PREFIX };
