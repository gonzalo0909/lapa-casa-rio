// lapa-casa-hostel/backend/src/types/api.ts

/**
 * API Types and Interfaces
 * Type definitions for Lapa Casa Hostel Channel Manager API
 * 
 * Features:
 * - Request/Response types
 * - Booking types
 * - Payment types
 * - Room types
 * - Guest types
 * - Error types
 * - Utility types
 */

/**
 * Standard API Response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/**
 * API Error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  path?: string;
  requestId?: string;
}

/**
 * API Metadata
 */
export interface ApiMeta {
  timestamp: string;
  requestId: string;
  version: string;
  pagination?: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Booking Request - Create new booking
 */
export interface CreateBookingRequest {
  checkInDate: string; // ISO date YYYY-MM-DD
  checkOutDate: string; // ISO date YYYY-MM-DD
  rooms: RoomSelection[];
  guest: GuestDetails;
  specialRequests?: string;
  source?: BookingSource;
  promoCode?: string;
}

/**
 * Room selection for booking
 */
export interface RoomSelection {
  roomId: string; // room_mixto_12a, room_mixto_12b, room_mixto_7, room_flexible_7
  bedsCount: number;
  guestNames?: string[];
}

/**
 * Guest details
 */
export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  documentType?: 'passport' | 'id' | 'driver_license';
  documentNumber?: string;
  dateOfBirth?: string; // ISO date
  language?: 'pt' | 'en' | 'es';
}

/**
 * Booking response
 */
export interface BookingResponse {
  bookingId: string;
  confirmationNumber: string;
  status: BookingStatus;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  rooms: RoomAssignment[];
  guest: GuestDetails;
  pricing: BookingPricing;
  payment: PaymentInfo;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string; // For pending bookings
}

/**
 * Room assignment in booking
 */
export interface RoomAssignment {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  bedsCount: number;
  bedsAllocated: number[];
  pricePerBed: number;
  totalPrice: number;
}

/**
 * Booking pricing breakdown
 */
export interface BookingPricing {
  basePrice: number;
  totalBeds: number;
  nights: number;
  subtotal: number;
  groupDiscount: DiscountInfo;
  seasonMultiplier: SeasonInfo;
  totalPrice: number;
  currency: 'BRL';
  pricePerNight: number;
}

/**
 * Discount information
 */
export interface DiscountInfo {
  applicable: boolean;
  percentage: number; // 0.10 = 10%
  amount: number;
  reason: string; // "7+ beds", "16+ beds", "26+ beds"
}

/**
 * Season information
 */
export interface SeasonInfo {
  season: 'high' | 'medium' | 'low' | 'carnival';
  multiplier: number; // 1.50, 1.00, 0.80, 2.00
  effectivePrice: number;
}

/**
 * Payment information
 */
export interface PaymentInfo {
  depositAmount: number;
  depositPercentage: number;
  depositPaid: boolean;
  depositDueDate?: string;
  remainingAmount: number;
  remainingPaid: boolean;
  remainingDueDate?: string;
  totalPaid: number;
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactions: PaymentTransaction[];
}

/**
 * Payment transaction
 */
export interface PaymentTransaction {
  transactionId: string;
  type: 'deposit' | 'remaining' | 'full';
  amount: number;
  currency: 'BRL';
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayReference?: string;
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
}

/**
 * Create payment intent request
 */
export interface CreatePaymentIntentRequest {
  bookingId: string;
  amount: number;
  type: 'deposit' | 'remaining' | 'full';
  paymentMethod: PaymentMethod;
  saveCard?: boolean;
}

/**
 * Payment intent response
 */
export interface PaymentIntentResponse {
  intentId: string;
  clientSecret?: string; // For Stripe
  qrCode?: string; // For PIX
  qrCodeBase64?: string; // For PIX
  paymentUrl?: string; // For Mercado Pago redirect
  amount: number;
  currency: 'BRL';
  status: PaymentStatus;
  expiresAt: string;
}

/**
 * Confirm payment request
 */
export interface ConfirmPaymentRequest {
  bookingId: string;
  intentId: string;
  paymentMethod: PaymentMethod;
  metadata?: Record<string, any>;
}

/**
 * Availability check request
 */
export interface CheckAvailabilityRequest {
  checkInDate: string; // ISO date YYYY-MM-DD
  checkOutDate: string; // ISO date YYYY-MM-DD
  bedsRequired: number;
  roomType?: RoomType | 'any';
}

/**
 * Availability response
 */
export interface AvailabilityResponse {
  available: boolean;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalBedsRequested: number;
  rooms: RoomAvailability[];
  recommendations?: RoomRecommendation[];
}

/**
 * Room availability
 */
export interface RoomAvailability {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  capacity: number;
  availableBeds: number;
  occupiedBeds: number;
  isFlexible: boolean;
  flexibleNote?: string;
  pricing: RoomPricing;
}

/**
 * Room pricing
 */
export interface RoomPricing {
  basePrice: number;
  pricePerBed: number;
  pricePerNight: number;
  totalPrice: number;
  currency: 'BRL';
  season: SeasonInfo;
}

/**
 * Room recommendation
 */
export interface RoomRecommendation {
  rooms: string[]; // Array of room IDs
  totalBeds: number;
  totalPrice: number;
  savings: number;
  reason: string;
}

/**
 * Room details response
 */
export interface RoomDetailsResponse {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  capacity: number;
  basePrice: number;
  isFlexible: boolean;
  autoConvertHours?: number;
  amenities: string[];
  description: string;
  images: string[];
}

/**
 * Update booking request
 */
export interface UpdateBookingRequest {
  status?: BookingStatus;
  specialRequests?: string;
  guestDetails?: Partial<GuestDetails>;
}

/**
 * Cancel booking request
 */
export interface CancelBookingRequest {
  bookingId: string;
  reason: string;
  refundAmount?: number;
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
  signature?: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: ServiceHealth[];
}

/**
 * Service health status
 */
export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  latency?: number;
  message?: string;
}

/**
 * List bookings query
 */
export interface ListBookingsQuery {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  checkInFrom?: string;
  checkInTo?: string;
  guestEmail?: string;
  sortBy?: 'createdAt' | 'checkInDate' | 'totalPrice';
  sortOrder?: 'asc' | 'desc';
}

/**
 * List bookings response
 */
export interface ListBookingsResponse {
  bookings: BookingResponse[];
  pagination: PaginationMeta;
}

/**
 * Enums
 */
export type BookingStatus = 
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED';

export type PaymentStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentMethod = 
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'PIX'
  | 'BOLETO'
  | 'BANK_TRANSFER'
  | 'CASH';

export type RoomType = 
  | 'mixed'
  | 'female'
  | 'male'
  | 'private';

export type BookingSource = 
  | 'DIRECT'
  | 'BOOKING_COM'
  | 'AIRBNB'
  | 'HOSTELWORLD'
  | 'WALK_IN'
  | 'PHONE'
  | 'EMAIL';

export type WebhookEvent = 
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.refunded';

/**
 * Error codes
 */
export enum ApiErrorCode {
  // General
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  
  // Booking
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  BOOKING_EXPIRED = 'BOOKING_EXPIRED',
  NO_AVAILABILITY = 'NO_AVAILABILITY',
  INVALID_DATES = 'INVALID_DATES',
  MINIMUM_STAY_NOT_MET = 'MINIMUM_STAY_NOT_MET',
  
  // Payment
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_PAYMENT_METHOD = 'INVALID_PAYMENT_METHOD',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS'
}

/**
 * Request context (added by middleware)
 */
export interface RequestContext {
  requestId: string;
  ip: string;
  userAgent: string;
  timestamp: string;
  userId?: string;
}

/**
 * Utility type for paginated requests
 */
export interface PaginatedRequest {
  page?: number;
  limit?: number;
}

/**
 * Utility type for date range requests
 */
export interface DateRangeRequest {
  startDate: string;
  endDate: string;
}

/**
 * Utility type for sorting
 */
export interface SortOptions {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default {
  ApiResponse,
  ApiError,
  BookingResponse,
  PaymentIntentResponse,
  AvailabilityResponse
};
