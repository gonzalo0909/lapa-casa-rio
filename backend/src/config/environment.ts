// lapa-casa-hostel/backend/src/config/environment.ts

import dotenv from 'dotenv';
dotenv.config();

// C-02: en producción, los secretos críticos son obligatorios — la app
// no debe arrancar con valores por defecto conocidos públicamente.
const isProd = process.env.NODE_ENV === 'production';

function requireSecret(name: string, fallback?: string): string {
  const val = process.env[name] || fallback;
  if (!val) {
    if (isProd) {throw new Error(`[ENV] ${name} es obligatorio en producción`);}
    console.warn(`[ENV] ${name} no configurado — usando valor de desarrollo`);
    return '';
  }
  return val;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  APP_URL: process.env.APP_URL || 'https://lapacasario.com',
  API_VERSION: process.env.API_VERSION || 'v1',

  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || '',

  // C-02: sin fallback hardcodeado en producción
  // JWT_EXPIRES_IN se lee directo de process.env en admin-auth.routes.ts
  // (default real '24h') -- no se duplica acá para evitar que este objeto
  // quede con un default desactualizado que nadie lee.
  JWT_SECRET: requireSecret('JWT_SECRET', isProd ? undefined : 'dev-secret-change-in-production'),

  // C-02: sin fallback hardcodeado en producción
  ENCRYPTION_KEY: requireSecret('ENCRYPTION_KEY', isProd ? undefined : 'dev-encryption-key-32-chars-long!'),

  WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED === 'true',
  WHATSAPP_API_URL: process.env.WHATSAPP_API_URL || '',
  WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN || '',
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID || '',

  CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS !== 'false',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),

  // webhooks de reservas OTA (solo Booking.com y Expedia tienen
  // -- Airbnb/Hostelworld son iCal-only, ver config/channels.ts). Sin el
  // secret configurado, el webhook de ese canal rechaza todo con 401 en
  // vez de aceptar sin verificar (nunca "modo test que acepta todo" para
  // un endpoint que crea reservas reales).
  BOOKING_WEBHOOK_SECRET: process.env.BOOKING_WEBHOOK_SECRET || '',
  BOOKING_WEBHOOK_API_KEY: process.env.BOOKING_WEBHOOK_API_KEY || '',
  BOOKING_WEBHOOK_IPS: process.env.BOOKING_WEBHOOK_IPS || '',
  EXPEDIA_WEBHOOK_SECRET: process.env.EXPEDIA_WEBHOOK_SECRET || '',
  EXPEDIA_WEBHOOK_API_KEY: process.env.EXPEDIA_WEBHOOK_API_KEY || '',
  EXPEDIA_WEBHOOK_IPS: process.env.EXPEDIA_WEBHOOK_IPS || '',

  // C-01: secret para verificar firma HMAC-SHA256 de notificaciones MP.
  // Activar en el dashboard de MercadoPago → Webhooks → Firma de notificaciones.
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET || '',

  // Telegram bot para alertas de Sentry (opcional — si no están configurados el
  // endpoint acepta el webhook pero no envía nada).
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
  SENTRY_WEBHOOK_SECRET: process.env.SENTRY_WEBHOOK_SECRET || '',
};

if (!env.DATABASE_URL) {
  // Auditoría 17 secciones, sección 15: antes solo advertía y dejaba
  // arrancar el proceso -- fail-fast en producción, consistente con
  // JWT_SECRET/ENCRYPTION_KEY/ADMIN_PASSWORD_HASH de acá abajo, en vez de
  // levantar un servidor que va a fallar en el primer query real.
  if (isProd) {
    throw new Error('[ENV] DATABASE_URL es obligatorio en producción');
  }
  console.warn('[ENV] DATABASE_URL not set — database connections will fail');
}
// C-02: verificar ADMIN_PASSWORD_HASH también
if (isProd && !process.env.ADMIN_PASSWORD_HASH) {
  throw new Error('[ENV] ADMIN_PASSWORD_HASH es obligatorio en producción');
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
