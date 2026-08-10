// lapa-casa-hostel/backend/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redisCache } from '@/config/redis';
import { logger } from '@/utils/logger';

const REVOKED_PREFIX = 'revoked_token:';

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'admin' | 'staff' | 'guest';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // M-02: leer token desde httpOnly cookie (panel admin) o header Bearer (API/scripts)
  const authHeader = req.headers['authorization'];
  const token =
    (authHeader && authHeader.split(' ')[1]) ||
    (req.cookies as Record<string, string> | undefined)?.['lch_admin'];

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Access token required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error('JWT_SECRET not configured');
    res.status(500).json({
      success: false,
      error: 'Server configuration error',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    // H-02: verificar issuer y audience para que tokens de otros servicios
    // (misma secret, distinto iss/aud) sean rechazados explícitamente.
    const decoded = jwt.verify(token, secret, {
      issuer: 'lapa-casa-hostel',
      audience: 'lapa-casa-hostel-api',
    }) as AuthPayload;

    // M-03: rechazar tokens revocados (logout explícito)
    const isRevoked = await redisCache.get(`${REVOKED_PREFIX}${token}`);
    if (isRevoked) {
      res.status(401).json({
        success: false,
        error: 'Token revocado',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        expiredAt: (err as any).expiredAt,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Token verification failed',
      timestamp: new Date().toISOString(),
    });
  }
};

export const requireRole = (roles: string[]) => (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!roles.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
      required: roles,
      current: req.user.role,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
};
