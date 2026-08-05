// lapa-casa-hostel/backend/src/utils/encryption.ts

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'staff' | 'guest';
}

const ENCRYPTION_CONFIG = {
  saltRounds: 12,
  algorithm: 'aes-256-gcm' as const,
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  jwtExpiration: '24h',
  refreshTokenExpiration: '7d',
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(ENCRYPTION_CONFIG.saltRounds);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (
  payload: JWTPayload,
  expiresIn: string = ENCRYPTION_CONFIG.jwtExpiration
): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return (jwt.sign as any)(payload, secret, {
    expiresIn,
    issuer: 'lapa-casa-hostel',
    audience: 'lapa-casa-hostel-api',
  });
};

export const verifyToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  try {
    return jwt.verify(token, secret, {
      issuer: 'lapa-casa-hostel',
      audience: 'lapa-casa-hostel-api',
    }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw new Error('Token expired');
    if (error instanceof jwt.JsonWebTokenError) throw new Error('Invalid token');
    throw new Error('Token verification failed');
  }
};

export const generateRefreshToken = (payload: JWTPayload): string =>
  generateToken(payload, ENCRYPTION_CONFIG.refreshTokenExpiration);

export const encryptData = (data: string, key?: string): string => {
  const encryptionKey = key || process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY not configured');
  const derivedKey = crypto.scryptSync(encryptionKey, 'salt', ENCRYPTION_CONFIG.keyLength);
  const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
  const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, derivedKey, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return Buffer.from(JSON.stringify({ iv: iv.toString('hex'), data: encrypted, tag: authTag.toString('hex') })).toString('base64');
};

export const decryptData = (encryptedData: string, key?: string): string => {
  const encryptionKey = key || process.env.ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('ENCRYPTION_KEY not configured');
  const parsed = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
  const derivedKey = crypto.scryptSync(encryptionKey, 'salt', ENCRYPTION_CONFIG.keyLength);
  const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, derivedKey, Buffer.from(parsed.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
  let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

export const generateRandomToken = (length: number = 32): string =>
  crypto.randomBytes(length).toString('hex');

export const generateApiKey = (prefix: string = 'lch'): string =>
  `${prefix}_${generateRandomToken(24)}`;

export const hashData = (data: string): string =>
  crypto.createHash('sha256').update(data).digest('hex');

export const generateHmacSignature = (data: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(data).digest('hex');

export const verifyHmacSignature = (data: string, signature: string, secret: string): boolean => {
  const expected = generateHmacSignature(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

export const maskSensitiveData = (data: string, visibleChars: number = 4): string => {
  if (!data || data.length <= visibleChars) return '****';
  return '*'.repeat(data.length - visibleChars) + data.slice(-visibleChars);
};

export const maskEmail = (email: string): string => {
  const [username, domain] = email.split('@');
  if (!username || !domain) return '****@****.com';
  const masked = username.length > 2 ? username.substring(0, 2) + '*'.repeat(username.length - 2) : '**';
  return `${masked}@${domain}`;
};

export const generateConfirmationCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LCH-';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

export const generateResetToken = (): { token: string; hash: string; expiresAt: Date } => {
  const token = generateRandomToken(32);
  const hash = hashData(token);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  return { token, hash, expiresAt };
};

export const verifyResetToken = (token: string, hash: string, expiresAt: Date): boolean => {
  if (new Date() > expiresAt) return false;
  const tokenHash = hashData(token);
  return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
};
