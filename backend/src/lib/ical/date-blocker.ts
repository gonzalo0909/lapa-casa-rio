// lapa-casa-hostel/backend/src/lib/ical/date-blocker.ts

import { PrismaClient } from '@prisma/client';

/**
 * @module DateBlocker
 * @description Manages blocking and unblocking dates for rooms
 */

const prisma = new PrismaClient();

/**
 * @interface BlockDateOptions
 * @description Options for blocking dates
 */
export interface BlockDateOptions {
  roomId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  notes?: string;
  blockType?: 'maintenance' | 'owner' | 'seasonal' | 'other';
}

/**
 * @interface BlockedPeriod
 * @description Represents a blocked period
 */
export interface BlockedPeriod {
  id: string;
  roomId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  notes?: string;
  blockType: string;
  createdAt: Date;
}

/**
 * @class DateBlocker
 * @description Handles blocking and unblocking of dates for rooms
 */
export class DateBlocker {
  /**
   * @method blockDates
   * @description Blocks dates for a room
   * @param {BlockDateOptions} options - Blocking options
   * @returns {Promise<string>} ID of created blocked booking
   */
  async blockDates(options: BlockDateOptions): Promise<string> {
    const { roomId, startDate, endDate, reason, notes, blockType = 'other' } = options;

    // Validate inputs
    this.validateDates(startDate, endDate);

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }

    // Check for conflicts with existing bookings
    const conflicts = await this.findConflicts(roomId, startDate, endDate);

    if (conflicts.length > 0) {
      const conflictDetails = conflicts.map(c => 
        `${c.guestName} (${c.checkIn.toISOString().split('T')[0]} - ${c.checkOut.toISOString().split('T')[0]})`
      ).join(', ');
      
      throw new Error(`Cannot block dates: conflicts with existing bookings: ${conflictDetails}`);
    }

    // Create blocked booking
    const blockedBooking = await prisma.booking.create({
      data: {
        roomId,
        guestName: 'Blocked',
        checkIn: startDate,
        checkOut: endDate,
        status: 'blocked',
        platform: 'internal',
        source: 'manual',
        adults: 0,
        children: 0,
        notes: this.formatBlockNotes(blockType, reason, notes),
      },
    });

    console.log(`Blocked dates for room ${roomId}: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    return blockedBooking.id;
  }

  /**
   * @method blockMultipleRanges
   * @description Blocks multiple date ranges for a room
   * @param {string} roomId - Room ID
   * @param {Array<{startDate: Date, endDate: Date}>} ranges - Date ranges to block
   * @param {string} [reason] - Blocking reason
   * @returns {Promise<string[]>} Array of created booking IDs
   */
  async blockMultipleRanges(
    roomId: string,
    ranges: Array<{ startDate: Date; endDate: Date }>,
    reason?: string
  ): Promise<string[]> {
    const bookingIds: string[] = [];

    for (const range of ranges) {
      try {
        const id = await this.blockDates({
          roomId,
          startDate: range.startDate,
          endDate: range.endDate,
          reason,
        });
        bookingIds.push(id);
      } catch (error) {
        console.error(`Failed to block range ${range.startDate} - ${range.endDate}:`, error);
        throw error;
      }
    }

    return bookingIds;
  }

  /**
   * @method unblockDates
   * @description Unblocks dates by deleting the blocked booking
   * @param {string} bookingId - ID of blocked booking to remove
   * @returns {Promise<void>}
   */
  async unblockDates(bookingId: string): Promise<void> {
    // Verify the booking is a blocked booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error(`Booking not found: ${bookingId}`);
    }

    if (booking.status !== 'blocked') {
      throw new Error(`Booking ${bookingId} is not a blocked booking`);
    }

    // Delete the blocked booking
    await prisma.booking.delete({
      where: { id: bookingId },
    });

    console.log(`Unblocked dates: removed booking ${bookingId}`);
  }

  /**
   * @method unblockDateRange
   * @description Unblocks all blocked dates in a specific date range
   * @param {string} roomId - Room ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<number>} Number of bookings removed
   */
  async unblockDateRange(roomId: string, startDate: Date, endDate: Date): Promise<number> {
    this.validateDates(startDate, endDate);

    const result = await prisma.booking.deleteMany({
      where: {
        roomId,
        status: 'blocked',
        OR: [
          {
            checkIn: {
              gte: startDate,
              lt: endDate,
            },
          },
          {
            checkOut: {
              gt: startDate,
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
    });

    console.log(`Unblocked ${result.count} blocked bookings in range`);
    return result.count;
  }

  /**
   * @method getBlockedDates
   * @description Retrieves all blocked dates for a room
   * @param {string} roomId - Room ID
   * @param {Date} [startDate] - Optional start date filter
   * @param {Date} [endDate] - Optional end date filter
   * @returns {Promise<BlockedPeriod[]>} Array of blocked periods
   */
  async getBlockedDates(
    roomId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BlockedPeriod[]> {
    const where: any = {
      roomId,
      status: 'blocked',
    };

    if (startDate && endDate) {
      this.validateDates(startDate, endDate);
      where.OR = [
        {
          checkIn: {
            gte: startDate,
            lt: endDate,
          },
        },
        {
          checkOut: {
            gt: startDate,
            lte: endDate,
          },
        },
        {
          AND: [
            { checkIn: { lte: startDate } },
            { checkOut: { gte: endDate } },
          ],
        },
      ];
    }

    const blockedBookings = await prisma.booking.findMany({
      where,
      select: {
        id: true,
        roomId: true,
        checkIn: true,
        checkOut: true,
        notes: true,
        createdAt: true,
      },
      orderBy: {
        checkIn: 'asc',
      },
    });

    return blockedBookings.map(booking => ({
      id: booking.id,
      roomId: booking.roomId,
      startDate: booking.checkIn,
      endDate: booking.checkOut,
      ...this.parseBlockNotes(booking.notes || ''),
      createdAt: booking.createdAt,
    }));
  }

  /**
   * @method isDateBlocked
   * @description Checks if a specific date is blocked for a room
   * @param {string} roomId - Room ID
   * @param {Date} date - Date to check
   * @returns {Promise<boolean>} True if date is blocked
   */
  async isDateBlocked(roomId: string, date: Date): Promise<boolean> {
    const blocked = await prisma.booking.findFirst({
      where: {
        roomId,
        status: 'blocked',
        checkIn: {
          lte: date,
        },
        checkOut: {
          gt: date,
        },
      },
    });

    return !!blocked;
  }

  /**
   * @method blockWeekdays
   * @description Blocks specific weekdays in a date range
   * @param {string} roomId - Room ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {number[]} weekdays - Array of weekday numbers (0=Sunday, 6=Saturday)
   * @param {string} [reason] - Blocking reason
   * @returns {Promise<string[]>} Array of created booking IDs
   */
  async blockWeekdays(
    roomId: string,
    startDate: Date,
    endDate: Date,
    weekdays: number[],
    reason?: string
  ): Promise<string[]> {
    this.validateDates(startDate, endDate);

    if (!Array.isArray(weekdays) || weekdays.length === 0) {
      throw new Error('Weekdays array is required');
    }

    // Validate weekdays
    for (const day of weekdays) {
      if (day < 0 || day > 6) {
        throw new Error('Weekdays must be between 0 (Sunday) and 6 (Saturday)');
      }
    }

    const bookingIds: string[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getDay();

      if (weekdays.includes(dayOfWeek)) {
        const nextDay = new Date(currentDate);
        nextDay.setDate(nextDay.getDate() + 1);

        try {
          const id = await this.blockDates({
            roomId,
            startDate: new Date(currentDate),
            endDate: nextDay,
            reason: reason || `Blocked ${this.getDayName(dayOfWeek)}s`,
            blockType: 'seasonal',
          });
          bookingIds.push(id);
        } catch (error) {
          console.error(`Failed to block ${currentDate.toISOString()}:`, error);
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return bookingIds;
  }

  /**
   * @method findConflicts
   * @description Finds existing bookings that conflict with a date range
   * @param {string} roomId - Room ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of conflicting bookings
   */
  private async findConflicts(
    roomId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const conflicts = await prisma.booking.findMany({
      where: {
        roomId,
        status: {
          in: ['confirmed', 'pending'],
        },
        OR: [
          {
            checkIn: {
              gte: startDate,
              lt: endDate,
            },
          },
          {
            checkOut: {
              gt: startDate,
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
      },
    });

    return conflicts;
  }

  /**
   * @method validateDates
   * @description Validates date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @throws {Error} If dates are invalid
   */
  private validateDates(startDate: Date, endDate: Date): void {
    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
      throw new Error('Invalid start date');
    }

    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
      throw new Error('Invalid end date');
    }

    if (endDate <= startDate) {
      throw new Error('End date must be after start date');
    }

    // Check if dates are not too far in the past
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (startDate < oneYearAgo) {
      throw new Error('Cannot block dates more than 1 year in the past');
    }

    // Check if dates are not too far in the future
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

    if (endDate > twoYearsFromNow) {
      throw new Error('Cannot block dates more than 2 years in the future');
    }
  }

  /**
   * @method formatBlockNotes
   * @description Formats notes for blocked bookings
   * @param {string} blockType - Type of block
   * @param {string} [reason] - Blocking reason
   * @param {string} [notes] - Additional notes
   * @returns {string} Formatted notes
   */
  private formatBlockNotes(blockType: string, reason?: string, notes?: string): string {
    const parts: string[] = [`[BLOCK_TYPE:${blockType}]`];

    if (reason) {
      parts.push(`[REASON:${reason}]`);
    }

    if (notes) {
      parts.push(notes);
    }

    return parts.join(' ');
  }

  /**
   * @method parseBlockNotes
   * @description Parses block information from notes
   * @param {string} notes - Notes string
   * @returns {object} Parsed block information
   */
  private parseBlockNotes(notes: string): {
    blockType: string;
    reason?: string;
    notes?: string;
  } {
    const typeMatch = notes.match(/\[BLOCK_TYPE:([^\]]+)\]/);
    const reasonMatch = notes.match(/\[REASON:([^\]]+)\]/);

    let cleanNotes = notes
      .replace(/\[BLOCK_TYPE:[^\]]+\]/g, '')
      .replace(/\[REASON:[^\]]+\]/g, '')
      .trim();

    if (cleanNotes.length === 0) {
      cleanNotes = undefined as any;
    }

    return {
      blockType: typeMatch ? typeMatch[1] : 'other',
      reason: reasonMatch ? reasonMatch[1] : undefined,
      notes: cleanNotes,
    };
  }

  /**
   * @method getDayName
   * @description Gets day name from day number
   * @param {number} dayNumber - Day number (0-6)
   * @returns {string} Day name
   */
  private getDayName(dayNumber: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  }
}

/**
 * @function createDateBlocker
 * @description Factory function to create a new DateBlocker instance
 * @returns {DateBlocker} New DateBlocker instance
 */
export function createDateBlocker(): DateBlocker {
  return new DateBlocker();
}

// ✅ Archivo 8/10 completado
