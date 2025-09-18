// ============================================================================
// CORE TYPES - Lapa Casa Hostel MVP
// ============================================================================

// Room Types
export type RoomType = 'mixed' | 'female' | 'male';

export interface Room {
  id: string;
  name: string;
  capacity: number;
  roomType: RoomType;
  isFlexible: boolean;
  basePrice: number;
  description?: string;
  amenities?: string[];
  images?: string[];
}

// Booking Types
export type BookingStatus = 
  | 'PENDING'           // Just created, awaiting payment
  | 'DEPOSIT_PAID'      // Deposit paid, awaiting remainder
  | 'CONFIRMED'         // Fully paid and confirmed
  | 'CANCELLED'         // Cancelled by guest or system
  | 'CHECKED_IN'        // Guest has arrived
  | 'CHECKED_OUT'       // Guest has left
  | 'NO_SHOW';          // Guest didn't arrive

export interface Booking {
  id: string;
  roomId: string;
  room?: Room;
  
  // Guest Information
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  guestNationality?: string;
  guestDocument?: string;
  guestDocumentType?: 'passport' | 'id' | 'driving_license';
  
  // Booking Details
  checkInDate: string;   // ISO date string
  checkOutDate: string;  // ISO date string
  bedsCount: number;
  totalNights: number;
  
  // Pricing
  basePrice: number;     // Price per bed per night
  totalPrice: number;    // Final total after discounts
  discountAmount: number;
  discountPercentage: number;
  
  // Payment
  depositAmount: number;
  remainingAmount: number;
  depositPaid: boolean;
  remainingPaid: boolean;
  
  // Status & Metadata
  status: BookingStatus;
  paymentMethod?: PaymentMethod;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  
  // Optional relations
  payments?: Payment[];
}

// Payment Types
export type PaymentStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentMethod = 
  | 'stripe_card'
  | 'stripe_apple_pay'
  | 'stripe_google_pay'
  | 'mercadopago_pix'
  | 'mercadopago_credit'
  | 'mercadopago_debit';

export type PaymentType = 'deposit' | 'remaining' | 'full';

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  externalId?: string;   // Stripe or MP payment ID
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
  
  // Payment-specific data
  stripeData?: {
    paymentIntentId: string;
    clientSecret?: string;
  };
  mercadoPagoData?: {
    paymentId: string;
    preferenceId?: string;
    pixQrCode?: string;
    pixQrCodeBase64?: string;
  };
}

// Availability Types
export interface RoomAvailability {
  roomId: string;
  date: string;          // ISO date string
  totalCapacity: number;
  occupiedBeds: number;
  availableBeds: number;
  isAvailable: boolean;
}

export interface AvailabilityRequest {
  checkInDate: string;
  checkOutDate: string;
  bedsCount: number;
  roomPreference?: string[];  // Preferred room IDs
}

export interface AvailabilityResponse {
  isAvailable: boolean;
  availableRooms: Room[];
  suggestions?: {
    alternativeDates?: string[];
    maxAvailableBeds?: number;
  };
  priceBreakdown: PriceBreakdown;
}

// Pricing Types
export interface PriceBreakdown {
  basePrice: number;
  totalNights: number;
  bedsCount: number;
  subtotal: number;
  
  // Discounts
  groupDiscount: {
    percentage: number;
    amount: number;
  };
  
  // Seasonal pricing
  seasonMultiplier: number;
  seasonName: string;
  
  // Final amounts
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  
  // Breakdown per night (optional)
  nightlyBreakdown?: {
    date: string;
    basePrice: number;
    finalPrice: number;
    multiplier: number;
  }[];
}

// Group discount rules
export interface GroupDiscount {
  minBeds: number;
  percentage: number;
  description: string;
}

// Season pricing
export type SeasonType = 'low' | 'medium' | 'high' | 'carnival';

export interface SeasonPricing {
  seasonType: SeasonType;
  multiplier: number;
  startDate: string;
  endDate: string;
  description: string;
}

// Form Types for Booking Flow
export interface BookingFormData {
  // Step 1: Dates & Beds
  checkInDate: Date;
  checkOutDate: Date;
  bedsCount: number;
  
  // Step 2: Guest Information
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestNationality: string;
  guestDocument?: string;
  guestDocumentType?: 'passport' | 'id' | 'driving_license';
  
  // Step 3: Additional Info
  specialRequests?: string;
  agreedToTerms: boolean;
  marketingConsent: boolean;
  
  // Internal
  selectedRoomId?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}

// Common error codes
export const ERROR_CODES = {
  // Booking errors
  INSUFFICIENT_AVAILABILITY: 'INSUFFICIENT_AVAILABILITY',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  
  // Payment errors
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  INVALID_PAYMENT_METHOD: 'INVALID_PAYMENT_METHOD',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // System errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// UI Component Types
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

// Internationalization
export type Locale = 'en' | 'pt' | 'es';

export interface LocaleConfig {
  code: Locale;
  name: string;
  flag: string;
  currency: string;
}

// Admin Types (for Phase 4)
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'staff';
  permissions: string[];
  lastLogin?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalBookings: number;
  totalRevenue: number;
  occupancyRate: number;
  pendingPayments: number;
  upcomingCheckIns: number;
  upcomingCheckOuts: number;
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredField<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Constants
export const ROOM_CAPACITY = {
  MIXTO_12A: 12,
  MIXTO_12B: 12,
  MIXTO_7: 7,
  FLEXIBLE_7: 7,
} as const;

export const GROUP_DISCOUNTS: GroupDiscount[] = [
  { minBeds: 7, percentage: 10, description: '10% off for 7+ beds' },
  { minBeds: 16, percentage: 15, description: '15% off for 16+ beds' },
  { minBeds: 26, percentage: 20, description: '20% off for 26+ beds' },
];

export const DEPOSIT_PERCENTAGE = 0.30; // 30%
export const REMAINING_PERCENTAGE = 0.70; // 70%
export const REMAINING_CHARGE_DAYS = 7; // Days before check-in

// Export commonly used type guards
export const isBookingConfirmed = (booking: Booking): boolean => {
  return booking.status === 'CONFIRMED' && booking.depositPaid && booking.remainingPaid;
};

export const isPaymentSuccessful = (payment: Payment): boolean => {
  return payment.status === 'SUCCEEDED';
};

export const isRoomAvailable = (availability: RoomAvailability, requiredBeds: number): boolean => {
  return availability.isAvailable && availability.availableBeds >= requiredBeds;
};
