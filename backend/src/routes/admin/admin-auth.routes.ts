// lapa-casa-hostel/backend/src/routes/admin/admin-auth.routes.ts
// ventana4 (bloque 2)
//
// Login del admin único, separado de admin.routes.ts a propósito: se
// monta ANTES del middleware authenticateToken en routes/index.ts (para
// poder pedir un token sin tener uno todavía), mientras que el resto de
// /admin/* sigue protegido.

import { Router } from 'express';
import { verifyPassword, generateToken } from '../../utils/encryption';
import { authenticateToken } from '../../middleware/auth';
import { redisCache } from '../../config/redis';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

// M-03: prefijo para tokens revocados en Redis (TTL = expiración del token)
const REVOKED_PREFIX = 'revoked_token:';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { password } = req.body as { password?: string };

    if (!password || typeof password !== 'string') {
      res.status(400).json(ApiResponse.error('password es requerido'));
      return;
    }

    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
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

    const payload = {
      userId: 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@lapacasario.com',
      role: 'admin' as const
    };

    const token = generateToken(payload, process.env.JWT_EXPIRES_IN || '24h');
    const refreshToken = generateToken(payload, process.env.REFRESH_TOKEN_EXPIRES_IN || '7d');

    logger.info('Login admin exitoso');

    // M-02: emitir el JWT como httpOnly cookie — inaccesible desde JS,
    // elimina el vector XSS de robo de token desde localStorage.
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('lch_admin', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24h en ms
      path: '/',
    });

    res.status(200).json(
      ApiResponse.success(
        { token, refreshToken, expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
        'Login exitoso'
      )
    );
  } catch (error) {
    next(error);
  }
});

// M-03: logout — revoca el token actual y el refreshToken si se envía.
// M-02: también limpia la cookie httpOnly (el token puede venir de ahí).
// El token queda en lista negra en Redis hasta que expire naturalmente.
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    // El token puede llegar como Bearer header (scripts/API) o como cookie httpOnly (panel admin)
    const authHeader = req.headers['authorization'];
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.['lch_admin'];
    const token = (authHeader && authHeader.split(' ')[1]) || cookieToken;

    if (token) {
      // TTL = 24h (access token) — suficiente para que expire y la entrada se limpie sola
      await redisCache.set(`${REVOKED_PREFIX}${token}`, '1', 86400);
    }

    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      // TTL = 7d (refresh token)
      await redisCache.set(`${REVOKED_PREFIX}${refreshToken}`, '1', 7 * 86400);
    }

    // M-02: eliminar la cookie httpOnly del navegador
    res.clearCookie('lch_admin', { httpOnly: true, sameSite: 'strict', path: '/' });

    logger.info('Logout admin — token revocado');
    res.status(200).json(ApiResponse.success(null, 'Sesión cerrada correctamente'));
  } catch (error) {
    next(error);
  }
});

export const adminAuthRouter = router;
export { REVOKED_PREFIX };
