import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Payments
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  mercadoPago: {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
  },

  // Email
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    fromAddress: process.env.EMAIL_FROM || 'noreply@lapacasahostel.com',
  },

  // External APIs
  sheets: {
    webappUrl: process.env.SHEETS_WEBAPP_URL || '',
    webappToken: process.env.SHEETS_WEBAPP_TOKEN || '',
  },

  // Security
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
  adminToken: process.env.ADMIN_TOKEN || 'admin-token',

  // Business Logic
  business: {
    holdTimeoutMinutes: 10,
    maxAdvanceBookingDays: 365,
    minStayNights: 1,
    maxStayNights: 30,
    rooms: {
      1: { name: 'Cuarto 1 (Mixto)', beds: 12, femaleOnly: false, basePrice: 55 },
      3: { name: 'Cuarto 3 (Mixto)', beds: 12, femaleOnly: false, basePrice: 55 },
      5: { name: 'Cuarto 5 (Mixto)', beds: 7, femaleOnly: false, basePrice: 55 },
      6: { name: 'Cuarto 6 (Feminino)', beds: 7, femaleOnly: true, basePrice: 60 },
    },
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;

// Validaciones
if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

if (config.nodeEnv === 'production') {
  if (!config.stripe.secretKey) {
    console.warn('STRIPE_SECRET_KEY not configured');
  }
  if (!config.mercadoPago.accessToken) {
    console.warn('MERCADOPAGO_ACCESS_TOKEN not configured');
  }
}
