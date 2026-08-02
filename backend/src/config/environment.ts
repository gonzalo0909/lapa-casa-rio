// lapa-casa-hostel/backend/src/config/environment.ts

import dotenv from 'dotenv';
dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  APP_URL: process.env.APP_URL || 'https://lapacasahostel.com',
  API_VERSION: process.env.API_VERSION || 'v1',

  DATABASE_URL: process.env.DATABASE_URL || '',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',

  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars-long!',

  WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED === 'true',
  WHATSAPP_API_URL: process.env.WHATSAPP_API_URL || '',
  WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN || '',
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID || '',

  CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
};

if (!env.DATABASE_URL) {
  console.warn('[ENV] DATABASE_URL not set — database connections will fail');
}

const allowedOrigins = env.CORS_ORIGINS === '*'
  ? ['*']
  : env.CORS_ORIGINS.split(',').map(o => o.trim());

const isStrictCors = env.NODE_ENV === 'production' && env.CORS_ORIGINS !== '*';

console.info(
  JSON.stringify({
    level: 'INFO',
    message: 'Environment configuration validated successfully',
  })
);

console.info(
  JSON.stringify({
    level: 'INFO',
    message: 'CORS Configuration',
    environment: env.NODE_ENV,
    allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    strictMode: isStrictCors,
  })
);

export const isProduction = (): boolean => env.NODE_ENV === 'production';

export { env };
export { env as environment };
export default env;
