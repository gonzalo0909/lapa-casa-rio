// lapa-casa-hostel/backend/src/types/api.ts

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CreateBookingRequest {
  checkIn: string;
  checkOut: string;
  rooms: RoomSelection[];
  guest: GuestDetails;
  specialRequests?: string;
  language?: 'pt' | 'en' | 'es';
}

export interface RoomSelection {
  roomId: string;
  bedsCount: number;
}

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
  language?: 'pt' | 'en' | 'es';
}

export interface CheckAvailabilityRequest {
  checkIn: string;
  checkOut: string;
  beds: number;
}

export interface CreatePaymentIntentRequest {
  bookingId: string;
  amount: number;
  type: 'deposit' | 'remaining';
  paymentMethod: string;
}

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'no_show'
  | 'completed';

export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export type PaymentMethod = 'card' | 'pix' | 'bank_transfer' | 'cash';

export type RoomType = 'mixed' | 'female' | 'male';

export enum ApiErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  NO_AVAILABILITY = 'NO_AVAILABILITY',
  INVALID_DATES = 'INVALID_DATES',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}
