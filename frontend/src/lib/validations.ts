// lapa-casa-hostel/frontend/src/lib/validations.ts

/**
 * Validation Functions Library
 * 
 * Input validation utilities for Lapa Casa Hostel booking system.
 * Includes email, phone, date, and form validation functions.
 * 
 * @module lib/validations
 */

/**
 * Validation result interface
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Email validation regex (RFC 5322 compliant)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Brazilian phone regex (mobile and landline)
 */
const PHONE_REGEX_BR = /^(?:\+?55\s?)?(?:\(?[1-9]{2}\)?\s?)?(?:9\s?)?[0-9]{4}-?[0-9]{4}$/;

/**
 * CPF validation regex
 */
const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

/**
 * Credit card number regex (basic format)
 */
const CREDIT_CARD_REGEX = /^[0-9]{13,19}$/;

/**
 * Validate email address
 * 
 * @param email - Email address to validate
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateEmail('test@example.com') // Returns: { valid: true }
 * validateEmail('invalid-email') // Returns: { valid: false, error: 'Invalid email format' }
 * ```
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Email is required' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validate Brazilian phone number
 * 
 * @param phone - Phone number to validate
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validatePhone('(21) 98765-4321') // Returns: { valid: true }
 * validatePhone('123') // Returns: { valid: false, error: 'Invalid phone format' }
 * ```
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }

  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length < 10 || cleaned.length > 13) {
    return { valid: false, error: 'Invalid phone number length' };
  }

  if (!PHONE_REGEX_BR.test(phone)) {
    return { valid: false, error: 'Invalid phone format. Use: (XX) XXXXX-XXXX' };
  }

  return { valid: true };
}

/**
 * Validate name (minimum 2 characters, only letters and spaces)
 * 
 * @param name - Name to validate
 * @param fieldName - Field name for error message
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateName('John Doe') // Returns: { valid: true }
 * validateName('J') // Returns: { valid: false, error: 'Name must be at least 2 characters' }
 * ```
 */
export function validateName(name: string, fieldName: string = 'Name'): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: `${fieldName} is required` };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: `${fieldName} must be at least 2 characters` };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: `${fieldName} is too long` };
  }

  if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(trimmed)) {
    return { valid: false, error: `${fieldName} contains invalid characters` };
  }

  return { valid: true };
}

/**
 * Validate date string (YYYY-MM-DD format)
 * 
 * @param dateString - Date string to validate
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateDate('2025-01-15') // Returns: { valid: true }
 * validateDate('2025-13-01') // Returns: { valid: false, error: 'Invalid date' }
 * ```
 */
export function validateDate(dateString: string): ValidationResult {
  if (!dateString || typeof dateString !== 'string') {
    return { valid: false, error: 'Date is required' };
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return { valid: false, error: 'Invalid date format. Use: YYYY-MM-DD' };
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }

  // Check if date components match (prevents dates like 2025-02-30)
  const [year, month, day] = dateString.split('-').map(Number);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return { valid: false, error: 'Invalid date' };
  }

  return { valid: true };
}

/**
 * Validate date range (check-in and check-out)
 * 
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param minNights - Minimum nights required
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateDateRange('2025-01-15', '2025-01-20') // Returns: { valid: true }
 * validateDateRange('2025-01-20', '2025-01-15') // Returns: { valid: false, error: '...' }
 * ```
 */
export function validateDateRange(
  checkIn: string,
  checkOut: string,
  minNights: number = 1
): ValidationResult {
  const checkInValidation = validateDate(checkIn);
  if (!checkInValidation.valid) {
    return { valid: false, error: `Check-in: ${checkInValidation.error}` };
  }

  const checkOutValidation = validateDate(checkOut);
  if (!checkOutValidation.valid) {
    return { valid: false, error: `Check-out: ${checkOutValidation.error}` };
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (checkOutDate <= checkInDate) {
    return { valid: false, error: 'Check-out must be after check-in' };
  }

  const nights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (nights < minNights) {
    return {
      valid: false,
      error: `Minimum stay is ${minNights} night${minNights > 1 ? 's' : ''}`
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (checkInDate < today) {
    return { valid: false, error: 'Check-in date cannot be in the past' };
  }

  return { valid: true };
}

/**
 * Validate CPF (Brazilian tax ID)
 * 
 * @param cpf - CPF string
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateCPF('123.456.789-09') // Returns: { valid: true/false }
 * ```
 */
export function validateCPF(cpf: string): ValidationResult {
  if (!cpf || typeof cpf !== 'string') {
    return { valid: false, error: 'CPF is required' };
  }

  const cleaned = cpf.replace(/\D/g, '');

  if (cleaned.length !== 11) {
    return { valid: false, error: 'CPF must have 11 digits' };
  }

  // Check for known invalid CPFs (all same digit)
  if (/^(\d)\1{10}$/.test(cleaned)) {
    return { valid: false, error: 'Invalid CPF' };
  }

  // Validate check digits
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;

  if (digit !== parseInt(cleaned.charAt(9))) {
    return { valid: false, error: 'Invalid CPF' };
  }

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;

  if (digit !== parseInt(cleaned.charAt(10))) {
    return { valid: false, error: 'Invalid CPF' };
  }

  return { valid: true };
}

/**
 * Validate credit card number (Luhn algorithm)
 * 
 * @param cardNumber - Credit card number
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateCreditCard('4111111111111111') // Returns: { valid: true }
 * ```
 */
export function validateCreditCard(cardNumber: string): ValidationResult {
  if (!cardNumber || typeof cardNumber !== 'string') {
    return { valid: false, error: 'Card number is required' };
  }

  const cleaned = cardNumber.replace(/\D/g, '');

  if (!CREDIT_CARD_REGEX.test(cleaned)) {
    return { valid: false, error: 'Invalid card number format' };
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned.charAt(i));

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    return { valid: false, error: 'Invalid card number' };
  }

  return { valid: true };
}

/**
 * Validate CVV code
 * 
 * @param cvv - CVV code
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateCVV('123') // Returns: { valid: true }
 * validateCVV('12') // Returns: { valid: false }
 * ```
 */
export function validateCVV(cvv: string): ValidationResult {
  if (!cvv || typeof cvv !== 'string') {
    return { valid: false, error: 'CVV is required' };
  }

  const cleaned = cvv.replace(/\D/g, '');

  if (cleaned.length < 3 || cleaned.length > 4) {
    return { valid: false, error: 'CVV must be 3 or 4 digits' };
  }

  return { valid: true };
}

/**
 * Validate number of guests/beds
 * 
 * @param beds - Number of beds
 * @param min - Minimum beds
 * @param max - Maximum beds
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateBeds(10, 1, 45) // Returns: { valid: true }
 * validateBeds(50, 1, 45) // Returns: { valid: false, error: '...' }
 * ```
 */
export function validateBeds(
  beds: number,
  min: number = 1,
  max: number = 45
): ValidationResult {
  if (typeof beds !== 'number' || isNaN(beds)) {
    return { valid: false, error: 'Number of beds must be a valid number' };
  }

  if (beds < min) {
    return { valid: false, error: `Minimum ${min} bed${min > 1 ? 's' : ''}` };
  }

  if (beds > max) {
    return { valid: false, error: `Maximum ${max} beds available` };
  }

  if (!Number.isInteger(beds)) {
    return { valid: false, error: 'Number of beds must be a whole number' };
  }

  return { valid: true };
}

/**
 * Validate password strength
 * 
 * @param password - Password to validate
 * @param minLength - Minimum length requirement
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validatePassword('MyP@ssw0rd') // Returns: { valid: true }
 * validatePassword('weak') // Returns: { valid: false, error: '...' }
 * ```
 */
export function validatePassword(password: string, minLength: number = 8): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < minLength) {
    return { valid: false, error: `Password must be at least ${minLength} characters` };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  return { valid: true };
}

/**
 * Validate booking form data
 * 
 * @param data - Booking form data
 * @returns Validation result with field-specific errors
 * 
 * @example
 * ```ts
 * validateBookingForm({
 *   guestName: 'John Doe',
 *   guestEmail: 'john@example.com',
 *   checkIn: '2025-01-15',
 *   checkOut: '2025-01-20',
 *   beds: 10
 * })
 * ```
 */
export function validateBookingForm(data: {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn?: string;
  checkOut?: string;
  beds?: number;
}): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (data.guestName) {
    const nameValidation = validateName(data.guestName, 'Guest name');
    if (!nameValidation.valid) {
      errors.guestName = nameValidation.error || 'Invalid name';
    }
  } else {
    errors.guestName = 'Guest name is required';
  }

  if (data.guestEmail) {
    const emailValidation = validateEmail(data.guestEmail);
    if (!emailValidation.valid) {
      errors.guestEmail = emailValidation.error || 'Invalid email';
    }
  } else {
    errors.guestEmail = 'Email is required';
  }

  if (data.guestPhone) {
    const phoneValidation = validatePhone(data.guestPhone);
    if (!phoneValidation.valid) {
      errors.guestPhone = phoneValidation.error || 'Invalid phone';
    }
  } else {
    errors.guestPhone = 'Phone number is required';
  }

  if (data.checkIn && data.checkOut) {
    const dateRangeValidation = validateDateRange(data.checkIn, data.checkOut);
    if (!dateRangeValidation.valid) {
      errors.dates = dateRangeValidation.error || 'Invalid date range';
    }
  } else {
    if (!data.checkIn) errors.checkIn = 'Check-in date is required';
    if (!data.checkOut) errors.checkOut = 'Check-out date is required';
  }

  if (data.beds !== undefined) {
    const bedsValidation = validateBeds(data.beds);
    if (!bedsValidation.valid) {
      errors.beds = bedsValidation.error || 'Invalid number of beds';
    }
  } else {
    errors.beds = 'Number of beds is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Sanitize string input (remove HTML tags and trim)
 * 
 * @param input - String to sanitize
 * @returns Sanitized string
 * 
 * @example
 * ```ts
 * sanitizeInput('<script>alert("xss")</script>Hello') // Returns: 'Hello'
 * ```
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Validate URL format
 * 
 * @param url - URL to validate
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateURL('https://example.com') // Returns: { valid: true }
 * validateURL('not-a-url') // Returns: { valid: false }
 * ```
 */
export function validateURL(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate postal code (Brazilian CEP format)
 * 
 * @param cep - CEP string
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateCEP('20241-120') // Returns: { valid: true }
 * validateCEP('12345') // Returns: { valid: false }
 * ```
 */
export function validateCEP(cep: string): ValidationResult {
  if (!cep || typeof cep !== 'string') {
    return { valid: false, error: 'CEP is required' };
  }

  const cleaned = cep.replace(/\D/g, '');

  if (cleaned.length !== 8) {
    return { valid: false, error: 'CEP must have 8 digits' };
  }

  return { valid: true };
}
