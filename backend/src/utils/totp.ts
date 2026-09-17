// lapa-casa-hostel/backend/src/utils/totp.ts
//
// 2FA (TOTP, Google Authenticator/Authy compatibles) para el login de
// admin (idea #22, roadmap.html). otplib v13 cambió a una API funcional
// -- generateSecret/generateURI/verify -- distinta de la clásica
// `authenticator.*` de versiones anteriores.

import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

const ISSUER = 'Lapa Casa Hostel';

export function generateTotpSecret(): string {
  return generateSecret();
}

export async function getTotpQrCodeDataUrl(secret: string, label: string): Promise<string> {
  const uri = generateURI({ issuer: ISSUER, label, secret });
  return QRCode.toDataURL(uri);
}

/**
 * epochTolerance de 30s (una ventana de un paso antes/después del actual)
 * -- tolera un reloj del celular levemente desincronizado sin abrir la
 * puerta a fuerza bruta (el código sigue cambiando cada 30s).
 */
export async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) {
    return false;
  }
  const result = await verify({ secret, token, epochTolerance: 30 });
  return result.valid;
}

/** Código de respaldo de un solo uso -- para entrar si se pierde el celular con la app. Se muestra una sola vez, en texto plano, al activar 2FA. */
export function generateBackupCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
