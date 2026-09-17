// lapa-casa-hostel/frontend/src/lib/pricing.ts

/**
 * Date validation for the booking flow.
 *
 * Real pricing (base price, group discount, season multiplier) is
 * calculated exclusively by the backend (POST /availability/quote,
 * see hooks/use-availability.ts and pricing-calculator.tsx) — this
 * file only validates dates client-side before that call is made.
 *
 * @module lib/pricing
 */

/**
 * Season type
 */
type SeasonType = 'high' | 'medium' | 'low' | 'carnival';

/**
 * Carnival minimum stay requirement
 */
export const CARNIVAL_MIN_NIGHTS = 5;

/**
 * Determine season type for a given date
 *
 * @param date - Date to check
 * @returns Season type
 */
export function getSeason(date: string | Date): SeasonType {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = d.getMonth() + 1; // 1-12

  // Check if it's carnival period (February, typically)
  if (month === 2) {
    const day = d.getDate();
    // Carnival usually occurs between Feb 3-25
    if (day >= 3 && day <= 25) {
      return 'carnival';
    }
  }

  // High season: December-March
  if (month === 12 || month <= 3) {
    return 'high';
  }

  // Low season: June-September
  if (month >= 6 && month <= 9) {
    return 'low';
  }

  // Medium season: April-May, October-November
  return 'medium';
}

/**
 * Calculate number of nights between dates
 *
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights
 */
export function calculateNights(checkIn: string | Date, checkOut: string | Date): number {
  const start = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const end = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;

  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

/**
 * Validate carnival booking requirements
 *
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Validation result
 */
export function validateCarnivalBooking(
  checkIn: string | Date,
  checkOut: string | Date
): { valid: boolean; message?: string } {
  const season = getSeason(checkIn);

  if (season !== 'carnival') {
    return { valid: true };
  }

  const nights = calculateNights(checkIn, checkOut);

  if (nights < CARNIVAL_MIN_NIGHTS) {
    return {
      valid: false,
      message: `Carnival bookings require a minimum of ${CARNIVAL_MIN_NIGHTS} nights`
    };
  }

  return { valid: true };
}

/**
 * Validate a booking's date range: check-in can't be in the past,
 * check-out must be after check-in, and carnival minimum-stay rules apply.
 *
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Validation result with an error message when invalid
 */
export function validateBookingDates(
  checkIn: string | Date,
  checkOut: string | Date
): { isValid: boolean; error?: string } {
  const start = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const end = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (start < today) {
    return { isValid: false, error: 'Check-in date cannot be in the past' };
  }
  if (end <= start) {
    return { isValid: false, error: 'Check-out date must be after check-in date' };
  }

  const carnival = validateCarnivalBooking(start, end);
  if (!carnival.valid) {
    return { isValid: false, error: carnival.message };
  }

  return { isValid: true };
}
