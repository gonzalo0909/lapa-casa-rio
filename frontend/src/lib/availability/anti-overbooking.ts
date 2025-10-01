// lapa-casa-hostel/frontend/src/lib/availability/anti-overbooking.ts

/**
 * Anti-Overbooking System
 * 
 * Critical safety mechanisms to prevent double bookings and overbooking.
 * Implements locking, validation, and conflict detection.
 * 
 * @module lib/availability/anti-overbooking
 */

import { datesOverlap } from './availability-checker';

/**
 * Booking lock interface for preventing race conditions
 */
interface BookingLock {
  roomId: string;
  checkIn: string;
  checkOut: string;
  lockedAt: number;
  expiresAt: number;
  lockId: string;
}

/**
 * Conflict detection result
 */
interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    bookingId: string;
    roomId: string;
    checkIn: string;
    checkOut: string;
    bedsCount: number;
  }>;
  message?: string;
}

/**
 * Lock duration in milliseconds (5 minutes)
 */
const LOCK_DURATION_MS = 5 * 60 * 1000;

/**
 * In-memory lock storage (in production, use Redis)
 */
const lockStorage = new Map<string, BookingLock>();

/**
 * Generate lock key for room and date range
 * 
 * @param roomId - Room ID
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Lock key string
 */
function generateLockKey(roomId: string, checkIn: string, checkOut: string): string {
  return `lock:${roomId}:${checkIn}:${checkOut}`;
}

/**
 * Acquire lock for booking
 * 
 * @param roomId - Room ID
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Lock ID if successful, null if locked
 * 
 * @example
 * ```ts
 * const lockId = acquireLock('room_mixto_12a', '2025-01-15', '2025-01-20');
 * if (lockId) {
 *   // Proceed with booking
 *   releaseLock(lockId);
 * }
 * ```
 */
export function acquireLock(
  roomId: string,
  checkIn: string,
  checkOut: string
): string | null {
  const lockKey = generateLockKey(roomId, checkIn, checkOut);
  const existingLock = lockStorage.get(lockKey);

  const now = Date.now();

  if (existingLock && existingLock.expiresAt > now) {
    return null;
  }

  const lockId = `${roomId}_${now}_${Math.random().toString(36).substr(2, 9)}`;

  const lock: BookingLock = {
    roomId,
    checkIn,
    checkOut,
    lockedAt: now,
    expiresAt: now + LOCK_DURATION_MS,
    lockId
  };

  lockStorage.set(lockKey, lock);

  return lockId;
}

/**
 * Release booking lock
 * 
 * @param lockId - Lock ID to release
 * @returns True if released successfully
 * 
 * @example
 * ```ts
 * releaseLock(lockId);
 * ```
 */
export function releaseLock(lockId: string): boolean {
  for (const [key, lock] of lockStorage.entries()) {
    if (lock.lockId === lockId) {
      lockStorage.delete(key);
      return true;
    }
  }
  return false;
}

/**
 * Clean up expired locks
 * 
 * @returns Number of locks cleaned
 */
export function cleanupExpiredLocks(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, lock] of lockStorage.entries()) {
    if (lock.expiresAt <= now) {
      lockStorage.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Detect booking conflicts
 * 
 * @param existingBookings - Array of existing bookings
 * @param newBooking - New booking to check
 * @returns Conflict detection result
 * 
 * @example
 * ```ts
 * const conflicts = detectConflicts(bookings, {
 *   roomId: 'room_mixto_12a',
 *   checkIn: '2025-01-15',
 *   checkOut: '2025-01-20',
 *   bedsCount: 5
 * });
 * 
 * if (conflicts.hasConflict) {
 *   console.error('Booking conflict detected!');
 * }
 * ```
 */
export function detectConflicts(
  existingBookings: Array<{
    id: string;
    roomId: string;
    checkIn: string;
    checkOut: string;
    bedsCount: number;
    status: string;
  }>,
  new
