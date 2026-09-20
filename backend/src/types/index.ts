/**
 * Single source of truth for all backend TypeScript types.
 *
 * api.ts   — canonical primitive types (BookingStatus, PaymentStatus, PaymentMethod)
 *            plus API request/response shapes.
 * database.ts — database entity interfaces (Guest, Reservation, Payment, …) which
 *            import their shared primitive types from api.ts.
 *
 * NOTE: api.ts exports a `RoomType` string-union ('mixed'|'female'|'male') that
 * conflicts in name with the `RoomType` interface in database.ts (the DB entity).
 * The string-union concept is covered by `BedGender` in database.ts. To avoid the
 * conflict this barrel re-exports api.ts types individually, leaving out that alias.
 */

// ── API layer ──────────────────────────────────────────────────────────────────
export type {
  ApiResponse,
  PaginationMeta,
  CreateBookingRequest,
  RoomSelection,
  GuestDetails,
  CheckAvailabilityRequest,
  CreatePaymentIntentRequest,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
} from './api';
// ApiErrorCode is an enum — export as a value (which includes the type)
export { ApiErrorCode } from './api';

// ── Database entities ──────────────────────────────────────────────────────────
// (BookingStatus, PaymentStatus, PaymentMethod re-exported from here too via database.ts,
//  but the above api.ts exports are the authoritative source.)
export type {
  BedGender,
  PaymentProvider,
  Guest,
  RoomType,
  Bed,
  Reservation,
  Payment,
  ChannelCode,
  Channel,
} from './database';
