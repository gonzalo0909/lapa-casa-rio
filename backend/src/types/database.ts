// lapa-casa-hostel/backend/src/types/database.ts

/**
 * Database Types and Interfaces
 * Type definitions for database models and Prisma ORM
 * Lapa Casa Hostel Channel Manager
 * 
 * Features:
 * - Database entity types
 * - Prisma model extensions
 * - Query result types
 * - Relation types
 * - Enum types
 */

import { Prisma } from '@prisma/client';

/**
 * Room entity
 */
export interface Room {
  id: string;
  name: string;
  type: RoomTypeEnum;
  capacity: number;
  basePrice: Prisma.Decimal;
  isFlexible: boolean;
  autoConvertHours?: number;
  description?: string;
  amenities: string[];
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Booking entity
 */
export interface Booking {
  id: string;
  confirmationNumber: string;
  status: BookingStatusEnum;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  totalBeds: number;
  subtotal: Prisma.Decimal;
  groupDiscount: Prisma.Decimal;
  seasonMultiplier: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  depositAmount: Prisma.Decimal;
  depositPaid: boolean;
  depositDueDate?: Date;
  remainingAmount: Prisma.Decimal;
  remainingPaid: boolean;
  remainingDueDate?: Date;
  specialRequests?: string;
  source: BookingSourceEnum;
  promoCode?: string;
  guestId: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
}

/**
 * Booking with relations
 */
export interface BookingWithRelations extends Booking {
  guest: Guest;
  rooms: BookingRoom[];
  payments: Payment[];
  logs: BookingLog[];
}

/**
 * BookingRoom entity (join table)
 */
export interface BookingRoom {
  id: string;
  bookingId: string;
  roomId: string;
  bedsCount: number;
  bedsAllocated: number[];
  pricePerBed: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  createdAt: Date;
}

/**
 * BookingRoom with relations
 */
export interface BookingRoomWithRelations extends BookingRoom {
  booking: Booking;
  room: Room;
}

/**
 * Guest entity
 */
export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  documentType?: DocumentTypeEnum;
  documentNumber?: string;
  dateOfBirth?: Date;
  language: LanguageEnum;
  totalBookings: number;
  totalSpent: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Guest with relations
 */
export interface GuestWithRelations extends Guest {
  bookings: Booking[];
}

/**
 * Payment entity
 */
export interface Payment {
  id: string;
  bookingId: string;
  type: PaymentTypeEnum;
  amount: Prisma.Decimal;
  currency: string;
  method: PaymentMethodEnum;
  status: PaymentStatusEnum;
  gatewayReference?: string;
  stripePaymentIntentId?: string;
  mpPaymentId?: string;
  pixQrCode?: string;
  metadata?: Prisma.JsonValue;
  failureReason?: string;
  processedAt?: Date;
  refundedAt?: Date;
  refundAmount?: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment with relations
 */
export interface PaymentWithRelations extends Payment {
  booking: Booking;
}

/**
 * BookingLog entity (audit trail)
 */
export interface BookingLog {
  id: string;
  bookingId: string;
  action: BookingActionEnum;
  changes?: Prisma.JsonValue;
  performedBy?: string;
  performedByType: PerformedByTypeEnum;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * BookingLog with relations
 */
export interface BookingLogWithRelations extends BookingLog {
  booking: Booking;
}

/**
 * Availability lock entity (prevent double booking)
 */
export interface AvailabilityLock {
  id: string;
  roomId: string;
  date: Date;
  beds: number[];
  lockedBy: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Season configuration entity
 */
export interface SeasonConfig {
  id: string;
  name: string;
  type: SeasonTypeEnum;
  startDate: Date;
  endDate: Date;
  multiplier: Prisma.Decimal;
  minimumNights?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Promo code entity
 */
export interface PromoCode {
  id: string;
  code: string;
  type: PromoTypeEnum;
  discountValue: Prisma.Decimal;
  minimumBeds?: number;
  minimumNights?: number;
  validFrom: Date;
  validTo: Date;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification entity
 */
export interface Notification {
  id: string;
  bookingId?: string;
  type: NotificationTypeEnum;
  channel: NotificationChannelEnum;
  recipient: string;
  subject?: string;
  content: string;
  status: NotificationStatusEnum;
  sentAt?: Date;
  failureReason?: string;
  metadata?: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database Enums
 */
export enum RoomTypeEnum {
  MIXED = 'mixed',
  FEMALE = 'female',
  MALE = 'male',
  PRIVATE = 'private'
}

export enum BookingStatusEnum {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  EXPIRED = 'EXPIRED'
}

export enum PaymentStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED'
}

export enum PaymentMethodEnum {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH'
}

export enum PaymentTypeEnum {
  DEPOSIT = 'deposit',
  REMAINING = 'remaining',
  FULL = 'full'
}

export enum BookingSourceEnum {
  DIRECT = 'DIRECT',
  BOOKING_COM = 'BOOKING_COM',
  AIRBNB = 'AIRBNB',
  HOSTELWORLD = 'HOSTELWORLD',
  WALK_IN = 'WALK_IN',
  PHONE = 'PHONE',
  EMAIL = 'EMAIL'
}

export enum DocumentTypeEnum {
  PASSPORT = 'passport',
  ID = 'id',
  DRIVER_LICENSE = 'driver_license'
}

export enum LanguageEnum {
  PT = 'pt',
  EN = 'en',
  ES = 'es'
}

export enum BookingActionEnum {
  CREATED = 'CREATED',
  CONFIRMED = 'CONFIRMED',
  UPDATED = 'UPDATED',
  CANCELLED = 'CANCELLED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUNDED = 'REFUNDED',
  NO_SHOW = 'NO_SHOW',
  EXPIRED = 'EXPIRED'
}

export enum PerformedByTypeEnum {
  SYSTEM = 'SYSTEM',
  ADMIN = 'ADMIN',
  GUEST = 'GUEST',
  INTEGRATION = 'INTEGRATION'
}

export enum SeasonTypeEnum {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  CARNIVAL = 'carnival',
  SPECIAL = 'special'
}

export enum PromoTypeEnum {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed'
}

export enum NotificationTypeEnum {
  BOOKING_CONFIRMATION = 'BOOKING_CONFIRMATION',
  BOOKING_REMINDER = 'BOOKING_REMINDER',
  PAYMENT_REMINDER = 'PAYMENT_REMINDER',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CHECK_IN_REMINDER = 'CHECK_IN_REMINDER',
  CHECK_OUT_REMINDER = 'CHECK_OUT_REMINDER',
  CANCELLATION = 'CANCELLATION',
  ADMIN_ALERT = 'ADMIN_ALERT'
}

export enum NotificationChannelEnum {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH'
}

export enum NotificationStatusEnum {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  DELIVERED = 'DELIVERED'
}

/**
 * Query filter types
 */
export interface BookingFilters {
  status?: BookingStatusEnum | BookingStatusEnum[];
  checkInFrom?: Date;
  checkInTo?: Date;
  checkOutFrom?: Date;
  checkOutTo?: Date;
  guestEmail?: string;
  roomId?: string;
  source?: BookingSourceEnum;
}

export interface PaymentFilters {
  status?: PaymentStatusEnum | PaymentStatusEnum[];
  method?: PaymentMethodEnum | PaymentMethodEnum[];
  type?: PaymentTypeEnum;
  bookingId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GuestFilters {
  email?: string;
  phone?: string;
  country?: string;
  totalBookingsMin?: number;
  totalSpentMin?: number;
}

/**
 * Query result types
 */
export interface BookingQueryResult {
  bookings: BookingWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaymentQueryResult {
  payments: PaymentWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OccupancyStats {
  date: Date;
  roomId: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
}

export interface RevenueStats {
  period: string;
  totalBookings: number;
  totalRevenue: Prisma.Decimal;
  averageBookingValue: Prisma.Decimal;
  depositCollected: Prisma.Decimal;
  remainingCollected: Prisma.Decimal;
}

/**
 * Prisma include types for complex queries
 */
export const bookingInclude: Prisma.BookingInclude = {
  guest: true,
  rooms: {
    include: {
      room: true
    }
  },
  payments: true,
  logs: {
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  }
};

export const paymentInclude: Prisma.PaymentInclude = {
  booking: {
    include: {
      guest: true
    }
  }
};

export const guestInclude: Prisma.GuestInclude = {
  bookings: {
    orderBy: {
      checkInDate: 'desc'
    },
    take: 10
  }
};

/**
 * Create types
 */
export type CreateRoomInput = Omit<Room, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateBookingInput = Omit<Booking, 'id' | 'confirmationNumber' | 'createdAt' | 'updatedAt'>;
export type CreateGuestInput = Omit<Guest, 'id' | 'totalBookings' | 'totalSpent' | 'createdAt' | 'updatedAt'>;
export type CreatePaymentInput = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Update types
 */
export type UpdateRoomInput = Partial<Omit<Room, 'id' | 'createdAt' | 'updatedAt'>>;
export type UpdateBookingInput = Partial<Omit<Booking, 'id' | 'confirmationNumber' | 'createdAt' | 'updatedAt'>>;
export type UpdateGuestInput = Partial<Omit<Guest, 'id' | 'totalBookings' | 'totalSpent' | 'createdAt' | 'updatedAt'>>;
export type UpdatePaymentInput = Partial<Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Lapa Casa Hostel specific room configurations
 */
export const ROOM_CONFIGS = {
  MIXTO_12A: {
    id: 'room_mixto_12a',
    name: 'Mixto 12A',
    type: RoomTypeEnum.MIXED,
    capacity: 12,
    isFlexible: false
  },
  MIXTO_12B: {
    id: 'room_mixto_12b',
    name: 'Mixto 12B',
    type: RoomTypeEnum.MIXED,
    capacity: 12,
    isFlexible: false
  },
  MIXTO_7: {
    id: 'room_mixto_7',
    name: 'Mixto 7',
    type: RoomTypeEnum.MIXED,
    capacity: 7,
    isFlexible: false
  },
  FLEXIBLE_7: {
    id: 'room_flexible_7',
    name: 'Flexible 7',
    type: RoomTypeEnum.FEMALE,
    capacity: 7,
    isFlexible: true,
    autoConvertHours: 48
  }
} as const;

/**
 * Transaction isolation levels
 */
export type TransactionIsolationLevel = Prisma.TransactionIsolationLevel;

/**
 * Sort order
 */
export type SortOrder = 'asc' | 'desc';

export default {
  Room,
  Booking,
  Guest,
  Payment,
  BookingLog,
  BookingWithRelations,
  PaymentWithRelations,
  GuestWithRelations
};
