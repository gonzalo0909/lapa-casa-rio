// lapa-casa-hostel/backend/src/middleware/csrf.ts
//
// Patrón "doble cookie" para los paneles de admin/owner. Las cookies de
// sesión del panel de owners (lch_owner) usan sameSite:'none' en producción
// porque el frontend (Vercel/lapacasario.com) y el backend (Fly.io) son
// cross-site. Con sameSite:'none' un atacante puede lograr que el navegador
// mande la cookie de sesión en una request cross-site, por lo que CSRF es
// la única barrera que queda.
//
// Protección: el login emite un token CSRF que viaja:
//   (a) como cookie NO httpOnly (lch_owner_csrf, enviada automáticamente)
//   (b) en el body de la respuesta, para que el frontend lo guarde en
//       localStorage y lo reenvíe como header x-csrf-token.
// Un atacante cross-site puede hacer que el navegador mande la cookie, pero
// no puede leer localStorage del dominio víctima para forjar el header, así
// que la comparación cookie === header rechaza la request.

import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function verifyCsrf(cookieName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[cookieName];
    const headerToken = req.headers['x-csrf-token'];

    if (
      typeof cookieToken !== 'string' ||
      typeof headerToken !== 'string' ||
      !safeCompare(cookieToken, headerToken)
    ) {
      res.status(403).json({
        success: false,
        error: 'CSRF token inválido o ausente',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
