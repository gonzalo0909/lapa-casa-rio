// lapa-casa-hostel/backend/src/integrations/google-sheets/booking-sync.ts

import { PrismaClient } from '@prisma/client';
import { SheetsClient, type BookingRowData, SheetsConfig } from './sheets-client';

/**
 * @module BookingSync
 * @description Synchronizes bookings between database and Google Sheets
 */

const prisma = new PrismaClient();

/**
 * @interface SyncResult
 * @description Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  bookingsAdded: number;
  bookingsUpdated: number;
  bookingsDeleted: number;
  errors: string[];
}

/**
 * @interface SyncOptions
 * @description Options for sync operations
 */
export interface SyncOptions {
  fullSync?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  roomId?: string;
}

/**
 * @class BookingSync
 * @description Manages synchronization between database and Google Sheets
 */
export class BookingSync {
  private sheetsClient: SheetsClient;

  constructor(config: SheetsConfig) {
    this.sheetsClient = new SheetsClient(config);
  }

  /**
   * @method syncToSheets
   * @description Syncs bookings from database to Google Sheets
   * @param {SyncOptions} [options] - Sync options
   * @returns {Promise<SyncResult>} Sync result
   */
  async syncToSheets(options: SyncOptions = {}): Promise<SyncResult> {
    const errors: string[] = [];
    let bookingsAdded = 0;
    let bookingsUpdated = 0;

    try {
      // Initialize sheet if needed
      await this.sheetsClient.initializeSheet();

      // Build query
      const where: any = {
        status: { in: ['confirmed', 'pending'] },
      };

      if (options.dateFrom) {
        where.checkIn = { ...where.checkIn, gte: options.dateFrom };
      }

      if (options.dateTo) {
        where.checkOut = { ...where.checkOut, lte: options.dateTo };
      }

      if (options.roomId) {
        where.roomId = options.roomId;
      }

      // Fetch bookings from database
      const bookings = await prisma.booking.findMany({
        where,
        include: {
          room: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          checkIn: 'asc',
        },
      });

      // Sync each booking
      for (const booking of bookings) {
        try {
          const rowData = this.convertToRowData(booking);

          // Check if booking already exists in sheet
          const existingRow = await this.sheetsClient.findRowByBookingId(booking.id);

          if (existingRow) {
            // Update existing row
            await this.sheetsClient.updateRow(existingRow, rowData);
            bookingsUpdated++;
          } else {
            // Add new row
            await this.sheetsClient.appendRow(rowData);
            bookingsAdded++;
          }
        } catch (error) {
          const errorMsg = `Failed to sync booking ${booking.id}: ${this.getErrorMessage(error)}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        bookingsAdded,
        bookingsUpdated,
        bookingsDeleted: 0,
        errors,
      };
    } catch (error) {
      const errorMsg = `Sync failed: ${this.getErrorMessage(error)}`;
      errors.push(errorMsg);
      console.error(errorMsg);

      return {
        success: false,
        bookingsAdded,
        bookingsUpdated,
        bookingsDeleted: 0,
        errors,
      };
    }
  }

  /**
   * @method syncFromSheets
   * @description Syncs bookings from Google Sheets to database
   * @returns {Promise<SyncResult>} Sync result
   */
  async syncFromSheets(): Promise<SyncResult> {
    const errors: string[] = [];
    let bookingsAdded = 0;
    let bookingsUpdated = 0;

    try {
      // Get all rows from sheet
      const rows = await this.sheetsClient.getAllRows();

      for (const row of rows) {
        try {
          // Check if booking exists in database
          const existing = await prisma.booking.findUnique({
            where: { id: row.bookingId },
          });

          if (existing) {
            // Update existing booking
            await prisma.booking.update({
              where: { id: row.bookingId },
              data: {
                guestName: row.guestName,
                status: row.status as any,
                notes: row.notes,
              },
            });
            bookingsUpdated++;
          } else {
            // Note: Adding new bookings from sheets is typically not recommended
            // as it requires additional validation and room lookup
            errors.push(`Booking ${row.bookingId} not found in database - skipping`);
          }
        } catch (error) {
          const errorMsg = `Failed to sync booking ${row.bookingId}: ${this.getErrorMessage(error)}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        bookingsAdded,
        bookingsUpdated,
        bookingsDeleted: 0,
        errors,
      };
    } catch (error) {
      const errorMsg = `Sync from sheets failed: ${this.getErrorMessage(error)}`;
      errors.push(errorMsg);
      console.error(errorMsg);

      return {
        success: false,
        bookingsAdded,
        bookingsUpdated,
        bookingsDeleted: 0,
        errors,
      };
    }
  }

  /**
   * @method getBookingFromSheet
   * @description Retrieves a specific booking from Google Sheets
   * @param {string} bookingId - Booking ID
   * @returns {Promise<BookingRowData | null>} Booking data or null
   */
  async getBookingFromSheet(bookingId: string): Promise<BookingRowData | null> {
    try {
      const rowIndex = await this.sheetsClient.findRowByBookingId(bookingId);
      if (!rowIndex) {
        return null;
      }

      const allRows = await this.sheetsClient.getAllRows();
      return allRows.find((row) => row.bookingId === bookingId) || null;
    } catch (error) {
      console.error('Error getting booking from sheet:', error);
      return null;
    }
  }

  /**
   * @method deleteBookingFromSheet
   * @description Deletes a booking from Google Sheets
   * @param {string} bookingId - Booking ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteBookingFromSheet(bookingId: string): Promise<boolean> {
    try {
      const rowIndex = await this.sheetsClient.findRowByBookingId(bookingId);
      if (!rowIndex) {
        return false;
      }

      await this.sheetsClient.deleteRow(rowIndex);
      return true;
    } catch (error) {
      console.error('Error deleting booking from sheet:', error);
      return false;
    }
  }

  /**
   * @method fullSync
   * @description Performs a full sync - clears sheet and syncs all bookings
   * @returns {Promise<SyncResult>} Sync result
   */
  async fullSync(): Promise<SyncResult> {
    try {
      // Clear existing data
      await this.sheetsClient.clearSheet();

      // Re-initialize with headers
      await this.sheetsClient.initializeSheet();

      // Sync all bookings
      return await this.syncToSheets({ fullSync: true });
    } catch (error) {
      console.error('Full sync failed:', error);
      return {
        success: false,
        bookingsAdded: 0,
        bookingsUpdated: 0,
        bookingsDeleted: 0,
        errors: [this.getErrorMessage(error)],
      };
    }
  }

  /**
   * @method convertToRowData
   * @description Converts database booking to sheet row data
   * @param {any} booking - Booking from database
   * @returns {BookingRowData} Row data for sheet
   */
  private convertToRowData(booking: any): BookingRowData {
    const nights = Math.ceil(
      (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      bookingId: booking.id,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail || '',
      roomName: booking.room.name,
      checkIn: new Date(booking.checkIn).toISOString().split('T')[0],
      checkOut: new Date(booking.checkOut).toISOString().split('T')[0],
      nights,
      adults: booking.adults,
      children: booking.children,
      totalPrice: booking.totalPrice,
      status: booking.status,
      platform: booking.platform,
      createdAt: new Date(booking.createdAt).toISOString(),
      notes: booking.notes,
    };
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
 * @function createBookingSync
 * @description Factory function to create a new BookingSync instance
 * @param {SheetsConfig} config - Sheets configuration
 * @returns {BookingSync} New BookingSync instance
 */
export function createBookingSync(config: SheetsConfig): BookingSync {
  return new BookingSync(config);
}

// ✅ Archivo 2/2 - booking-sync.ts completado
