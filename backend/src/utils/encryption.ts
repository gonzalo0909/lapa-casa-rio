// lapa-casa-hostel/backend/src/utils/encryption.ts

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * JWT Payload Interface
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'staff' | 'guest';
}

/**
 * Encryption Configuration
 */
const ENCRYPTION_CONFIG = {
  saltRounds: 12,
  algorithm: 'aes-256-gcm' as const,
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  jwtExpiration: '24h',
  refreshTokenExpiration: '7d'
};

/**
 * Password Hashing
 * Uses bcrypt for secure password hashing
 * 
 * @param password - Plain text password
 * @returns Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    const salt = await bcrypt.genSalt(ENCRYPTION_CONFIG.saltRounds);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

/**
 * Password Verification
 * Compares plain text password with hashed password
 * 
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns True if password matches
 */
export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error('Password verification failed');
  }
};

/**
 * Generate JWT Token
 * Creates a signed JWT token with user payload
 * 
 * @param payload - User payload
 * @param expiresIn - Token expiration time
 * @returns Signed JWT token
 */
export const generateToken = (
  payload: JWTPayload,
  expiresIn: string = ENCRYPTION_CONFIG.jwtExpiration
): string => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: 'lapa-casa-hostel',
    audience: 'lapa-casa-hostel-api'
  });
};

/**
 * Verify JWT Token
 * Verifies and decodes JWT token
 * 
 * @param token - JWT token
 * @returns Decoded payload
 */
export const verifyToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'lapa-casa-hostel',
      audience: 'lapa-casa-hostel-api'
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw new Error('Token verification failed');
  }
};

/**
 * Generate Refresh Token
 * Creates a long-lived refresh token
 * 
 * @param payload - User payload
 * @returns Refresh token
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  return generateToken(payload, ENCRYPTION_CONFIG.refreshTokenExpiration);
};

/**
 * Encrypt Data
 * Encrypts data using AES-256-GCM
 * 
 * @param data - Data to encrypt
 * @param key - Optional encryption key (uses env if not provided)
 * @returns Encrypted data with IV and auth tag
 */
export const encryptData = (data: string, key?: string): string => {
  try {
    const encryptionKey = key || process.env.ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not configured');
    }

    // Generate key from password
    const derivedKey = crypto.scryptSync(
      encryptionKey,
      'salt',
      ENCRYPTION_CONFIG.keyLength
    );

    // Generate IV
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);

    // Create cipher
    const cipher = crypto.createCipheriv(
      ENCRYPTION_CONFIG.algorithm,
      derivedKey,
      iv
    );

    // Encrypt data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine IV + encrypted data + auth tag
    const result = {
      iv: iv.toString('hex'),
      data: encrypted,
      tag: authTag.toString('hex')
    };

    return Buffer.from(JSON.stringify(result)).toString('base64');
  } catch (error) {
    throw new Error('Encryption failed');
  }
};

/**
 * Decrypt Data
 * Decrypts data encrypted with encryptData
 * 
 * @param encryptedData - Encrypted data string
 * @param key - Optional encryption key (uses env if not provided)
 * @returns Decrypted data
 */
export const decryptData = (encryptedData: string, key?: string): string => {
  try {
    const encryptionKey = key || process.env.ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not configured');
    }

    // Parse encrypted data
    const parsed = JSON.parse(
      Buffer.from(encryptedData, 'base64').toString('utf8')
    );

    // Generate key from password
    const derivedKey = crypto.scryptSync(
      encryptionKey,
      'salt',
      ENCRYPTION_CONFIG.keyLength
    );

    // Create decipher
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_CONFIG.algorithm,
      derivedKey,
      Buffer.from(parsed.iv, 'hex')
    );

    // Set auth tag
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));

    // Decrypt data
    let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed');
  }
};

/**
 * Generate Random Token
 * Creates a cryptographically secure random token
 * 
 * @param length - Token length in bytes (default: 32)
 * @returns Random token as hex string
 */
export const generateRandomToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate API Key
 * Creates a secure API key with prefix
 * 
 * @param prefix - API key prefix (default: 'lch')
 * @returns API key
 */
export const generateApiKey = (prefix: string = 'lch'): string => {
  const randomPart = generateRandomToken(24);
  return `${prefix}_${randomPart}`;
};

/**
 * Hash Data (One-way)
 * Creates a SHA-256 hash of data (cannot be reversed)
 * 
 * @param data - Data to hash
 * @returns Hashed data
 */
export const hashData = (data: string): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Generate HMAC Signature
 * Creates HMAC signature for webhook verification
 * 
 * @param data - Data to sign
 * @param secret - Secret key
 * @returns HMAC signature
 */
export const generateHmacSignature = (data: string, secret: string): string => {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
};

/**
 * Verify HMAC Signature
 * Verifies HMAC signature from webhooks
 * 
 * @param data - Original data
 * @param signature - Signature to verify
 * @param secret - Secret key
 * @returns True if signature is valid
 */
export const verifyHmacSignature = (
  data: string,
  signature: string,
  secret: string
): boolean => {
  const expectedSignature = generateHmacSignature(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Mask Sensitive Data
 * Masks sensitive information for logging
 * 
 * @param data - Data to mask
 * @param visibleChars - Number of characters to show (default: 4)
 * @returns Masked data
 */
export const maskSensitiveData = (
  data: string,
  visibleChars: number = 4
): string => {
  if (!data || data.length <= visibleChars) {
    return '****';
  }

  const visible = data.slice(-visibleChars);
  return '*'.repeat(data.length - visibleChars) + visible;
};

/**
 * Mask Email Address
 * Masks email address for logging
 * 
 * @param email - Email address
 * @returns Masked email
 */
export const maskEmail = (email: string): string => {
  const [username, domain] = email.split('@');
  
  if (!username || !domain) {
    return '****@****.com';
  }

  const maskedUsername = username.length > 2
    ? username.substring(0, 2) + '*'.repeat(username.length - 2)
    : '**';

  return `${maskedUsername}@${domain}`;
};

/**
 * Mask Credit Card Number
 * Masks credit card number for logging
 * 
 * @param cardNumber - Credit card number
 * @returns Masked card number
 */
export const maskCardNumber = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s/g, '');
  
  if (cleaned.length < 4) {
    return '****';
  }

  const last4 = cleaned.slice(-4);
  return '*'.repeat(cleaned.length - 4) + last4;
};

/**
 * Mask Phone Number
 * Masks phone number for logging
 * 
 * @param phone - Phone number
 * @returns Masked phone number
 */
export const maskPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length < 4) {
    return '****';
  }

  const last4 = cleaned.slice(-4);
  return '*'.repeat(cleaned.length - 4) + last4;
};

/**
 * Generate Booking Confirmation Code
 * Creates a unique, human-readable confirmation code
 * 
 * @returns Confirmation code (e.g., LCH-ABC123)
 */
export const generateConfirmationCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars
  const length = 6;
  let code = 'LCH-';

  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
};

/**
 * Generate Payment Reference
 * Creates a unique payment reference ID
 * 
 * @param bookingId - Associated booking ID
 * @returns Payment reference
 */
export const generatePaymentReference = (bookingId: string): string => {
  const timestamp = Date.now().toString(36);
  const random = generateRandomToken(4);
  return `PAY-${bookingId.substring(0, 8)}-${timestamp}-${random}`.toUpperCase();
};

/**
 * Encrypt Sensitive Fields
 * Encrypts sensitive fields in an object
 * 
 * @param data - Object with sensitive fields
 * @param fields - Array of field names to encrypt
 * @returns Object with encrypted fields
 */
export const encryptSensitiveFields = (
  data: Record<string, any>,
  fields: string[]
): Record<string, any> => {
  const result = { ...data };

  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encryptData(result[field]);
    }
  }

  return result;
};

/**
 * Decrypt Sensitive Fields
 * Decrypts sensitive fields in an object
 * 
 * @param data - Object with encrypted fields
 * @param fields - Array of field names to decrypt
 * @returns Object with decrypted fields
 */
export const decryptSensitiveFields = (
  data: Record<string, any>,
  fields: string[]
): Record<string, any> => {
  const result = { ...data };

  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = decryptData(result[field]);
      } catch (error) {
        // Keep original value if decryption fails
      }
    }
  }

  return result;
};

/**
 * Generate Secure Random Password
 * Creates a cryptographically secure random password
 * 
 * @param length - Password length (default: 16)
 * @returns Random password
 */
export const generateSecurePassword = (length: number = 16): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = lowercase + uppercase + numbers + symbols;

  let password = '';
  
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill remaining length
  for (let i = password.length; i < length; i++) {
    const randomBytes = crypto.randomBytes(1);
    const randomIndex = randomBytes[0] % all.length;
    password += all[randomIndex];
  }

  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Validate Password Strength
 * Checks if password meets security requirements
 * 
 * @param password - Password to validate
 * @returns Validation result with strength score
 */
export const validatePasswordStrength = (password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters');
  } else {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password must contain lowercase letters');
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password must contain uppercase letters');
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password must contain numbers');
  }

  // Symbol check
  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password must contain special characters');
  }

  // Common patterns check
  const commonPatterns = ['123456', 'password', 'qwerty', 'abc123'];
  if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
    feedback.push('Password contains common patterns');
    score = Math.max(0, score - 2);
  }

  return {
    valid: score >= 4 && feedback.length === 0,
    score,
    feedback
  };
};

/**
 * Generate Reset Token
 * Creates a secure token for password reset
 * 
 * @returns Reset token and its hash
 */
export const generateResetToken = (): {
  token: string;
  hash: string;
  expiresAt: Date;
} => {
  const token = generateRandomToken(32);
  const hash = hashData(token);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

  return { token, hash, expiresAt };
};

/**
 * Verify Reset Token
 * Verifies password reset token
 * 
 * @param token - Token to verify
 * @param hash - Stored hash
 * @param expiresAt - Token expiration date
 * @returns True if token is valid
 */
export const verifyResetToken = (
  token: string,
  hash: string,
  expiresAt: Date
): boolean => {
  // Check expiration
  if (new Date() > expiresAt) {
    return false;
  }

  // Verify hash
  const tokenHash = hashData(token);
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(hash)
  );
};
