// lapa-casa-hostel/backend/src/integrations/ical/ical-parser.ts

import ical, { VEvent } from 'node-ical';
import { z } from 'zod';

/**
 * @module ICalParser
 * @description Parses iCal feeds from OTAs and extracts booking information
 */

/**
 * @interface ParsedBooking
 * @description Standardized booking data extracted from iCal events
 */
export interface ParsedBooking {
  externalId: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  platform: string;
  status: 'confirmed' | 'blocked' | 'cancelled';
  notes?: string;
  adults?: number;
  children?: number;
  rawEvent?: VEvent;
}

/**
 * @interface ParseResult
 * @description Result of iCal parsing operation
 */
export interface ParseResult {
  success: boolean;
  bookings: ParsedBooking[];
  errors: string[];
  metadata: {
    totalEvents: number;
    parsedBookings: number;
    blockedDates: number;
    skippedEvents: number;
  };
}

/**
 * @constant PLATFORM_PATTERNS
 * @description Regular expressions to identify booking platforms from event data
 */
const PLATFORM_PATTERNS = {
  airbnb: /airbnb|airb&b/i,
  booking: /booking\.com|booking/i,
  expedia: /expedia|hotels\.com/i,
  vrbo: /vrbo|homeaway/i,
  hostelworld: /hostelworld|hostel world/i,
  direct: /direct booking|phone|email|walk-in/i,
};

/**
 * @constant BLOCKED_KEYWORDS
 * @description Keywords that indicate a blocked/unavailable date rather than a booking
 */
const BLOCKED_KEYWORDS = [
  'blocked',
  'unavailable',
  'not available',
  'maintenance',
  'reserved',
  'hold',
  'owner block',
];

/**
 * @class ICalParser
 * @description Parses and validates iCal feeds from various OTA platforms
 */
export class ICalParser {
  private errors: string[] = [];

  /**
   * @method parseFromUrl
   * @description Fetches and parses iCal feed from a URL
   * @param {string} url - iCal feed URL
   * @param {string} [platform] - Known platform (optional)
   * @returns {Promise<ParseResult>} Parsed booking data
   */
  async parseFromUrl(url: string, platform?: string): Promise<ParseResult> {
    this.errors = [];

    try {
      // Validate URL
      this.validateUrl(url);

      // Fetch iCal data
      const icalData = await this.fetchICalData(url);

      // Parse the iCal string
      return this.parseICalString(icalData, platform);
    } catch (error) {
      this.errors.push(this.getErrorMessage(error));
      return this.createErrorResult();
    }
  }

  /**
   * @method parseICalString
   * @description Parses iCal string data
   * @param {string} icalString - iCal data as string
   * @param {string} [platform] - Known platform (optional)
   * @returns {Promise<ParseResult>} Parsed booking data
   */
  async parseICalString(icalString: string, platform?: string): Promise<ParseResult> {
    this.errors = [];
    const bookings: ParsedBooking[] = [];
    let totalEvents = 0;
    let blockedDates = 0;
    let skippedEvents = 0;

    try {
      // Parse iCal data
      const events = await ical.async.parseICS(icalString);

      // Process each event
      for (const eventKey in events) {
        const event = events[eventKey];

        // Only process VEVENT types
        if (event.type !== 'VEVENT') {
          continue;
        }

        totalEvents++;

        try {
          const parsedBooking = this.parseEvent(event as VEvent, platform);

          if (parsedBooking) {
            if (parsedBooking.status === 'blocked') {
              blockedDates++;
            }
            bookings.push(parsedBooking);
          } else {
            skippedEvents++;
          }
        } catch (error) {
          this.errors.push(`Event ${eventKey}: ${this.getErrorMessage(error)}`);
          skippedEvents++;
        }
      }

      return {
        success: true,
        bookings,
        errors: this.errors,
        metadata: {
          totalEvents,
          parsedBookings: bookings.length - blockedDates,
          blockedDates,
          skippedEvents,
        },
      };
    } catch (error) {
      this.errors.push(`Parse error: ${this.getErrorMessage(error)}`);
      return this.createErrorResult();
    }
  }

  /**
   * @method parseEvent
   * @description Parses a single VEVENT into a ParsedBooking
   * @param {VEvent} event - iCal event object
   * @param {string} [knownPlatform] - Known platform (optional)
   * @returns {ParsedBooking | null} Parsed booking or null if invalid
   */
  private parseEvent(event: VEvent, knownPlatform?: string): ParsedBooking | null {
    // Extract dates
    const checkIn = this.extractDate(event.start);
    const checkOut = this.extractDate(event.end);

    if (!checkIn || !checkOut) {
      throw new Error('Missing or invalid dates');
    }

    // Validate date range
    if (checkOut <= checkIn) {
      throw new Error('Check-out must be after check-in');
    }

    // Extract summary and description
    const summary = String(event.summary || '').trim();
    const description = String(event.description || '').trim();
    const uid = String(event.uid || '');

    if (!summary && !description) {
      throw new Error('Event has no summary or description');
    }

    // Determine if this is a blocked date
    const isBlocked = this.isBlockedEvent(summary, description);

    // Extract platform
    const platform = knownPlatform || this.detectPlatform(summary, description, uid);

    // Extract guest name
    const guestName = this.extractGuestName(summary, description, isBlocked);

    // Extract guest counts
    const { adults, children } = this.extractGuestCounts(description);

    // Generate external ID
    const externalId = this.generateExternalId(uid, checkIn, platform);

    // Extract notes
    const notes = this.extractNotes(description);

    return {
      externalId,
      guestName,
      checkIn,
      checkOut,
      platform,
      status: isBlocked ? 'blocked' : 'confirmed',
      notes,
      adults,
      children,
      rawEvent: event,
    };
  }

  /**
   * @method validateUrl
   * @description Validates iCal URL format
   * @param {string} url - URL to validate
   * @throws {Error} If URL is invalid
   */
  private validateUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);

      // Must be HTTP or HTTPS
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol');
      }

      // Basic security check - avoid localhost/internal IPs
      const hostname = parsedUrl.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
      ) {
        throw new Error('Cannot fetch from internal/local addresses');
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }

  /**
   * @method fetchICalData
   * @description Fetches iCal data from URL with timeout and error handling
   * @param {string} url - iCal feed URL
   * @returns {Promise<string>} iCal data as string
   */
  private async fetchICalData(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Lapa-Casa-Hostel/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('text/calendar') && !contentType.includes('text/plain')) {
        console.warn(`Unexpected content-type: ${contentType}`);
      }

      const data = await response.text();

      if (!data || data.length === 0) {
        throw new Error('Empty response from server');
      }

      // Basic validation - should start with BEGIN:VCALENDAR
      if (!data.trim().startsWith('BEGIN:VCALENDAR')) {
        throw new Error('Invalid iCal format - missing VCALENDAR header');
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - server took too long to respond');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * @method extractDate
   * @description Extracts and validates date from various formats
   * @param {any} dateValue - Date value from event
   * @returns {Date | null} Parsed date or null
   */
  private extractDate(dateValue: any): Date | null {
    if (!dateValue) return null;

    try {
      // Handle Date objects
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? null : dateValue;
      }

      // Handle string dates
      if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
      }

      // Handle timestamp numbers
      if (typeof dateValue === 'number') {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * @method isBlockedEvent
   * @description Determines if an event represents a blocked date
   * @param {string} summary - Event summary
   * @param {string} description - Event description
   * @returns {boolean} True if event is a blocked date
   */
  private isBlockedEvent(summary: string, description: string): boolean {
    const combined = `${summary} ${description}`.toLowerCase();

    return BLOCKED_KEYWORDS.some((keyword) => combined.includes(keyword));
  }

  /**
   * @method detectPlatform
   * @description Attempts to detect booking platform from event data
   * @param {string} summary - Event summary
   * @param {string} description - Event description
   * @param {string} uid - Event UID
   * @returns {string} Detected platform or 'unknown'
   */
  private detectPlatform(summary: string, description: string, uid: string): string {
    const combined = `${summary} ${description} ${uid}`.toLowerCase();

    for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
      if (pattern.test(combined)) {
        return platform;
      }
    }

    return 'unknown';
  }

  /**
   * @method extractGuestName
   * @description Extracts guest name from event data
   * @param {string} summary - Event summary
   * @param {string} description - Event description
   * @param {boolean} isBlocked - Whether this is a blocked date
   * @returns {string} Guest name or placeholder
   */
  private extractGuestName(summary: string, description: string, isBlocked: boolean): string {
    if (isBlocked) {
      return 'Blocked';
    }

    // Try to extract from summary first
    let name = summary.trim();

    // Remove common prefixes
    name = name.replace(/^(reserved|booking|reservation)[\s:-]*/i, '');

    // Extract name from patterns like "John Doe (Airbnb)"
    const nameMatch = name.match(/^([^(]+)/);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    // If name is too short or generic, try description
    if (name.length < 2 || /^(guest|blocked|reserved)$/i.test(name)) {
      const descMatch = description.match(/guest[:\s]+([^\n]+)/i);
      if (descMatch) {
        name = descMatch[1].trim();
      }
    }

    // Fallback
    if (!name || name.length < 2) {
      return 'Guest';
    }

    // Sanitize and limit length
    return name.substring(0, 100).trim();
  }

  /**
   * @method extractGuestCounts
   * @description Extracts adult and child counts from description
   * @param {string} description - Event description
   * @returns {object} Guest counts
   */
  private extractGuestCounts(description: string): { adults?: number; children?: number } {
    const result: { adults?: number; children?: number } = {};

    // Look for patterns like "2 adults", "1 child", "3 guests"
    const adultsMatch = description.match(/(\d+)\s*(adults?|guests?)/i);
    if (adultsMatch) {
      result.adults = parseInt(adultsMatch[1], 10);
    }

    const childrenMatch = description.match(/(\d+)\s*(children?|kids?)/i);
    if (childrenMatch) {
      result.children = parseInt(childrenMatch[1], 10);
    }

    return result;
  }

  /**
   * @method extractNotes
   * @description Extracts relevant notes from description
   * @param {string} description - Event description
   * @returns {string | undefined} Notes or undefined
   */
  private extractNotes(description: string): string | undefined {
    if (!description || description.length === 0) {
      return undefined;
    }

    // Clean up description
    let notes = description
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Limit length
    if (notes.length > 500) {
      notes = notes.substring(0, 497) + '...';
    }

    return notes.length > 0 ? notes : undefined;
  }

  /**
   * @method generateExternalId
   * @description Generates a unique external ID for the booking
   * @param {string} uid - Event UID
   * @param {Date} checkIn - Check-in date
   * @param {string} platform - Platform name
   * @returns {string} External ID
   */
  private generateExternalId(uid: string, checkIn: Date, platform: string): string {
    // Use UID if available and valid
    if (uid && uid.length > 5) {
      return `${platform}_${uid}`;
    }

    // Generate from date and platform
    const timestamp = checkIn.getTime();
    const random = Math.random().toString(36).substring(2, 8);
    return `${platform}_${timestamp}_${random}`;
  }

  /**
   * @method getErrorMessage
   * @description Safely extracts error message
   * @param {unknown} error - Error object
   * @returns {string} Error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * @method createErrorResult
   * @description Creates a ParseResult for error cases
   * @returns {ParseResult} Error result
   */
  private createErrorResult(): ParseResult {
    return {
      success: false,
      bookings: [],
      errors: this.errors,
      metadata: {
        totalEvents: 0,
        parsedBookings: 0,
        blockedDates: 0,
        skippedEvents: 0,
      },
    };
  }

  /**
   * @method validateBooking
   * @description Validates parsed booking data
   * @param {ParsedBooking} booking - Booking to validate
   * @returns {boolean} True if valid
   */
  validateBooking(booking: ParsedBooking): boolean {
    try {
      // Validate required fields
      if (!booking.externalId || booking.externalId.length === 0) {
        return false;
      }

      if (!booking.guestName || booking.guestName.length === 0) {
        return false;
      }

      if (!booking.checkIn || !booking.checkOut) {
        return false;
      }

      if (!(booking.checkIn instanceof Date) || isNaN(booking.checkIn.getTime())) {
        return false;
      }

      if (!(booking.checkOut instanceof Date) || isNaN(booking.checkOut.getTime())) {
        return false;
      }

      if (booking.checkOut <= booking.checkIn) {
        return false;
      }

      // Validate status
      if (!['confirmed', 'blocked', 'cancelled'].includes(booking.status)) {
        return false;
      }

      // Validate guest counts if provided
      if (booking.adults !== undefined && (booking.adults < 0 || booking.adults > 50)) {
        return false;
      }

      if (booking.children !== undefined && (booking.children < 0 || booking.children > 50)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * @function createParser
 * @description Factory function to create a new ICalParser instance
 * @returns {ICalParser} New parser instance
 */
export function createParser(): ICalParser {
  return new ICalParser();
}

// ✅ Archivo 2/10 completado
