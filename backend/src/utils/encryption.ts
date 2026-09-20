import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'staff' | 'guest' | 'owner';
  ownerId?: string;
}

// Access token: vida corta (15 minutos) para minimizar la ventana de ataque
// si se filtra. Refresh token: vida larga (90 días) para no forzar re-login
// diario, almacenado en cookie httpOnly separada y solo enviado al endpoint /refresh.
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL = '90d';

const ENCRYPTION_CONFIG = {
  jwtExpiration: '24h',
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

// Contraseña temporal legible (evita 0/O/1/l/I -- confusión al transcribirla
// a mano por WhatsApp/email) para el primer login de un administrador nuevo.
// must_change_password fuerza que la reemplace antes de usar el resto del panel.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export const generateTempPassword = (length = 12): string => {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return result;
};

// Mismo alfabeto legible que generateTempPassword, pero solo mayúsculas --
// apartment_offers.code se compara siempre en mayúsculas (ver
// create-booking.ts/offers.routes.ts, .toUpperCase() antes del match), un
// código de referido con minúsculas generaría confusión al compartirlo a
// mano sin ningún beneficio real.
const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código de referido -- prefijo fijo para que se distinga a simple vista de un cupón armado a mano por el admin. */
export function generateReferralCode(): string {
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += REFERRAL_CODE_ALPHABET[bytes[i] % REFERRAL_CODE_ALPHABET.length];
  }
  return `REF-${suffix}`;
}

// Convierte '24h'/'7d'/'90d' (mismo formato que JWT_EXPIRES_IN) a ms/segundos.
// Compartido entre admin-auth.routes.ts y owner-auth.routes.ts para que un
// TTL de cookie/blacklist no pueda quedar corregido en un panel y
// desactualizado en el otro.
export function durationToMs(duration: string, fallbackMs: number): number {
  const match = /^(\d+)(d|h|m)$/.exec(duration.trim());
  if (!match) {
    return fallbackMs;
  }
  const value = Number(match[1]);
  const unitMs = { d: 86400000, h: 3600000, m: 60000 }[match[2] as 'd' | 'h' | 'm'];
  return value * unitMs;
}

export function durationToSeconds(duration: string, fallbackSeconds: number): number {
  return Math.floor(durationToMs(duration, fallbackSeconds * 1000) / 1000);
}

// Token del patrón "doble cookie" para CSRF (ver middleware/csrf.ts) --
// random, sin relación con el JWT de sesión, se emite en el login como
// cookie NO httpOnly para que el frontend lo pueda leer y reenviar en un
// header en cada request que modifica datos.
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export const generateToken = (
  payload: JWTPayload,
  expiresIn: string = ENCRYPTION_CONFIG.jwtExpiration,
): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return (jwt.sign as any)(payload, secret, {
    expiresIn,
    issuer: 'lapa-casa-rio',
    audience: 'lapacasario-api',
  });
};

/**
 * Genera un refresh token de larga duración (90 días).
 * Debe almacenarse en una cookie httpOnly con path restringido al endpoint
 * /refresh — nunca enviarse en el body de respuesta.
 */
export const generateRefreshToken = (payload: JWTPayload): string =>
  generateToken(payload, REFRESH_TOKEN_TTL);

/** Uso interno de verifyHmacSignature -- no se exporta, nada más lo necesita. */
const generateHmacSignature = (data: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(data).digest('hex');

export const verifyHmacSignature = (data: string, signature: string, secret: string): boolean => {
  const expected = generateHmacSignature(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};
