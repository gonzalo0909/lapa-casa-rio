// lapa-casa-hostel/frontend/src/lib/utils.ts

/**
 * Utility Functions Library
 * 
 * Common utility functions for Lapa Casa Hostel application.
 * Includes string manipulation, date handling, formatting, and class name management.
 * 
 * @module lib/utils
 * @requires clsx
 * @requires tailwind-merge
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper conflict resolution
 * 
 * @param inputs - Class values to merge
 * @returns Merged class string
 * 
 * @example
 * ```ts
 * cn('px-2 py-1', 'px-4') // Returns: 'py-1 px-4'
 * cn('text-red-500', condition && 'text-blue-500') // Conditional classes
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format currency value to BRL
 * 
 * @param value - Numeric value to format
 * @param includeSymbol - Whether to include R$ symbol
 * @returns Formatted currency string
 * 
 * @example
 * ```ts
 * formatCurrency(60.5) // Returns: 'R$ 60,50'
 * formatCurrency(1234.56, false) // Returns: '1.234,56'
 * ```
 */
export function formatCurrency(value: number, includeSymbol: boolean = true): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  return includeSymbol ? formatted : formatted.replace('R$', '').trim();
}

/**
 * Format date to Brazilian format (DD/MM/YYYY)
 * 
 * @param date - Date string or Date object
 * @param format - Output format ('short' | 'long' | 'iso')
 * @returns Formatted date string
 * 
 * @example
 * ```ts
 * formatDate('2025-01-15') // Returns: '15/01/2025'
 * formatDate(new Date(), 'long') // Returns: '15 de janeiro de 2025'
 * formatDate('2025-01-15', 'iso') // Returns: '2025-01-15'
 * ```
 */
export function formatDate(
  date: string | Date,
  format: 'short' | 'long' | 'iso' = 'short'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  if (format === 'iso') {
    return dateObj.toISOString().split('T')[0];
  }

  if (format === 'long') {
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(dateObj);
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(dateObj);
}

/**
 * Calculate number of nights between two dates
 * 
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights
 * 
 * @example
 * ```ts
 * calculateNights('2025-01-15', '2025-01-18') // Returns: 3
 * ```
 */
export function calculateNights(checkIn: string | Date, checkOut: string | Date): number {
  const checkInDate = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const checkOutDate = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;

  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

/**
 * Generate unique ID with optional prefix
 * 
 * @param prefix - Optional prefix for the ID
 * @returns Unique identifier string
 * 
 * @example
 * ```ts
 * generateId() // Returns: 'k3j5h7g9'
 * generateId('booking') // Returns: 'booking_k3j5h7g9'
 * ```
 */
export function generateId(prefix?: string): string {
  const id = Math.random().toString(36).substring(2, 10);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Debounce function execution
 * 
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 * 
 * @example
 * ```ts
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching:', query);
 * }, 300);
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Throttle function execution
 * 
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 * 
 * @example
 * ```ts
 * const throttledScroll = throttle(() => {
 *   console.log('Scrolling');
 * }, 100);
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Sleep/delay function
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 * 
 * @example
 * ```ts
 * await sleep(1000); // Wait 1 second
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Capitalize first letter of string
 * 
 * @param str - String to capitalize
 * @returns Capitalized string
 * 
 * @example
 * ```ts
 * capitalize('hello world') // Returns: 'Hello world'
 * ```
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Truncate string to specified length
 * 
 * @param str - String to truncate
 * @param length - Maximum length
 * @param suffix - Suffix to append (default: '...')
 * @returns Truncated string
 * 
 * @example
 * ```ts
 * truncate('Long text here', 10) // Returns: 'Long te...'
 * ```
 */
export function truncate(str: string, length: number, suffix: string = '...'): string {
  if (!str || str.length <= length) return str;
  return str.substring(0, length).trim() + suffix;
}

/**
 * Parse query string to object
 * 
 * @param queryString - Query string to parse
 * @returns Object with parsed parameters
 * 
 * @example
 * ```ts
 * parseQueryString('?foo=bar&baz=qux') // Returns: { foo: 'bar', baz: 'qux' }
 * ```
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params = new URLSearchParams(queryString);
  const result: Record<string, string> = {};

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

/**
 * Build query string from object
 * 
 * @param params - Object with parameters
 * @returns Query string
 * 
 * @example
 * ```ts
 * buildQueryString({ foo: 'bar', baz: 'qux' }) // Returns: 'foo=bar&baz=qux'
 * ```
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * 
 * @param value - Value to check
 * @returns True if empty
 * 
 * @example
 * ```ts
 * isEmpty(null) // Returns: true
 * isEmpty([]) // Returns: true
 * isEmpty({}) // Returns: true
 * isEmpty('text') // Returns: false
 * ```
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Deep clone object
 * 
 * @param obj - Object to clone
 * @returns Cloned object
 * 
 * @example
 * ```ts
 * const original = { a: 1, b: { c: 2 } };
 * const cloned = deepClone(original);
 * ```
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map((item) => deepClone(item)) as any;
  if (obj instanceof Object) {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Compare two dates (ignoring time)
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 * 
 * @example
 * ```ts
 * compareDates('2025-01-15', '2025-01-20') // Returns: -1
 * ```
 */
export function compareDates(date1: string | Date, date2: string | Date): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  if (d1.getTime() < d2.getTime()) return -1;
  if (d1.getTime() > d2.getTime()) return 1;
  return 0;
}

/**
 * Check if date is in range
 * 
 * @param date - Date to check
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @returns True if date is in range
 * 
 * @example
 * ```ts
 * isDateInRange('2025-01-16', '2025-01-15', '2025-01-20') // Returns: true
 * ```
 */
export function isDateInRange(
  date: string | Date,
  startDate: string | Date,
  endDate: string | Date
): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  d.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return d >= start && d <= end;
}

/**
 * Get array of dates between two dates
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Array of date strings
 * 
 * @example
 * ```ts
 * getDateRange('2025-01-15', '2025-01-17')
 * // Returns: ['2025-01-15', '2025-01-16', '2025-01-17']
 * ```
 */
export function getDateRange(startDate: string | Date, endDate: string | Date): string[] {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const dates: string[] = [];

  const currentDate = new Date(start);
  while (currentDate <= end) {
    dates.push(formatDate(currentDate, 'iso'));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

/**
 * Format phone number to Brazilian format
 * 
 * @param phone - Phone number string
 * @returns Formatted phone number
 * 
 * @example
 * ```ts
 * formatPhone('21987654321') // Returns: '(21) 98765-4321'
 * ```
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}

/**
 * Safely access nested object properties
 * 
 * @param obj - Object to access
 * @param path - Property path (e.g., 'user.address.city')
 * @param defaultValue - Default value if path not found
 * @returns Property value or default
 * 
 * @example
 * ```ts
 * getNestedValue({ user: { name: 'John' } }, 'user.name') // Returns: 'John'
 * getNestedValue({ user: {} }, 'user.age', 0) // Returns: 0
 * ```
 */
export function getNestedValue(obj: any, path: string, defaultValue?: any): any {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = result[key];
  }

  return result !== undefined ? result : defaultValue;
}
