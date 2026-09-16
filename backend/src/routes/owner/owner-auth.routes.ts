// lapa-casa-hostel/backend/src/routes/owner/owner-auth.routes.ts
//
// Login de administradores de apartamento (0031_apartment_owner_login.sql).
// Separado del admin único (admin-auth.routes.ts) a propósito: misma
// razón que ese archivo -- se monta ANTES del middleware de auth para
// poder pedir un token sin tener uno todavía, con su propia cookie
// (lch_owner) para no pisar una sesión de admin en el mismo navegador.
//
// La contraseña la genera la plataforma al crear el administrador (ver
// apartment-owners.routes.ts) y viaja una sola vez en texto plano en esa
// respuesta -- acá solo se valida contra el hash. must_change_password
// obliga a cambiarla en el primer login antes de poder usar el resto del
// panel (el frontend decide qué mostrar según ese flag en la respuesta).

import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import {
  verifyPassword, hashPassword, generateToken, generateRefreshToken,
  generateCsrfToken, ACCESS_TOKEN_TTL,
} from '../../utils/encryption';
import { authenticateOwnerToken, type AuthPayload } from '../../middleware/auth';
import { redisCache } from '../../config/redis';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { validate } from '../../middleware/validation';

const REVOKED_PREFIX = 'revoked_token:';

const LoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

const router = Router();

// ─── POST /owner-auth — login ────────────────────────────────────────────────

router.post('/', validate(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof LoginSchema>;

    const owner = await prisma.apartmentOwner.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    // mismo mensaje genérico si no existe el email o si la contraseña no
    // matchea -- no confirmar qué emails están registrados
    if (!owner || !owner.isActive || !owner.passwordHash) {
      logger.warn('Intento de login de administrador fallido', { email });
      res.status(401).json(ApiResponse.error('Credenciales inválidas'));
      return;
    }

    const valid = await verifyPassword(password, owner.passwordHash);
    if (!valid) {
      logger.warn('Intento de login de administrador fallido', { email });
      res.status(401).json(ApiResponse.error('Credenciales inválidas'));
      return;
    }

    await prisma.apartmentOwner.update({
      where: { id: owner.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      userId: owner.id,
      email: owner.email,
      role: 'owner' as const,
      ownerId: owner.id,
    };

    // Sección 10 auditoría 17 secciones: access token de vida corta (15m)
    // y refresh token de vida larga (90d) en cookie separada. El access
    // token se renueva automáticamente vía POST /owner/login/refresh antes
    // de redirigir al login. El refresh token solo viaja al endpoint de
    // renovación -- nunca aparece en el body de respuesta ni en logs.
    const accessToken = generateToken(payload, ACCESS_TOKEN_TTL);
    const refreshToken = generateRefreshToken(payload);

    logger.info('Login de administrador exitoso', { ownerId: owner.id });

    const isProd = process.env.NODE_ENV === 'production';
    const refreshMaxAge = 90 * 24 * 60 * 60 * 1000; // 90 días

    // SameSite=None (+ Secure) en producción porque el frontend (lapacasario.com /
    // Vercel) y el backend (Fly.io) son cross-site: con SameSite=Strict/Lax el
    // navegador bloquea el envío de estas cookies en las requests fetch del panel.
    // SameSite=Lax en desarrollo (localhost es same-site y no admite None sin HTTPS).
    // La protección CSRF se mantiene: el token también se devuelve en el body para
    // que el frontend lo guarde en localStorage (acceso JS same-origin) y lo envíe
    // como header; un atacante cross-site puede forzar el envío de la cookie pero
    // no puede leer localStorage del dominio víctima para forjar el header.
    const cookieSameSite = isProd ? 'none' : 'lax';

    // Cookie de access token: vida corta (15 min), enviada a todas las rutas
    res.cookie('lch_owner', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: 15 * 60 * 1000,   // 15 minutos
      path: '/',
    });
    // Cookie de refresh token: vida larga (90 días), restringida al endpoint
    // de renovación para minimizar la superficie de ataque
    res.cookie('lch_owner_refresh', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: refreshMaxAge,
      path: '/api/v1/owner/login',
    });
    // Cookie CSRF -- también devuelta en el body (ver abajo). El frontend la
    // guarda en localStorage y la reenvía como x-csrf-token en cada
    // PUT/POST/DELETE del panel (ver lib/api.ts). La cookie sigue siendo la
    // fuente de verdad que el backend compara con el header.
    const csrfToken = generateCsrfToken();
    res.cookie('lch_owner_csrf', csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: refreshMaxAge,
      path: '/',
    });

    res.status(200).json(
      ApiResponse.success(
        {
          fullName: owner.fullName,
          email: owner.email,
          mustChangePassword: owner.mustChangePassword,
          // Se incluye en el body para que el frontend lo guarde en
          // localStorage (cross-origin: document.cookie no puede leer
          // cookies del dominio de la API desde el dominio del frontend).
          csrfToken,
        },
        'Login exitoso'
      )
    );
  } catch (error) {
    next(error);
  }
});

// ─── POST /owner-auth/refresh — renueva el access token con el refresh token ──
//
// Usa rotating refresh tokens: revoca el refresh token entrante y emite uno
// nuevo, de modo que cada renovación invalida el token anterior. Esto limita
// el daño si un refresh token viejo se filtra.

router.post('/refresh', async (req, res, next) => {
  try {
    const cookies = req.cookies as Record<string, string> | undefined;
    const incomingRefresh = cookies?.['lch_owner_refresh'];

    if (!incomingRefresh) {
      res.status(401).json(ApiResponse.error('Refresh token requerido'));
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('JWT_SECRET no configurado — refresh rechazado');
      res.status(500).json(ApiResponse.error('Server configuration error'));
      return;
    }

    let decoded: AuthPayload;
    try {
      decoded = jwt.verify(incomingRefresh, secret, {
        issuer: 'lapa-casa-hostel',
        audience: 'lapacasario-api',
      }) as AuthPayload;
    } catch (verifyErr) {
      if (verifyErr instanceof jwt.TokenExpiredError) {
        res.status(401).json(ApiResponse.error('Refresh token expirado — iniciá sesión nuevamente'));
        return;
      }
      res.status(401).json(ApiResponse.error('Refresh token inválido'));
      return;
    }

    if (decoded.role !== 'owner' || !decoded.ownerId) {
      res.status(403).json(ApiResponse.error('Permisos insuficientes'));
      return;
    }

    // Rechazar si el refresh token fue revocado (logout explícito o rotación previa)
    const isRevoked = await redisCache.get(`${REVOKED_PREFIX}${incomingRefresh}`);
    if (isRevoked) {
      res.status(401).json(ApiResponse.error('Refresh token revocado'));
      return;
    }

    // Verificar que la cuenta siga activa
    const owner = await prisma.apartmentOwner.findUnique({
      where: { id: decoded.ownerId },
      select: { isActive: true },
    });
    if (!owner || !owner.isActive) {
      res.status(401).json(ApiResponse.error('Cuenta desactivada'));
      return;
    }

    // Revocar el refresh token entrante (rotating refresh tokens)
    const refreshTtlSeconds = 90 * 24 * 60 * 60;
    await redisCache.set(`${REVOKED_PREFIX}${incomingRefresh}`, '1', refreshTtlSeconds);

    // Emitir nuevos access + refresh tokens
    const payload = {
      userId: decoded.userId,
      email: decoded.email,
      role: 'owner' as const,
      ownerId: decoded.ownerId,
    };
    const newAccessToken = generateToken(payload, ACCESS_TOKEN_TTL);
    const newRefreshToken = generateRefreshToken(payload);

    const isProd = process.env.NODE_ENV === 'production';
    const refreshMaxAge = 90 * 24 * 60 * 60 * 1000;
    const cookieSameSite = isProd ? 'none' : 'lax';
    res.cookie('lch_owner', newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('lch_owner_refresh', newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: refreshMaxAge,
      path: '/api/v1/owner/login',
    });
    // Rotar también la cookie CSRF al rotar los tokens; devolver en el body
    // para que el frontend actualice localStorage (ver login handler).
    const newCsrfToken = generateCsrfToken();
    res.cookie('lch_owner_csrf', newCsrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: cookieSameSite,
      maxAge: refreshMaxAge,
      path: '/',
    });

    logger.info('Access token de administrador renovado', { ownerId: decoded.ownerId });
    res.status(200).json(ApiResponse.success({ csrfToken: newCsrfToken }, 'Token renovado'));
  } catch (error) {
    next(error);
  }
});

// ─── POST /owner-auth/change-password ────────────────────────────────────────

router.post(
  '/change-password',
  authenticateOwnerToken,
  validate(ChangePasswordSchema),
  async (req, res, next) => {
    try {
      const { newPassword } = req.body as z.infer<typeof ChangePasswordSchema>;
      const ownerId = req.user?.ownerId;
      if (!ownerId) {
        res.status(401).json(ApiResponse.error('Access token required'));
        return;
      }

      const passwordHash = await hashPassword(newPassword);

      await prisma.apartmentOwner.update({
        where: { id: ownerId },
        data: { passwordHash, mustChangePassword: false },
      });

      logger.info('Administrador cambió su contraseña', { ownerId });

      res.status(200).json(ApiResponse.success(null, 'Contraseña actualizada'));
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /owner-auth/logout ──────────────────────────────────────────────────

router.post('/logout', authenticateOwnerToken, async (req, res, next) => {
  try {
    const cookies = req.cookies as Record<string, string> | undefined;
    const authHeader = req.headers['authorization'];
    const accessToken = (authHeader && authHeader.split(' ')[1]) || cookies?.['lch_owner'];
    const refreshToken = cookies?.['lch_owner_refresh'];

    // Revocar access token (TTL = 15 min, suficiente para que expire y Redis se limpie solo)
    if (accessToken) {
      await redisCache.set(`${REVOKED_PREFIX}${accessToken}`, '1', 15 * 60);
    }
    // Revocar refresh token (TTL = 90 días)
    if (refreshToken) {
      await redisCache.set(`${REVOKED_PREFIX}${refreshToken}`, '1', 90 * 24 * 60 * 60);
    }

    const isProdLogout = process.env.NODE_ENV === 'production';
    const logoutSameSite = isProdLogout ? 'none' : 'lax';
    res.clearCookie('lch_owner', { httpOnly: true, secure: isProdLogout, sameSite: logoutSameSite, path: '/' });
    res.clearCookie('lch_owner_refresh', { httpOnly: true, secure: isProdLogout, sameSite: logoutSameSite, path: '/api/v1/owner/login' });
    res.clearCookie('lch_owner_csrf', { httpOnly: false, secure: isProdLogout, sameSite: logoutSameSite, path: '/' });

    logger.info('Logout de administrador', { ownerId: req.user?.ownerId });
    res.status(200).json(ApiResponse.success(null, 'Sesión cerrada correctamente'));
  } catch (error) {
    next(error);
  }
});

export const ownerAuthRouter = router;
