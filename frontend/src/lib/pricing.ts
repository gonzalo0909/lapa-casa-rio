// lapa-casa-hostel/frontend/src/lib/pricing.ts

/**
 * Pricing Calculation Library
 * 
 * Core pricing logic for Lapa Casa Hostel.
 * Handles group discounts, seasonal pricing, and deposit calculations.
 * 
 * @module lib/pricing
 */

/**
 * Room configuration interface
 */
interface Room {
  id: string;
  name: string;
  capacity: number;
  basePrice: number;
  type: 'mixed' | 'female';
  isFlexible: boolean;
}

/**
 * Pricing calculation parameters
 */
interface PricingParams {
  checkIn: string | Date;
  checkOut: string | Date;
  totalBeds: number;
  rooms: Room[];
}

/**
 * Pricing breakdown result
 */
interface PricingResult {
  basePrice: number;
  groupDiscount: number;
  groupDiscountPercentage: number;
  seasonMultiplier: number;
  seasonMultiplierValue: number;
  subtotal: number;
  deposit: number;
  remaining: number;
  total: number;
  pricePerBed: number;
  pricePerNight: number;
  nights: number;
  savings: number;
}

/**
 * Season type
 */
type SeasonType = 'high' | 'medium' | 'low' | 'carnival';

/**
 * Base price per bed per night (BRL)
 */
export const BASE_PRICE_PER_BED = 60.0;

/**
 * Group discount tiers
 * Applied based on total number of beds reserved
 */
export const GROUP_DISCOUNTS = {
  TIER_1: { minBeds: 7, discount: 0.10 },   // 10% for 7-15 beds
  TIER_2: { minBeds: 16, discount: 0.15 },  // 15% for 16-25 beds
  TIER_3: { minBeds: 26, discount: 0.20 }   // 20% for 26+ beds
} as const;

/**
 * Seasonal pricing multipliers
 */
export const SEASON_MULTIPLIERS = {
  high: 1.50,      // December-March (+50%)
  medium: 1.00,    // April-May, October-November (base)
  low: 0.80,       // June-September (-20%)
  carnival: 2.00   // Carnival week (+100%)
} as const;

/**
 * Deposit rules
 */
export const DEPOSIT_RULES = {
  standard: 0.30,      // 30% deposit for standard bookings
  largeGroup: 0.50,    // 50% deposit for 15+ people
  autoChargeDate: 7,   // Days before check-in for auto-charge
  retryAttempts: 3     // Payment retry attempts
} as const;

/**
 * Carnival minimum stay requirement
 */
export const CARNIVAL_MIN_NIGHTS = 5;

/**
 * Calculate group discount based on total beds
 * 
 * @param totalBeds - Total number of beds reserved
 * @returns Discount percentage (0-1)
 * 
 * @example
 * ```ts
 * calculateGroupDiscount(7)  // Returns: 0.10 (10%)
 * calculateGroupDiscount(20) // Returns: 0.15 (15%)
 * calculateGroupDiscount(30) // Returns: 0.20 (20%)
 * ```
 */
export function calculateGroupDiscount(totalBeds: number): number {
  if (totalBeds >= GROUP_DISCOUNTS.TIER_3.minBeds) {
    return GROUP_DISCOUNTS.TIER_3.discount;
  }
  if (totalBeds >= GROUP_DISCOUNTS.TIER_2.minBeds) {
    return GROUP_DISCOUNTS.TIER_2.discount;
  }
  if (totalBeds >= GROUP_DISCOUNTS.TIER_1.minBeds) {
    return GROUP_DISCOUNTS.TIER_1.discount;
  }
  return 0;
}

/**
 * Determine season type for a given date
 * 
 * @param date - Date to check
 * @returns Season type
 * 
 * @example
 * ```ts
 * getSeason(new Date('2025-01-15')) // Returns: 'high'
 * getSeason(new Date('2025-07-20')) // Returns: 'low'
 * ```
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
 * Get season multiplier for a date
 * 
 * @param date - Date to check
 * @returns Multiplier value
 * 
 * @example
 * ```ts
 * getSeasonMultiplier(new Date('2025-01-15')) // Returns: 1.50
 * ```
 */
export function getSeasonMultiplier(date: string | Date): number {
  const season = getSeason(date);
  return SEASON_MULTIPLIERS[season];
}

/**
 * Calculate average season multiplier for a date range
 * 
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Average multiplier
 * 
 * @example
 * ```ts
 * getAverageSeasonMultiplier('2025-01-15', '2025-01-20')
 * ```
 */
export function getAverageSeasonMultiplier(
  checkIn: string | Date,
  checkOut: string | Date
): number {
  const start = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const end = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;

  const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  if (nights <= 0) return 1.0;

  let totalMultiplier = 0;
  const currentDate = new Date(start);

  for (let i = 0; i < nights; i++) {
    totalMultiplier += getSeasonMultiplier(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return totalMultiplier / nights;
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
 * Calculate deposit amount based on booking size
 * 
 * @param totalAmount - Total booking amount
 * @param totalBeds - Total number of beds
 * @returns Deposit amount
 * 
 * @example
 * ```ts
 * calculateDeposit(1000, 10) // Returns: 300 (30%)
 * calculateDeposit(2000, 20) // Returns: 1000 (50%)
 * ```
 */
export function calculateDeposit(totalAmount: number, totalBeds: number): number {
  const depositPercentage = totalBeds >= 15 
    ? DEPOSIT_RULES.largeGroup 
    : DEPOSIT_RULES.standard;

  return Math.round(totalAmount * depositPercentage * 100) / 100;
}

/**
 * Calculate complete pricing breakdown
 * 
 * @param params - Pricing calculation parameters
 * @returns Complete pricing breakdown
 * 
 * @example
 * ```ts
 * const pricing = calculatePricing({
 *   checkIn: '2025-01-15',
 *   checkOut: '2025-01-20',
 *   totalBeds: 12,
 *   rooms: [...]
 * });
 * ```
 */
export function calculatePricing(params: PricingParams): PricingResult {
  const { checkIn, checkOut, totalBeds } = params;

  // Calculate nights
  const nights = calculateNights(checkIn, checkOut);

  if (nights <= 0) {
    throw new Error('Invalid date range: check-out must be after check-in');
  }

  // Calculate base price (beds × nights × base price)
  const basePrice = totalBeds * nights * BASE_PRICE_PER_BED;

  // Calculate group discount
  const groupDiscountPercentage = calculateGroupDiscount(totalBeds);
  const groupDiscount = basePrice * groupDiscountPercentage;

  // Calculate price after group discount
  const priceAfterDiscount = basePrice - groupDiscount;

  // Calculate average season multiplier
  const seasonMultiplier = getAverageSeasonMultiplier(checkIn, checkOut);

  // Calculate seasonal adjustment
  const seasonMultiplierValue = priceAfterDiscount * (seasonMultiplier - 1);

  // Calculate subtotal (price after discount × season multiplier)
  const subtotal = priceAfterDiscount * seasonMultiplier;

  // Calculate total (same as subtotal, no additional taxes)
  const total = subtotal;

  // Calculate deposit and remaining
  const deposit = calculateDeposit(total, totalBeds);
  const remaining = total - deposit;

  // Calculate per-bed and per-night prices
  const pricePerBed = total / totalBeds;
  const pricePerNight = total / nights;

  // Calculate total savings
  const originalPrice = basePrice * seasonMultiplier;
  const savings = originalPrice - total;

  return {
    basePrice: Math.round(basePrice * 100) / 100,
    groupDiscount: Math.round(groupDiscount * 100) / 100,
    groupDiscountPercentage,
    seasonMultiplier,
    seasonMultiplierValue: Math.round(seasonMultiplierValue * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    deposit: Math.round(deposit * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    total: Math.round(total * 100) / 100,
    pricePerBed: Math.round(pricePerBed * 100) / 100,
    pricePerNight: Math.round(pricePerNight * 100) / 100,
    nights,
    savings: Math.round(savings * 100) / 100
  };
}

/**
 * Format pricing breakdown for display
 * 
 * @param pricing - Pricing result
 * @returns Formatted pricing strings
 */
export function formatPricingBreakdown(pricing: PricingResult): {
  basePrice: string;
  groupDiscount: string;
  seasonAdjustment: string;
  subtotal: string;
  deposit: string;
  remaining: string;
  total: string;
  savings: string;
} {
  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return {
    basePrice: formatBRL(pricing.basePrice),
    groupDiscount: formatBRL(pricing.groupDiscount),
    seasonAdjustment: formatBRL(pricing.seasonMultiplierValue),
    subtotal: formatBRL(pricing.subtotal),
    deposit: formatBRL(pricing.deposit),
    remaining: formatBRL(pricing.remaining),
    total: formatBRL(pricing.total),
    savings: formatBRL(pricing.savings)
  };
}

/**
 * Get group discount tier information
 * 
 * @param totalBeds - Total number of beds
 * @returns Discount tier info
 */
export function getDiscountTierInfo(totalBeds: number): {
  currentTier: number;
  currentDiscount: number;
  nextTier?: { beds: number; discount: number };
  bedsUntilNextTier?: number;
} {
  const currentDiscount = calculateGroupDiscount(totalBeds);
  let currentTier = 0;
  let nextTier: { beds: number; discount: number } | undefined;
  let bedsUntilNextTier: number | undefined;

  if (totalBeds >= GROUP_DISCOUNTS.TIER_3.minBeds) {
    currentTier = 3;
  } else if (totalBeds >= GROUP_DISCOUNTS.TIER_2.minBeds) {
    currentTier = 2;
    nextTier = {
      beds: GROUP_DISCOUNTS.TIER_3.minBeds,
      discount: GROUP_DISCOUNTS.TIER_3.discount
    };
    bedsUntilNextTier = GROUP_DISCOUNTS.TIER_3.minBeds - totalBeds;
  } else if (totalBeds >= GROUP_DISCOUNTS.TIER_1.minBeds) {
    currentTier = 1;
    nextTier = {
      beds: GROUP_DISCOUNTS.TIER_2.minBeds,
      discount: GROUP_DISCOUNTS.TIER_2.discount
    };
    bedsUntilNextTier = GROUP_DISCOUNTS.TIER_2.minBeds - totalBeds;
  } else {
    nextTier = {
      beds: GROUP_DISCOUNTS.TIER_1.minBeds,
      discount: GROUP_DISCOUNTS.TIER_1.discount
    };
    bedsUntilNextTier = GROUP_DISCOUNTS.TIER_1.minBeds - totalBeds;
  }

  return {
    currentTier,
    currentDiscount,
    nextTier,
    bedsUntilNextTier
  };
}
