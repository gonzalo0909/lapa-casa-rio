// lapa-casa-hostel/backend/src/integrations/ical/ical-generator.ts

import ical, { ICalCalendar, ICalEventData } from 'ical-generator';
import { PrismaClient } from '@prisma/client';

/**
 * @module ICalGenerator
 * @description Generates iCal feeds for rooms to share with OTAs
 */

const prisma = new PrismaClient();

/**
 * @interface GeneratorOptions
 * @description Options for iCal generation
 */
export interface GeneratorOptions {
  includeBlocked?: boolean;
  includePending?: boolean;
  futureMonths?: number;
  pastMonths?: number;
  timezone?: string;
}

/**
 * @interface BookingEvent
 * @description Booking data for iCal event generation
 */
interface BookingEvent {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  platform?: string;
  adults?: number;
  children?: number;
  notes?: string;
}

/**
 * @class ICalGenerator
 * @description Generates iCal calendar feeds from booking data
 */
export class ICalGenerator {
  private readonly hostelName: string;
  private readonly hostelUrl: string;
  private readonly timezone: string;

  constructor(
    hostelName: string = 'Lapa Casa Hostel',
    hostelUrl: string = 'https://lapacasahostel.com',
    timezone: string = 'America/Sao_Paulo'
  ) {
    this.hostelName = hostelName;
    this.hostelUrl = hostelUrl;
    this.timezone = timezone;
  }

  /**
   * @method generateForRoom
   * @description Generates iCal feed for a specific room
   * @param {string} roomId - Room ID
   * @param {GeneratorOptions} [options] - Generation options
   * @returns {Promise<string>} iCal feed as string
   */
  async generateForRoom(roomId: string, options: GeneratorOptions = {}): Promise<string> {
    const {
      includeBlocked = true,
      includePending = false,
      futureMonths = 12,
      pastMonths = 1,
      timezone = this.timezone,
    } = options;

    try {
      // Fetch room details
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      if (!room) {
        throw new Error(`Room not found: ${roomId}`);
      }

      // Calculate date range
      const now = new Date();
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - pastMonths);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + futureMonths);
      endDate.setHours(23, 59, 59, 999);

      // Fetch bookings
      const bookings = await this.fetchBookings(roomId, startDate, endDate, includeBlocked, includePending);

      // Create calendar
      const calendar = ical({
        name: `${this.hostelName} - ${room.name}`,
        description: `Availability calendar for ${room.name} (${room.type})`,
        timezone,
        url: `${this.hostelUrl}/api/ical/export/${roomId}`,
        ttl: 3600, // 1 hour cache
      });

      // Add events
      for (const booking of bookings) {
        this.addEventToCalendar(calendar, booking, room.name);
      }

      return calendar.toString();
    } catch (error) {
      console.error('Error generating iCal feed:', error);
      throw new Error(`Failed to generate iCal feed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method generateForMultipleRooms
   * @description Generates combined iCal feed for multiple rooms
   * @param {string[]} roomIds - Array of room IDs
   * @param {GeneratorOptions} [options] - Generation options
   * @returns {Promise<string>} iCal feed as string
   */
  async generateForMultipleRooms(roomIds: string[], options: GeneratorOptions = {}): Promise<string> {
    const {
      includeBlocked = true,
      includePending = false,
      futureMonths = 12,
      pastMonths = 1,
      timezone = this.timezone,
    } = options;

    try {
      // Fetch all rooms
      const rooms = await prisma.room.findMany({
        where: { id: { in: roomIds } },
        select: {
          id: true,
          name: true,
          type: true,
        },
      });

      if (rooms.length === 0) {
        throw new Error('No valid rooms found');
      }

      // Calculate date range
      const now = new Date();
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - pastMonths);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + futureMonths);
      endDate.setHours(23, 59, 59, 999);

      // Create calendar
      const calendar = ical({
        name: `${this.hostelName} - Multiple Rooms`,
        description: `Combined availability calendar`,
        timezone,
        url: `${this.hostelUrl}/api/ical/export/combined`,
        ttl: 3600,
      });

      // Fetch and add bookings for each room
      for (const room of rooms) {
        const bookings = await this.fetchBookings(
          room.id,
          startDate,
          endDate,
          includeBlocked,
          includePending
        );

        for (const booking of bookings) {
          this.addEventToCalendar(calendar, booking, room.name);
        }
      }

      return calendar.toString();
    } catch (error) {
      console.error('Error generating combined iCal feed:', error);
      throw new Error(`Failed to generate iCal feed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method fetchBookings
   * @description Fetches bookings for a room within date range
   * @param {string} roomId - Room ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {boolean} includeBlocked - Include blocked dates
   * @param {boolean} includePending - Include pending bookings
   * @returns {Promise<BookingEvent[]>} Array of booking events
   */
  private async fetchBookings(
    roomId: string,
    startDate: Date,
    endDate: Date,
    includeBlocked: boolean,
    includePending: boolean
  ): Promise<BookingEvent[]> {
    const statusFilter: string[] = ['confirmed'];

    if (includePending) {
      statusFilter.push('pending');
    }

    if (includeBlocked) {
      statusFilter.push('blocked');
    }

    const bookings = await prisma.booking.findMany({
      where: {
        roomId,
        status: { in: statusFilter },
        OR: [
          {
            checkIn: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            checkOut: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            AND: [
              { checkIn: { lte: startDate } },
              { checkOut: { gte: endDate } },
            ],
          },
        ],
      },
      select: {
        id: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        status: true,
        platform: true,
        adults: true,
        children: true,
        notes: true,
      },
      orderBy: {
        checkIn: 'asc',
      },
    });

    return bookings;
  }

  /**
   * @method addEventToCalendar
   * @description Adds a booking event to the calendar
   * @param {ICalCalendar} calendar - Calendar instance
   * @param {BookingEvent} booking - Booking data
   * @param {string} roomName - Room name
   */
  private addEventToCalendar(
    calendar: ICalCalendar,
    booking: BookingEvent,
    roomName: string
  ): void {
    const isBlocked = booking.status === 'blocked';
    const isPending = booking.status === 'pending';

    // Generate summary
    let summary: string;
    if (isBlocked) {
      summary = `Blocked - ${roomName}`;
    } else if (isPending) {
      summary = `Pending - ${roomName}`;
    } else {
      summary = `Reserved - ${roomName}`;
    }

    // Generate description
    const descriptionParts: string[] = [];

    if (!isBlocked) {
      descriptionParts.push(`Guest: ${booking.guestName}`);

      if (booking.adults) {
        descriptionParts.push(`Adults: ${booking.adults}`);
      }

      if (booking.children) {
        descriptionParts.push(`Children: ${booking.children}`);
      }

      if (booking.platform && booking.platform !== 'direct') {
        descriptionParts.push(`Platform: ${this.formatPlatform(booking.platform)}`);
      }

      if (booking.notes) {
        descriptionParts.push(`\nNotes: ${booking.notes}`);
      }
    } else {
      descriptionParts.push('This date is blocked and unavailable');
      if (booking.notes) {
        descriptionParts.push(`Reason: ${booking.notes}`);
      }
    }

    const description = descriptionParts.join('\n');

    // Create event data
    const eventData: ICalEventData = {
      id: booking.id,
      start: booking.checkIn,
      end: booking.checkOut,
      summary,
      description,
      location: this.hostelName,
      url: `${this.hostelUrl}/admin/bookings/${booking.id}`,
      status: isBlocked ? 'CANCELLED' : isPending ? 'TENTATIVE' : 'CONFIRMED',
      busystatus: 'BUSY',
      sequence: 0,
      created: new Date(),
      lastModified: new Date(),
    };

    calendar.createEvent(eventData);
  }

  /**
   * @method formatPlatform
   * @description Formats platform name for display
   * @param {string} platform - Platform identifier
   * @returns {string} Formatted platform name
   */
  private formatPlatform(platform: string): string {
    const platformNames: Record<string, string> = {
      airbnb: 'Airbnb',
      booking: 'Booking.com',
      expedia: 'Expedia',
      vrbo: 'VRBO',
      hostelworld: 'Hostelworld',
      direct: 'Direct Booking',
    };

    return platformNames[platform.toLowerCase()] || platform;
  }

  /**
   * @method generateBlockedDates
   * @description Generates iCal feed with only blocked dates for a room
   * @param {string} roomId - Room ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<string>} iCal feed as string
   */
  async generateBlockedDates(roomId: string, startDate: Date, endDate: Date): Promise<string> {
    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { name: true, type: true },
      });

      if (!room) {
        throw new Error(`Room not found: ${roomId}`);
      }

      const blockedDates = await prisma.booking.findMany({
        where: {
          roomId,
          status: 'blocked',
          checkIn: { gte: startDate },
          checkOut: { lte: endDate },
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          notes: true,
        },
        orderBy: { checkIn: 'asc' },
      });

      const calendar = ical({
        name: `${this.hostelName} - ${room.name} - Blocked Dates`,
        description: `Blocked dates for ${room.name}`,
        timezone: this.timezone,
      });

      for (const blocked of blockedDates) {
        calendar.createEvent({
          id: blocked.id,
          start: blocked.checkIn,
          end: blocked.checkOut,
          summary: `Blocked - ${room.name}`,
          description: blocked.notes || 'Date blocked',
          status: 'CANCELLED',
          busystatus: 'BUSY',
        });
      }

      return calendar.toString();
    } catch (error) {
      console.error('Error generating blocked dates feed:', error);
      throw new Error(`Failed to generate blocked dates feed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method validateCalendar
   * @description Validates generated iCal string
   * @param {string} icalString - iCal string to validate
   * @returns {boolean} True if valid
   */
  validateCalendar(icalString: string): boolean {
    try {
      // Check basic structure
      if (!icalString || icalString.length === 0) {
        return false;
      }

      // Must start with BEGIN:VCALENDAR
      if (!icalString.trim().startsWith('BEGIN:VCALENDAR')) {
        return false;
      }

      // Must end with END:VCALENDAR
      if (!icalString.trim().endsWith('END:VCALENDAR')) {
        return false;
      }

      // Must have VERSION
      if (!icalString.includes('VERSION:2.0')) {
        return false;
      }

      // Must have PRODID
      if (!icalString.includes('PRODID:')) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
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
}

/**
 * @function createGenerator
 * @description Factory function to create a new ICalGenerator instance
 * @param {string} [hostelName] - Hostel name
 * @param {string} [hostelUrl] - Hostel URL
 * @param {string} [timezone] - Timezone
 * @returns {ICalGenerator} New generator instance
 */
export function createGenerator(
  hostelName?: string,
  hostelUrl?: string,
  timezone?: string
): ICalGenerator {
  return new ICalGenerator(hostelName, hostelUrl, timezone);
}

// ✅ Archivo 3/10 completado
