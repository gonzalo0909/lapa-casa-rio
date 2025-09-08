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
    publicKey: process.env.STRIPE_PUBLIC_KEY || '',
  },
  mercadoPago: {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
  },
  pix: {
    key: process.env.PIX_KEY || 'lapacasahostel@gmail.com',
    merchantName: process.env.PIX_MERCHANT_NAME || 'LAPA CASA HOSTEL',
    merchantCity: process.env.PIX_MERCHANT_CITY || 'RIO DE JANEIRO',
  },

  // Email
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    fromAddress: process.env.EMAIL_FROM || 'noreply@lapacasahostel.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Lapa Casa Hostel',
  },

  // WhatsApp/SMS
  whatsapp: {
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioWhatsAppNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
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
    holdTimeoutMinutes: parseInt(process.env.HOLD_TIMEOUT_MINUTES || '10'),
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

  // Features
  features: {
    emailEnabled: process.env.ENABLE_EMAIL === 'true',
    whatsappEnabled: process.env.ENABLE_WHATSAPP === 'true',
    sheetsEnabled: process.env.ENABLE_SHEETS === 'true',
    paymentsEnabled: process.env.ENABLE_PAYMENTS !== 'false', // default true
  },
} as const;

// Validaciones
if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

if (config.nodeEnv === 'production') {
  const requiredConfigs = [];
  
  if (!config.stripe.secretKey) requiredConfigs.push('STRIPE_SECRET_KEY');
  if (!config.mercadoPago.accessToken) requiredConfigs.push('MERCADOPAGO_ACCESS_TOKEN');
  if (config.features.emailEnabled && !config.email.sendgridApiKey) requiredConfigs.push('SENDGRID_API_KEY');
  
  if (requiredConfigs.length > 0) {
    console.warn(`Missing production configs: ${requiredConfigs.join(', ')}`);
  }
}
