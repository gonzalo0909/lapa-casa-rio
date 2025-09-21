// Ruta: lapa-casa-hostel-frontend/src/types/global.ts

// Tipos de habitaciones disponibles
export type RoomType = 'mixed' | 'female' | 'male';

// Estados de disponibilidad
export type AvailabilityStatus = 'available' | 'occupied' | 'maintenance' | 'blocked';

// Estados de reserva
export type BookingStatus = 
  | 'PENDING' 
  | 'PENDING_PAYMENT' 
  | 'CONFIRMED' 
  | 'CANCELLED' 
  | 'CHECKED_IN' 
  | 'CHECKED_OUT' 
  | 'NO_SHOW'
  | 'PAYMENT_FAILED';

// Tipos de pago
export type PaymentMethod = 'stripe' | 'mercadopago';
export type PaymentType = 'deposit' | 'remaining' | 'full';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

// Currencies soportadas
export type Currency = 'BRL' | 'USD' | 'EUR';

// Idiomas soportados
export type Locale = 'pt' | 'en' | 'es';

// Temporadas de precios
export type PricingSeason = 'low' | 'medium' | 'high' | 'carnival';

// Métodos de pago Mercado Pago
export type MercadoPagoMethod = 'pix' | 'credit_card' | 'debit_card';

// Tipos de notificación
export type NotificationType = 
  | 'booking_confirmation'
  | 'payment_reminder' 
  | 'payment_success'
  | 'check_in_reminder'
  | 'welcome_message'
  | 'cancellation_notice';

// Definición de habitación
export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: RoomType;
  basePrice: number;
  isFlexible: boolean;
  autoConvertHours?: number;
  amenities: string[];
  images: string[];
  description: string;
  status: AvailabilityStatus;
}

// Información de huésped
export interface Guest {
  name: string;
  email: string;
  phone: string;
  country: string;
  document?: string;
  age?: number;
  specialRequests?: string;
}

// Datos de disponibilidad
export interface AvailabilityQuery {
  checkIn: Date;
  checkOut: Date;
  beds: number;
  roomType?: RoomType;
}

export interface AvailabilityResult {
  available: boolean;
  rooms: Room[];
  suggestedDates?: Date[];
  alternativeOptions?: AlternativeOption[];
}

export interface AlternativeOption {
  checkIn: Date;
  checkOut: Date;
  rooms: Room[];
  totalPrice: number;
}

// Cálculo de precios
export interface PricingCalculation {
  basePrice: number;
  nights: number;
  beds: number;
  subtotal: number;
  groupDiscount: number;
  groupDiscountAmount: number;
  seasonMultiplier: number;
  seasonMultiplierAmount: number;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  season: PricingSeason;
}

// Datos de reserva
export interface Booking {
  id: string;
  roomId: string;
  guest: Guest;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  beds: number;
  pricing: PricingCalculation;
  status: BookingStatus;
  paymentMethod?: PaymentMethod;
  depositPaid: boolean;
  remainingPaid: boolean;
  stripePaymentId?: string;
  mpPaymentId?: string;
  googleSheetsSynced: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Datos de pago
export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: Currency;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  externalId?: string;
  processedAt?: Date;
  createdAt: Date;
  errorMessage?: string;
}

// Configuración de Stripe
export interface StripeConfig {
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  currencies: Currency[];
  paymentMethods: string[];
}

// Configuración de Mercado Pago
export interface MercadoPagoConfig {
  publicKey: string;
  accessToken: string;
  webhookSecret: string;
  methods: MercadoPagoMethod[];
  installments: number;
  pixExpiration: number;
}

// Reglas de depósito
export interface DepositRules {
  standard: number;
  largeGroup: number;
  autoChargeDate: number;
  retryAttempts: number;
}

// Multiplicadores de temporada
export interface SeasonMultipliers {
  high: number;
  medium: number;
  low: number;
  carnival: number;
}

// Configuración de la aplicación
export interface AppConfig {
  baseUrl: string;
  apiUrl: string;
  defaultLocale: Locale;
  supportedLocales: Locale[];
  defaultCurrency: Currency;
  supportedCurrencies: Currency[];
  rooms: Room[];
  pricing: {
    basePrice: number;
    groupDiscounts: Record<number, number>;
    seasonMultipliers: SeasonMultipliers;
    depositRules: DepositRules;
  };
  payments: {
    stripe: StripeConfig;
    mercadoPago: MercadoPagoConfig;
  };
  integrations: {
    googleSheetsId: string;
    whatsappApiUrl: string;
    emailService: string;
  };
}

// Respuestas de la API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Estados de la UI
export interface UIState {
  isLoading: boolean;
  error: string | null;
  success: string | null;
  currentStep: number;
  totalSteps: number;
}

// Estados del formulario de reserva
export interface BookingFormState {
  availability: AvailabilityQuery;
  selectedRoom: Room | null;
  guest: Partial<Guest>;
  pricing: PricingCalculation | null;
  paymentMethod: PaymentMethod | null;
  ui: UIState;
}

// Configuración de Google Sheets
export interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
  sheetName: string;
  columns: Record<string, string>;
}

// Datos para sincronización con Google Sheets
export interface SheetRowData {
  booking_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  room_assigned: string;
  beds_count: number;
  total_price: number;
  deposit_paid: boolean;
  remaining_paid: boolean;
  booking_status: BookingStatus;
  created_date: string;
  notes: string;
}

// Eventos para analytics
export interface AnalyticsEvent {
  event: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  properties?: Record<string, any>;
}

// Configuración de SEO
export interface SEOConfig {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  canonicalUrl: string;
  structuredData: Record<string, any>;
}

// Datos estructurados para Schema.org
export interface StructuredData {
  '@context': string;
  '@type': string;
  name: string;
  description: string;
  url: string;
  telephone: string;
  address: {
    '@type': string;
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  starRating?: {
    '@type': string;
    ratingValue: number;
    bestRating: number;
  };
}

// Configuración de PWA
export interface PWAConfig {
  name: string;
  shortName: string;
  description: string;
  startUrl: string;
  display: string;
  backgroundColor: string;
  themeColor: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
}

// Configuración de cache
export interface CacheConfig {
  defaultTTL: number;
  strategies: Record<string, {
    ttl: number;
    staleWhileRevalidate: boolean;
  }>;
}

// Errores personalizados
export class BookingError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public paymentMethod?: PaymentMethod
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class AvailabilityError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AvailabilityError';
  }
}

// Utilidades de tipos
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
