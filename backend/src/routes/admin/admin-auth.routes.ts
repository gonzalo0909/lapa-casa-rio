// lapa-casa-hostel/backend/src/routes/admin/admin-auth.routes.ts
// ventana4 (bloque 2)
//
// Login del admin único, separado de admin.routes.ts a propósito: se
// monta ANTES del middleware authenticateToken en routes/index.ts (para
// poder pedir un token sin tener uno todavía), mientras que el resto de
// /admin/* sigue protegido.

import { Router } from 'express';
import { verifyPassword, generateToken } from '../../utils/encryption';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

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
      email: process.env.ADMIN_EMAIL || 'admin@lapacasahostel.com',
      role: 'admin' as const
    };

    const token = generateToken(payload, process.env.JWT_EXPIRES_IN || '24h');
    const refreshToken = generateToken(payload, process.env.REFRESH_TOKEN_EXPIRES_IN || '7d');

    logger.info('Login admin exitoso');
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

export const adminAuthRouter = router;
