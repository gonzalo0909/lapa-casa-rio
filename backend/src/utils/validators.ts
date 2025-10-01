// lapa-casa-hostel/backend/src/utils/validators.ts

/**
 * Email Validation
 * Validates email format using RFC 5322 standard
 * 
 * @param email - Email address to validate
 * @returns True if valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Phone Number Validation (Brazilian format)
 * Validates Brazilian phone numbers
 * 
 * @param phone - Phone number to validate
 * @returns True if valid
 */
export const isValidBrazilianPhone = (phone: string): boolean => {
  // Remove non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Brazilian phone: 11 digits (with area code)
  // Format: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  return cleaned.length === 10 || cleaned.length === 11;
};

/**
 * International Phone Validation
 * Basic international phone validation
 * 
 * @param phone - Phone number to validate
 * @returns True if valid
 */
export const isValidInternationalPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 8 && cleaned.length <= 15;
};

/**
 * Date Range Validation
 * Validates check-in and check-out dates
 * 
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Validation result
 */
export const validateDateRange = (
  checkIn: Date,
  checkOut: Date
): {
  valid: boolean;
  error?: string;
} => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if dates are valid
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  // Check-in cannot be in the past
  if (checkIn < today) {
    return { valid: false, error: 'Check-in date cannot be in the past' };
  }

  // Check-out must be after check-in
  if (checkOut <= checkIn) {
    return { valid: false, error: 'Check-out must be after check-in' };
  }

  // Maximum stay: 90 days
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  if (nights > 90) {
    return { valid: false, error: 'Maximum stay is 90 nights' };
  }

  return { valid: true };
};

/**
 * Beds Count Validation
 * Validates number of beds requested
 * 
 * @param bedsCount - Number of beds
 * @returns Validation result
 */
export const validateBedsCount = (bedsCount: number): {
  valid: boolean;
  error?: string;
} => {
  if (!Number.isInteger(bedsCount)) {
    return { valid: false, error: 'Beds count must be an integer' };
  }

  if (bedsCount < 1) {
    return { valid: false, error: 'At least 1 bed required' };
  }

  if (bedsCount > 45) {
    return { valid: false, error: 'Maximum 45 beds available' };
  }

  return { valid: true };
};

/**
 * Room ID Validation
 * Validates room ID format
 * 
 * @param roomId - Room ID to validate
 * @returns True if valid
 */
export const isValidRoomId = (roomId: string): boolean => {
  const validRoomIds = [
    'room_mixto_12a',
    'room_mixto_12b',
    'room_mixto_7',
    'room_flexible_7'
  ];

  return validRoomIds.includes(roomId);
};

/**
 * Booking ID Validation
 * Validates booking ID format
 * 
 * @param bookingId - Booking ID to validate
 * @returns True if valid
 */
export const isValidBookingId = (bookingId: string): boolean => {
  // Format: bkg_XXXXXXXXXX (alphanumeric)
  const bookingIdRegex = /^bkg_[a-zA-Z0-9]{10,}$/;
  return bookingIdRegex.test(bookingId);
};

/**
 * Payment ID Validation
 * Validates payment ID format
 * 
 * @param paymentId - Payment ID to validate
 * @returns True if valid
 */
export const isValidPaymentId = (paymentId: string): boolean => {
  // Format: pay_XXXXXXXXXX or pi_XXXXXXXXXX (Stripe) or mp_XXXXXXXXXX (MP)
  const paymentIdRegex = /^(pay|pi|mp)_[a-zA-Z0-9]{10,}$/;
  return paymentIdRegex.test(paymentId);
};

/**
 * Price Validation
 * Validates price amount
 * 
 * @param price - Price to validate
 * @param currency - Currency code
 * @returns Validation result
 */
export const validatePrice = (
  price: number,
  currency: string = 'BRL'
): {
  valid: boolean;
  error?: string;
} => {
  if (typeof price !== 'number' || isNaN(price)) {
    return { valid: false, error: 'Price must be a number' };
  }

  if (price <= 0) {
    return { valid: false, error: 'Price must be positive' };
  }

  // Maximum price: R$ 50,000 (or equivalent)
  const maxPrice = currency === 'BRL' ? 50000 : 10000;
  if (price > maxPrice) {
    return { valid: false, error: `Price exceeds maximum of ${maxPrice} ${currency}` };
  }

  // Check decimal places (2 max)
  if (price.toString().split('.')[1]?.length > 2) {
    return { valid: false, error: 'Price cannot have more than 2 decimal places' };
  }

  return { valid: true };
};

/**
 * Currency Code Validation
 * Validates ISO 4217 currency codes
 * 
 * @param currency - Currency code to validate
 * @returns True if valid
 */
export const isValidCurrency = (currency: string): boolean => {
  const validCurrencies = ['BRL', 'USD', 'EUR', 'GBP', 'ARS'];
  return validCurrencies.includes(currency.toUpperCase());
};

/**
 * Country Code Validation
 * Validates ISO 3166-1 alpha-2 country codes
 * 
 * @param countryCode - Country code to validate
 * @returns True if valid
 */
export const isValidCountryCode = (countryCode: string): boolean => {
  const commonCountries = [
    'BR', 'US', 'GB', 'AR', 'CL', 'UY', 'PY',
    'CO', 'PE', 'MX', 'ES', 'PT', 'FR', 'DE', 'IT'
  ];
  return commonCountries.includes(countryCode.toUpperCase());
};

/**
 * Credit Card Number Validation (Luhn Algorithm)
 * Validates credit card number using Luhn algorithm
 * 
 * @param cardNumber - Credit card number
 * @returns True if valid
 */
export const isValidCreditCard = (cardNumber: string): boolean => {
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  // Check if only digits
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }

  // Check length (13-19 digits)
  if (cleaned.length < 13 || cleaned.length > 19) {
    return false;
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

/**
 * CVV Validation
 * Validates credit card CVV
 * 
 * @param cvv - CVV code
 * @returns True if valid
 */
export const isValidCVV = (cvv: string): boolean => {
  return /^\d{3,4}$/.test(cvv);
};

/**
 * Expiration Date Validation
 * Validates credit card expiration date
 * 
 * @param month - Expiration month (1-12)
 * @param year - Expiration year (full year)
 * @returns True if valid
 */
export const isValidExpirationDate = (month: number, year: number): boolean => {
  if (month < 1 || month > 12) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Year must be current or future
  if (year < currentYear) {
    return false;
  }

  // If current year, month must be current or future
  if (year === currentYear && month < currentMonth) {
    return false;
  }

  // Maximum 20 years in future
  if (year > currentYear + 20) {
    return false;
  }

  return true;
};

/**
 * CPF Validation (Brazilian tax ID)
 * Validates Brazilian CPF number
 * 
 * @param cpf - CPF number
 * @returns True if valid
 */
export const isValidCPF = (cpf: string): boolean => {
  // Remove non-digits
  const cleaned = cpf.replace(/\D/g, '');

  // Check length
  if (cleaned.length !== 11) {
    return false;
  }

  // Check for known invalid CPFs
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return false;
  }

  // Validate check digits
  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(10, 11))) return false;

  return true;
};

/**
 * URL Validation
 * Validates URL format
 * 
 * @param url - URL to validate
 * @returns True if valid
 */
export const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Booking Status Validation
 * Validates booking status
 * 
 * @param status - Booking status
 * @returns True if valid
 */
export const isValidBookingStatus = (status: string): boolean => {
  const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
  return validStatuses.includes(status.toLowerCase());
};

/**
 * Payment Status Validation
 * Validates payment status
 * 
 * @param status - Payment status
 * @returns True if valid
 */
export const isValidPaymentStatus = (status: string): boolean => {
  const validStatuses = [
    'pending',
    'processing',
    'succeeded',
    'failed',
    'refunded',
    'disputed'
  ];
  return validStatuses.includes(status.toLowerCase());
};

/**
 * Room Type Validation
 * Validates room type
 * 
 * @param roomType - Room type
 * @returns True if valid
 */
export const isValidRoomType = (roomType: string): boolean => {
  const validTypes = ['mixed', 'female'];
  return validTypes.includes(roomType.toLowerCase());
};

/**
 * Season Validation
 * Validates season type
 * 
 * @param season - Season type
 * @returns True if valid
 */
export const isValidSeason = (season: string): boolean => {
  const validSeasons = ['low', 'medium', 'high', 'carnival'];
  return validSeasons.includes(season.toLowerCase());
};

/**
 * Discount Validation
 * Validates discount percentage
 * 
 * @param discount - Discount value (0-1)
 * @returns Validation result
 */
export const validateDiscount = (discount: number): {
  valid: boolean;
  error?: string;
} => {
  if (typeof discount !== 'number' || isNaN(discount)) {
    return { valid: false, error: 'Discount must be a number' };
  }

  if (discount < 0 || discount > 1) {
    return { valid: false, error: 'Discount must be between 0 and 1' };
  }

  return { valid: true };
};

/**
 * Sanitize String Input
 * Removes potentially dangerous characters
 * 
 * @param input - Input string
 * @returns Sanitized string
 */
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[<>]/g, '');
};

/**
 * Validate Pagination Parameters
 * Validates page and limit for pagination
 * 
 * @param page - Page number
 * @param limit - Items per page
 * @returns Validation result
 */
export const validatePagination = (
  page: number,
  limit: number
): {
  valid: boolean;
  error?: string;
} => {
  if (!Number.isInteger(page) || page < 1) {
    return { valid: false, error: 'Page must be a positive integer' };
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { valid: false, error: 'Limit must be between 1 and 100' };
  }

  return { valid: true };
};
