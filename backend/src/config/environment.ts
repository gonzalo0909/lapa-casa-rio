// lapa-casa-hostel/backend/src/config/environment.ts

import { config } from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger';

/**
 * Environment Configuration
 * Centralized environment variable management with validation
 * 
 * Features:
 * - Type-safe environment variables
 * - Automatic validation with Zod
 * - Default values
 * - Required vs optional distinction
 * - Environment-specific configs
 */

// Load .env file
config();

/**
 * Environment schema validation
 */
const environmentSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  
  // Application
  APP_NAME: z.string().default('Lapa Casa Hostel Channel Manager'),
  APP_URL: z.string().url().default('https://lapacasahostel.com'),
  API_VERSION: z.string().default('v1'),
  
  // Database
  DATABASE_URL: z.string().url(),
  DB_MAX_CONNECTIONS: z.string().transform(Number).default('10'),
  DB_CONNECTION_TIMEOUT: z.string().transform(Number).default('5000'),
  DB_POOL_TIMEOUT: z.string().transform(Number).default('10000'),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DATABASE: z.string().transform(Number).default('0'),
  REDIS_MAX_RETRIES: z.string().transform(Number).default('3'),
  
  // JWT Authentication
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default('true'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Stripe Payment
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_API_VERSION: z.string().default('2023-10-16'),
  
  // Mercado Pago Payment
  MP_ACCESS_TOKEN: z.string(),
  MP_PUBLIC_KEY: z.string(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  
  // Email Service (Resend)
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().email().default('reservas@lapacasahostel.com'),
  EMAIL_FROM_NAME: z.string().default('Lapa Casa Hostel'),
  
  // WhatsApp Integration
  WHATSAPP_API_KEY: z.string().optional(),
  WHATSAPP_PHONE_NUMBER: z.string().optional(),
  WHATSAPP_ENABLED: z.string().transform(val => val === 'true').default('false'),
  
  // Google Sheets Integration
  GOOGLE_SHEETS_CLIENT_EMAIL: z.string().email().optional(),
  GOOGLE_SHEETS_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SHEETS_ENABLED: z.string().transform(val => val === 'true').default('false'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  
  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).default('12'),
  ENCRYPTION_KEY: z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  
  // Booking Configuration
  BOOKING_HOLD_TIME_MINUTES: z.string().transform(Number).default('15'),
  DEPOSIT_PERCENTAGE: z.string().transform(Number).default('0.30'),
  LARGE_GROUP_DEPOSIT_PERCENTAGE: z.string().transform(Number).default('0.50'),
  AUTO_CHARGE_DAYS_BEFORE: z.string().transform(Number).default('7'),
  FLEXIBLE_ROOM_AUTO_CONVERT_HOURS: z.string().transform(Number).default('48'),
  
  // Pricing
  BASE_PRICE_BRL: z.string().transform(Number).default('60.00'),
  GROUP_DISCOUNT_7_BEDS: z.string().transform(Number).default('0.10'),
  GROUP_DISCOUNT_16_BEDS: z.string().transform(Number).default('0.15'),
  GROUP_DISCOUNT_26_BEDS: z.string().transform(Number).default('0.20'),
  
  // Season Multipliers
  SEASON_HIGH_MULTIPLIER: z.string().transform(Number).default('1.50'),
  SEASON_MEDIUM_MULTIPLIER: z.string().transform(Number).default('1.00'),
  SEASON_LOW_MULTIPLIER: z.string().transform(Number).default('0.80'),
  SEASON_CARNIVAL_MULTIPLIER: z.string().transform(Number).default('2.00'),
  
  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENABLED: z.string().transform(val => val === 'true').default('false'),
  
  // Performance
  REQUEST_TIMEOUT_MS: z.string().transform(Number).default('30000'),
  MAX_REQUEST_SIZE: z.string().default('10mb'),
  
  // Feature Flags
  ENABLE_ANALYTICS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_DEBUG_MODE: z.string().transform(val => val === 'true').default('false'),
  MAINTENANCE_MODE: z.string().transform(val => val === 'true').default('false')
});

/**
 * Environment variables type
 */
export type Environment = z.infer<typeof environmentSchema>;

/**
 * Parse and validate environment variables
 */
const parseEnvironment = (): Environment => {
  try {
    const parsed = environmentSchema.parse(process.env);
    logger.info('Environment configuration validated successfully');
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      logger.error('Environment validation failed', { errors: missingVars });
      throw new Error(`Invalid environment configuration:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
};

/**
 * Validated environment configuration
 */
export const env = parseEnvironment();

/**
 * Environment helper functions
 */
export const isProduction = (): boolean => env.NODE_ENV === 'production';
export const isDevelopment = (): boolean => env.NODE_ENV === 'development';
export const isTest = (): boolean => env.NODE_ENV === 'test';

/**
 * Database configuration object
 */
export const databaseConfig = {
  url: env.DATABASE_URL,
  maxConnections: env.DB_MAX_CONNECTIONS,
  connectionTimeout: env.DB_CONNECTION_TIMEOUT,
  poolTimeout: env.DB_POOL_TIMEOUT
};

/**
 * Redis configuration object
 */
export const redisConfig = {
  url: env.REDIS_URL,
  password: env.REDIS_PASSWORD,
  database: env.REDIS_DATABASE,
  maxRetries: env.REDIS_MAX_RETRIES
};

/**
 * JWT configuration object
 */
export const jwtConfig = {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
  refreshSecret: env.JWT_REFRESH_SECRET,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
};

/**
 * CORS configuration object
 */
export const corsConfig = {
  origin: env.CORS_ORIGIN,
  credentials: env.CORS_CREDENTIALS
};

/**
 * Rate limiting configuration object
 */
export const rateLimitConfig = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS
};

/**
 * Stripe configuration object
 */
export const stripeConfig = {
  secretKey: env.STRIPE_SECRET_KEY,
  publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  apiVersion: env.STRIPE_API_VERSION
};

/**
 * Mercado Pago configuration object
 */
export const mercadoPagoConfig = {
  accessToken: env.MP_ACCESS_TOKEN,
  publicKey: env.MP_PUBLIC_KEY,
  webhookSecret: env.MP_WEBHOOK_SECRET
};

/**
 * Email configuration object
 */
export const emailConfig = {
  apiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
  fromName: env.EMAIL_FROM_NAME
};

/**
 * WhatsApp configuration object
 */
export const whatsappConfig = {
  apiKey: env.WHATSAPP_API_KEY,
  phoneNumber: env.WHATSAPP_PHONE_NUMBER,
  enabled: env.WHATSAPP_ENABLED
};

/**
 * Google Sheets configuration object
 */
export const googleSheetsConfig = {
  clientEmail: env.GOOGLE_SHEETS_CLIENT_EMAIL,
  privateKey: env.GOOGLE_SHEETS_PRIVATE_KEY,
  spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
  enabled: env.GOOGLE_SHEETS_ENABLED
};

/**
 * Booking configuration object - Lapa Casa Hostel specific
 */
export const bookingConfig = {
  holdTimeMinutes: env.BOOKING_HOLD_TIME_MINUTES,
  depositPercentage: env.DEPOSIT_PERCENTAGE,
  largeGroupDepositPercentage: env.LARGE_GROUP_DEPOSIT_PERCENTAGE,
  autoChargeDaysBefore: env.AUTO_CHARGE_DAYS_BEFORE,
  flexibleRoomAutoConvertHours: env.FLEXIBLE_ROOM_AUTO_CONVERT_HOURS
};

/**
 * Pricing configuration object - Lapa Casa Hostel specific
 */
export const pricingConfig = {
  basePriceBRL: env.BASE_PRICE_BRL,
  groupDiscounts: {
    sevenBeds: env.GROUP_DISCOUNT_7_BEDS,
    sixteenBeds: env.GROUP_DISCOUNT_16_BEDS,
    twentySixBeds: env.GROUP_DISCOUNT_26_BEDS
  },
  seasonMultipliers: {
    high: env.SEASON_HIGH_MULTIPLIER,
    medium: env.SEASON_MEDIUM_MULTIPLIER,
    low: env.SEASON_LOW_MULTIPLIER,
    carnival: env.SEASON_CARNIVAL_MULTIPLIER
  }
};

/**
 * Room configuration - Lapa Casa Hostel specific
 */
export const roomsConfig = {
  mixto12A: {
    id: 'room_mixto_12a',
    name: 'Mixto 12A',
    capacity: 12,
    type: 'mixed',
    basePrice: env.BASE_PRICE_BRL,
    isFlexible: false
  },
  mixto12B: {
    id: 'room_mixto_12b',
    name: 'Mixto 12B',
    capacity: 12,
    type: 'mixed',
    basePrice: env.BASE_PRICE_BRL,
    isFlexible: false
  },
  mixto7: {
    id: 'room_mixto_7',
    name: 'Mixto 7',
    capacity: 7,
    type: 'mixed',
    basePrice: env.BASE_PRICE_BRL,
    isFlexible: false
  },
  flexible7: {
    id: 'room_flexible_7',
    name: 'Flexible 7',
    capacity: 7,
    type: 'female',
    basePrice: env.BASE_PRICE_BRL,
    isFlexible: true,
    autoConvertHours: env.FLEXIBLE_ROOM_AUTO_CONVERT_HOURS
  }
};

/**
 * Security configuration object
 */
export const securityConfig = {
  bcryptRounds: env.BCRYPT_ROUNDS,
  encryptionKey: env.ENCRYPTION_KEY,
  sessionSecret: env.SESSION_SECRET
};

/**
 * Logging configuration object
 */
export const loggingConfig = {
  level: env.LOG_LEVEL,
  format: env.LOG_FORMAT
};

/**
 * Feature flags configuration object
 */
export const featureFlags = {
  analytics: env.ENABLE_ANALYTICS,
  debugMode: env.ENABLE_DEBUG_MODE,
  maintenanceMode: env.MAINTENANCE_MODE
};

/**
 * Get sanitized environment for logging
 * Removes sensitive information
 */
export const getSanitizedEnv = (): Partial<Environment> => {
  const sanitized = { ...env };
  
  // Remove sensitive keys
  const sensitiveKeys = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'MP_ACCESS_TOKEN',
    'MP_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'WHATSAPP_API_KEY',
    'GOOGLE_SHEETS_PRIVATE_KEY',
    'ENCRYPTION_KEY',
    'SESSION_SECRET',
    'DATABASE_URL',
    'REDIS_PASSWORD'
  ];

  sensitiveKeys.forEach(key => {
    if (key in sanitized) {
      (sanitized as any)[key] = '***REDACTED***';
    }
  });

  return sanitized;
};

/**
 * Validate required integrations based on feature flags
 */
export const validateIntegrations = (): void => {
  const warnings: string[] = [];

  if (whatsappConfig.enabled && !whatsappConfig.apiKey) {
    warnings.push('WhatsApp is enabled but API key is missing');
  }

  if (googleSheetsConfig.enabled && (!googleSheetsConfig.clientEmail || !googleSheetsConfig.privateKey)) {
    warnings.push('Google Sheets is enabled but credentials are missing');
  }

  if (warnings.length > 0) {
    logger.warn('Integration configuration warnings', { warnings });
  }
};

// Validate integrations on startup
validateIntegrations();

export default env;
