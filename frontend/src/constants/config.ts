// Ruta: lapa-casa-hostel-frontend/src/constants/config.ts

import type { 
  AppConfig, 
  Room, 
  SeasonMultipliers, 
  DepositRules, 
  Locale, 
  Currency,
  PricingSeason 
} from '@/types/global';

// Configuración base del hostel
export const HOSTEL_INFO = {
  name: 'Lapa Casa Hostel',
  address: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro',
  phone: '+55 21 XXXX-XXXX',
  email: 'reservas@lapacasahostel.com',
  website: 'https://lapacasahostel.com',
  coordinates: {
    lat: -22.9068,
    lng: -43.1729
  }
} as const;

// Configuración de habitaciones específicas
export const ROOMS: Room[] = [
  {
    id: 'room_mixto_12a',
    name: 'Mixto 12A',
    capacity: 12,
    type: 'mixed',
    basePrice: 60.00,
    isFlexible: false,
    amenities: [
      'Camas individuales',
      'Lockers personales',
      'Aire acondicionado',
      'WiFi gratuito',
      'Baño compartido',
      'Tomas de corriente'
    ],
    images: [
      '/images/rooms/mixto-12a-1.jpg',
      '/images/rooms/mixto-12a-2.jpg',
      '/images/rooms/mixto-12a-3.jpg'
    ],
    description: 'Habitación mixta con 12 camas individuales, ideal para grupos grandes y viajeros que buscan ambiente social.',
    status: 'available'
  },
  {
    id: 'room_mixto_12b',
    name: 'Mixto 12B',
    capacity: 12,
    type: 'mixed',
    basePrice: 60.00,
    isFlexible: false,
    amenities: [
      'Camas individuales',
      'Lockers personales',
      'Aire acondicionado',
      'WiFi gratuito',
      'Baño compartido',
      'Tomas de corriente'
    ],
    images: [
      '/images/rooms/mixto-12b-1.jpg',
      '/images/rooms/mixto-12b-2.jpg',
      '/images/rooms/mixto-12b-3.jpg'
    ],
    description: 'Segunda habitación mixta con 12 camas, perfecta para grupos que viajan juntos.',
    status: 'available'
  },
  {
    id: 'room_mixto_7',
    name: 'Mixto 7',
    capacity: 7,
    type: 'mixed',
    basePrice: 60.00,
    isFlexible: false,
    amenities: [
      'Camas individuales',
      'Lockers personales',
      'Aire acondicionado',
      'WiFi gratuito',
      'Baño compartido',
      'Ventana con vista'
    ],
    images: [
      '/images/rooms/mixto-7-1.jpg',
      '/images/rooms/mixto-7-2.jpg',
      '/images/rooms/mixto-7-3.jpg'
    ],
    description: 'Habitación mixta más íntima con 7 camas, ideal para grupos medianos.',
    status: 'available'
  },
  {
    id: 'room_flexible_7',
    name: 'Flexible 7',
    capacity: 7,
    type: 'female',
    basePrice: 60.00,
    isFlexible: true,
    autoConvertHours: 48,
    amenities: [
      'Camas individuales',
      'Lockers personales',
      'Aire acondicionado',
      'WiFi gratuito',
      'Baño compartido',
      'Espejo de cuerpo entero'
    ],
    images: [
      '/images/rooms/flexible-7-1.jpg',
      '/images/rooms/flexible-7-2.jpg',
      '/images/rooms/flexible-7-3.jpg'
    ],
    description: 'Habitación femenina por defecto que se convierte automáticamente a mixta si no hay reservas femeninas 48h antes del check-in.',
    status: 'available'
  }
];

// Descuentos por grupos (número de camas -> descuento)
export const GROUP_DISCOUNTS: Record<number, number> = {
  7: 0.10,  // 10% descuento para 7-15 camas
  8: 0.10,
  9: 0.10,
  10: 0.10,
  11: 0.10,
  12: 0.10,
  13: 0.10,
  14: 0.10,
  15: 0.10,
  16: 0.15, // 15% descuento para 16-25 camas
  17: 0.15,
  18: 0.15,
  19: 0.15,
  20: 0.15,
  21: 0.15,
  22: 0.15,
  23: 0.15,
  24: 0.15,
  25: 0.15,
  26: 0.20, // 20% descuento para 26+ camas
  27: 0.20,
  28: 0.20,
  29: 0.20,
  30: 0.20,
  31: 0.20,
  32: 0.20,
  33: 0.20,
  34: 0.20,
  35: 0.20,
  36: 0.20,
  37: 0.20,
  38: 0.20,
  39: 0.20,
  40: 0.20,
  41: 0.20,
  42: 0.20,
  43: 0.20,
  44: 0.20,
  45: 0.20  // Capacidad máxima del hostel
};

// Multiplicadores de temporada
export const SEASON_MULTIPLIERS: SeasonMultipliers = {
  high: 1.50,    // Diciembre-Marzo (+50%)
  medium: 1.00,  // Abril-Mayo, Octubre-Noviembre (precio base)
  low: 0.80,     // Junio-Septiembre (-20%)
  carnival: 2.00 // Febrero (+100%, mínimo 5 noches)
};

// Reglas de depósitos
export const DEPOSIT_RULES: DepositRules = {
  standard: 0.30,        // 30% depósito para grupos estándar
  largeGroup: 0.50,      // 50% depósito para grupos 15+ personas
  autoChargeDate: 7,     // Días antes del check-in para cobro automático
  retryAttempts: 3       // Intentos de reintento de pago
};

// Configuración de idiomas
export const LOCALES: Locale[] = ['pt', 'en', 'es'];
export const DEFAULT_LOCALE: Locale = 'pt';

export const LOCALE_NAMES: Record<Locale, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español'
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  es: '🇪🇸'
};

// Configuración de monedas
export const CURRENCIES: Currency[] = ['BRL', 'USD', 'EUR'];
export const DEFAULT_CURRENCY: Currency = 'BRL';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  BRL: 'R$',
  USD: '$',
  EUR: '€'
};

export const CURRENCY_NAMES: Record<Locale, Record<Currency, string>> = {
  pt: {
    BRL: 'Real Brasileiro',
    USD: 'Dólar Americano',
    EUR: 'Euro'
  },
  en: {
    BRL: 'Brazilian Real',
    USD: 'US Dollar',
    EUR: 'Euro'
  },
  es: {
    BRL: 'Real Brasileño',
    USD: 'Dólar Americano',
    EUR: 'Euro'
  }
};

// Mapeamento de temporadas por mes (1-12)
export const MONTH_TO_SEASON: Record<number, PricingSeason> = {
  1: 'high',      // Janeiro
  2: 'carnival',  // Fevereiro (Carnaval)
  3: 'high',      // Março
  4: 'medium',    // Abril
  5: 'medium',    // Maio
  6: 'low',       // Junho
  7: 'low',       // Julho
  8: 'low',       // Agosto
  9: 'low',       // Setembro
  10: 'medium',   // Outubro
  11: 'medium',   // Novembro
  12: 'high'      // Dezembro
};

// Fechas especiales de Carnaval (actualizar anualmente)
export const CARNIVAL_DATES = {
  2024: { start: '2024-02-10', end: '2024-02-13' },
  2025: { start: '2025-03-01', end: '2025-03-04' },
  2026: { start: '2026-02-14', end: '2026-02-17' }
};

// Configuración de pagos
export const PAYMENT_CONFIG = {
  stripe: {
    publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '',
    currencies: ['BRL', 'USD', 'EUR'] as Currency[],
    paymentMethods: ['card', 'apple_pay', 'google_pay'],
    locale: 'pt-BR'
  },
  mercadoPago: {
    publicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || '',
    methods: ['pix', 'credit_card', 'debit_card'],
    installments: 12,
    pixExpiration: 1440, // 24 horas en minutos
    locale: 'pt-BR'
  }
};

// URLs de la API
export const API_ENDPOINTS = {
  base: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  bookings: '/bookings',
  availability: '/availability',
  payments: '/payments',
  rooms: '/rooms',
  admin: '/admin'
};

// Configuración de SEO
export const SEO_CONFIG = {
  titleTemplate: '%s | Lapa Casa Hostel',
  defaultTitle: 'Lapa Casa Hostel - Hostel en Santa Teresa, Rio de Janeiro',
  description: 'Hostel acogedor en Santa Teresa, Rio de Janeiro. Especialistas en grupos grandes. Reserva online con descuentos especiales para grupos de 7+ personas.',
  keywords: [
    'hostel rio de janeiro',
    'santa teresa hostel',
    'grupo hostel',
    'reserva online',
    'lapa casa hostel',
    'rio hostel',
    'hostel grupos grandes'
  ],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://lapacasahostel.com',
    siteName: 'Lapa Casa Hostel',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Lapa Casa Hostel - Santa Teresa, Rio de Janeiro'
      }
    ]
  },
  twitter: {
    cardType: 'summary_large_image',
    site: '@lapacasahostel',
    creator: '@lapacasahostel'
  }
};

// Configuración de analytics
export const ANALYTICS_CONFIG = {
  googleAnalytics: {
    measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '',
    enabled: process.env.NODE_ENV === 'production'
  },
  events: {
    booking_started: 'booking_started',
    room_selected: 'room_selected',
    payment_initiated: 'payment_initiated',
    booking_completed: 'booking_completed',
    page_view: 'page_view'
  }
};

// Configuración de PWA
export const PWA_CONFIG = {
  name: 'Lapa Casa Hostel',
  shortName: 'Lapa Casa',
  description: 'Reserve seu quarto no Lapa Casa Hostel',
  startUrl: '/',
  display: 'standalone',
  backgroundColor: '#ffffff',
  themeColor: '#2563eb',
  icons: [
    {
      src: '/icons/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png'
    },
    {
      src: '/icons/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png'
    }
  ]
};

// Configuración de cache
export const CACHE_CONFIG = {
  defaultTTL: 300, // 5 minutos
  strategies: {
    availability: {
      ttl: 60, // 1 minuto
      staleWhileRevalidate: true
    },
    rooms: {
      ttl: 3600, // 1 hora
      staleWhileRevalidate: true
    },
    pricing: {
      ttl: 300, // 5 minutos
      staleWhileRevalidate: false
    }
  }
};

// Límites y validaciones
export const VALIDATION_LIMITS = {
  minStayNights: 1,
  maxStayNights: 30,
  minAdvanceBooking: 0, // Días mínimos de anticipación
  maxAdvanceBooking: 365, // Días máximos de anticipación
  minGroupSize: 1,
  maxGroupSize: 45, // Capacidad total del hostel
  carnivalMinNights: 5, // Mínimo de noches en Carnaval
  guestNameMinLength: 2,
  guestNameMaxLength: 100,
  phoneMinLength: 10,
  phoneMaxLength: 20,
  emailMaxLength: 100,
  specialRequestsMaxLength: 500
};

// Mensajes de error
export const ERROR_MESSAGES = {
  pt: {
    rooms_not_available: 'Quartos não disponíveis para as datas selecionadas',
    invalid_dates: 'Datas inválidas selecionadas',
    payment_failed: 'Pagamento falhou. Tente novamente.',
    booking_failed: 'Erro ao criar reserva. Tente novamente.',
    network_error: 'Erro de conexão. Verifique sua internet.',
    validation_error: 'Dados inválidos. Verifique as informações.',
    carnival_min_nights: 'Mínimo de 5 noites durante o Carnaval',
    group_too_large: 'Grupo muito grande. Máximo 45 pessoas.',
    booking_not_found: 'Reserva não encontrada'
  },
  en: {
    rooms_not_available: 'Rooms not available for selected dates',
    invalid_dates: 'Invalid dates selected',
    payment_failed: 'Payment failed. Please try again.',
    booking_failed: 'Error creating booking. Please try again.',
    network_error: 'Connection error. Check your internet.',
    validation_error: 'Invalid data. Check the information.',
    carnival_min_nights: 'Minimum 5 nights during Carnival',
    group_too_large: 'Group too large. Maximum 45 people.',
    booking_not_found: 'Booking not found'
  },
  es: {
    rooms_not_available: 'Habitaciones no disponibles para las fechas seleccionadas',
    invalid_dates: 'Fechas inválidas seleccionadas',
    payment_failed: 'Pago falló. Intente nuevamente.',
    booking_failed: 'Error al crear reserva. Intente nuevamente.',
    network_error: 'Error de conexión. Verifique su internet.',
    validation_error: 'Datos inválidos. Verifique la información.',
    carnival_min_nights: 'Mínimo 5 noches durante Carnaval',
    group_too_large: 'Grupo muy grande. Máximo 45 personas.',
    booking_not_found: 'Reserva no encontrada'
  }
};

// Configuración completa de la aplicación
export const APP_CONFIG: AppConfig = {
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://lapacasahostel.com',
  apiUrl: API_ENDPOINTS.base,
  defaultLocale: DEFAULT_LOCALE,
  supportedLocales: LOCALES,
  defaultCurrency: DEFAULT_CURRENCY,
  supportedCurrencies: CURRENCIES,
  rooms: ROOMS,
  pricing: {
    basePrice: 60.00,
    groupDiscounts: GROUP_DISCOUNTS,
    seasonMultipliers: SEASON_MULTIPLIERS,
    depositRules: DEPOSIT_RULES
  },
  payments: {
    stripe: {
      publicKey: PAYMENT_CONFIG.stripe.publicKey,
      secretKey: '', // Solo en backend
      webhookSecret: '', // Solo en backend
      currencies: PAYMENT_CONFIG.stripe.currencies
    },
    mercadoPago: {
      publicKey: PAYMENT_CONFIG.mercadoPago.publicKey,
      accessToken: '', // Solo en backend
      webhookSecret: '', // Solo en backend
      methods: PAYMENT_CONFIG.mercadoPago.methods,
      installments: PAYMENT_CONFIG.mercadoPago.installments,
      pixExpiration: PAYMENT_CONFIG.mercadoPago.pixExpiration
    }
  },
  integrations: {
    googleSheetsId: process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID || '',
    whatsappApiUrl: process.env.NEXT_PUBLIC_WHATSAPP_API_URL || '',
    emailService: process.env.NEXT_PUBLIC_EMAIL_SERVICE || 'resend'
  }
};

export default APP_CONFIG;
