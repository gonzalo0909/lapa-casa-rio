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
  async
