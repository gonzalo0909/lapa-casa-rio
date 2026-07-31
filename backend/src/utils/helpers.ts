// lapa-casa-hostel/backend/src/utils/helpers.ts

/**
 * Calculate Nights Between Dates
 * Calculates number of nights between check-in and check-out
 * 
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights
 */
export const calculateNights = (checkIn: Date, checkOut: Date): number => {
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Calculate Group Discount
 * Returns discount percentage based on bed count
 * 
 * @param bedsCount - Number of beds
 * @returns Discount percentage (0-1)
 */
export const calculateGroupDiscount = (bedsCount: number): number => {
  if (bedsCount >= 26) return 0.20; // 20% for 26+ beds
  if (bedsCount >= 16) return 0.15; // 15% for 16-25 beds
  if (bedsCount >= 7) return 0.10;  // 10% for 7-15 beds
  return 0;                          // No discount < 7 beds
};

/**
 * Determine Season
 * Returns season based on check-in date
 * 
 * @param checkInDate - Check-in date
 * @returns Season type
 */
export const determineSeason = (checkInDate: Date): 'low' | 'medium' | 'high' | 'carnival' => {
  const month = checkInDate.getMonth() + 1; // 1-12
  const day = checkInDate.getDate();

  // Carnival (usually February, specific dates)
  // For simplicity, checking if February 10-20
  if (month === 2 && day >= 10 && day <= 20) {
    return 'carnival';
  }

  // High season: December - March
  if (month === 12 || month <= 3) {
    return 'high';
  }

  // Low season: June - September
  if (month >= 6 && month <= 9) {
    return 'low';
  }

  // Medium season: April-May, October-November
  return 'medium';
};

/**
 * Get Season Multiplier
 * Returns price multiplier for season
 * 
 * @param season - Season type
 * @returns Price multiplier
 */
export const getSeasonMultiplier = (season: 'low' | 'medium' | 'high' | 'carnival'): number => {
  const multipliers = {
    low: 0.80,      // -20%
    medium: 1.00,   // Base price
    high: 1.50,     // +50%
    carnival: 2.00  // +100%
  };

  return multipliers[season];
};

/**
 * Calculate Total Price
 * Calculates total booking price with discounts and season
 * 
 * @param basePrice - Base price per bed per night
 * @param bedsCount - Number of beds
 * @param nights - Number of nights
 * @param checkInDate - Check-in date for season
 * @returns Price breakdown
 */
export const calculateTotalPrice = (
  basePrice: number,
  bedsCount: number,
  nights: number,
  checkInDate: Date
): {
  subtotal: number;
  groupDiscount: number;
  discountAmount: number;
  season: string;
  seasonMultiplier: number;
  totalPrice: number;
} => {
  // Calculate subtotal
  const subtotal = basePrice * bedsCount * nights;

  // Apply group discount
  const groupDiscount = calculateGroupDiscount(bedsCount);
  const priceAfterDiscount = subtotal * (1 - groupDiscount);
  const discountAmount = subtotal - priceAfterDiscount;

  // Apply season multiplier
  const season = determineSeason(checkInDate);
  const seasonMultiplier = getSeasonMultiplier(season);
  const totalPrice = priceAfterDiscount * seasonMultiplier;

  return {
    subtotal,
    groupDiscount,
    discountAmount,
    season,
    seasonMultiplier,
    totalPrice: Math.round(totalPrice * 100) / 100 // Round to 2 decimals
  };
};

/**
 * Calculate Deposit Amount
 * Calculates deposit required (30% or 50% for large groups)
 * 
 * @param totalPrice - Total booking price
 * @param bedsCount - Number of beds
 * @returns Deposit amount and remaining
 */
export const calculateDeposit = (
  totalPrice: number,
  bedsCount: number
): {
  depositAmount: number;
  remainingAmount: number;
  depositPercentage: number;
} => {
  const depositPercentage = bedsCount >= 15 ? 0.50 : 0.30;
  const depositAmount = Math.round(totalPrice * depositPercentage * 100) / 100;
  const remainingAmount = Math.round((totalPrice - depositAmount) * 100) / 100;

  return {
    depositAmount,
    remainingAmount,
    depositPercentage
  };
};

/**
 * Format Currency
 * Formats number as currency string
 * 
 * @param amount - Amount to format
 * @param currency - Currency code (default: BRL)
 * @param locale - Locale for formatting (default: pt-BR)
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'BRL',
  locale: string = 'pt-BR'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount);
};

/**
 * Format Date
 * Formats date to readable string
 * 
 * @param date - Date to format
 * @param locale - Locale for formatting (default: pt-BR)
 * @returns Formatted date string
 */
export const formatDate = (date: Date, locale: string = 'pt-BR'): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

/**
 * Format Date Short
 * Formats date to short format (DD/MM/YYYY)
 * 
 * @param date - Date to format
 * @returns Short date string
 */
export const formatDateShort = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format Phone Number
 * Formats phone number for display
 * 
 * @param phone - Phone number
 * @param countryCode - Country code (default: BR)
 * @returns Formatted phone number
 */
export const formatPhoneNumber = (phone: string, countryCode: string = 'BR'): string => {
  const cleaned = phone.replace(/\D/g, '');

  if (countryCode === 'BR') {
    if (cleaned.length === 11) {
      // Format: (XX) XXXXX-XXXX
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    } else if (cleaned.length === 10) {
      // Format: (XX) XXXX-XXXX
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
  }

  return phone;
};

/**
 * Generate Booking ID
 * Creates unique booking ID
 * 
 * @returns Booking ID (bkg_XXXXXXXXXX)
 */
export const generateBookingId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `bkg_${timestamp}${random}`;
};

/**
 * Generate Payment ID
 * Creates unique payment ID
 * 
 * @returns Payment ID (pay_XXXXXXXXXX)
 */
export const generatePaymentId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `pay_${timestamp}${random}`;
};

/**
 * Parse Date Range
 * Parses date strings to Date objects
 * 
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Parsed dates or null
 */
export const parseDateRange = (
  startDate: string,
  endDate: string
): { checkIn: Date; checkOut: Date } | null => {
  try {
    const checkIn = new Date(startDate);
    const checkOut = new Date(endDate);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return null;
    }

    return { checkIn, checkOut };
  } catch {
    return null;
  }
};

/**
 * Calculate Auto Charge Date
 * Calculates when remaining payment should be auto-charged
 * 
 * @param checkInDate - Check-in date
 * @param daysBeforeCheckIn - Days before check-in (default: 7)
 * @returns Auto charge date
 */
export const calculateAutoChargeDate = (
  checkInDate: Date,
  daysBeforeCheckIn: number = 7
): Date => {
  const autoChargeDate = new Date(checkInDate);
  autoChargeDate.setDate(autoChargeDate.getDate() - daysBeforeCheckIn);
  return autoChargeDate;
};

/**
 * Check Flexible Room Auto-Convert
 * Determines if flexible room should auto-convert to mixed
 * 
 * @param checkInDate - Check-in date
 * @param hoursBeforeConvert - Hours before check-in to convert (default: 48)
 * @returns True if should convert
 */
export const shouldFlexibleRoomConvert = (
  checkInDate: Date,
  hoursBeforeConvert: number = 48
): boolean => {
  const now = new Date();
  const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilCheckIn <= hoursBeforeConvert;
};

/**
 * Get Carnival Dates
 * Returns carnival dates for a given year
 * 
 * @param year - Year to get carnival dates
 * @returns Carnival start and end dates
 */
export const getCarnivalDates = (year: number): { start: Date; end: Date } => {
  // Simplified: Carnival is usually mid-February
  // In production, use proper Easter calculation
  const start = new Date(year, 1, 10); // February 10
  const end = new Date(year, 1, 20);   // February 20
  return { start, end };
};

/**
 * Check Carnival Period
 * Checks if date falls within carnival period
 * 
 * @param date - Date to check
 * @returns True if carnival period
 */
export const isCarnivalPeriod = (date: Date): boolean => {
  const year = date.getFullYear();
  const { start, end } = getCarnivalDates(year);
  return date >= start && date <= end;
};

/**
 * Get Minimum Carnival Nights
 * Returns minimum nights required during carnival
 * 
 * @returns Minimum nights (default: 5)
 */
export const getMinimumCarnivalNights = (): number => {
  return 5;
};

/**
 * Sleep Utility
 * Delays execution for specified milliseconds
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry with Exponential Backoff
 * Retries a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @returns Result of function or throws error
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
};

/**
 * Chunk Array
 * Splits array into chunks of specified size
 * 
 * @param array - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
export const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Deep Clone Object
 * Creates deep clone of object
 * 
 * @param obj - Object to clone
 * @returns Cloned object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Remove Undefined Fields
 * Removes undefined fields from object
 * 
 * @param obj - Object to clean
 * @returns Object without undefined fields
 */
export const removeUndefinedFields = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: any = {};
  
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  
  return result;
};

/**
 * Convert to Title Case
 * Converts string to title case
 * 
 * @param str - String to convert
 * @returns Title case string
 */
export const toTitleCase = (str: string): string => {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Truncate String
 * Truncates string to specified length
 * 
 * @param str - String to truncate
 * @param length - Maximum length
 * @param suffix - Suffix to add (default: ...)
 * @returns Truncated string
 */
export const truncateString = (str: string, length: number, suffix: string = '...'): string => {
  if (str.length <= length) {
    return str;
  }
  return str.substring(0, length - suffix.length) + suffix;
};

/**
 * Calculate Percentage
 * Calculates percentage of total
 * 
 * @param value - Value
 * @param total - Total
 * @returns Percentage (0-100)
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100;
};

/**
 * Is Weekend
 * Checks if date is weekend (Saturday or Sunday)
 * 
 * @param date - Date to check
 * @returns True if weekend
 */
export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
};

/**
 * Get Business Days
 * Calculates business days between two dates
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of business days
 */
export const getBusinessDays = (startDate: Date, endDate: Date): number => {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

/**
 * Generate Random String
 * Generates random alphanumeric string
 * 
 * @param length - String length
 * @returns Random string
 */
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Parse Query String to Object
 * Converts query string to object
 * 
 * @param queryString - Query string
 * @returns Parsed object
 */
export const parseQueryString = (queryString: string): Record<string, string> => {
  const params = new URLSearchParams(queryString);
  const result: Record<string, string> = {};
  
  params.forEach((value, key) => {
    result[key] = value;
  });
  
  return result;
};

/**
 * Build Query String from Object
 * Converts object to query string
 * 
 * @param obj - Object to convert
 * @returns Query string
 */
export const buildQueryString = (obj: Record<string, any>): string => {
  const params = new URLSearchParams();
  
  for (const key in obj) {
    if (obj[key] !== undefined && obj[key] !== null) {
      params.append(key, String(obj[key]));
    }
  }
  
  return params.toString();
};

/**
 * Get Age from Date of Birth
 * Calculates age from birth date
 * 
 * @param birthDate - Date of birth
 * @returns Age in years
 */
export const getAge = (birthDate: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};
