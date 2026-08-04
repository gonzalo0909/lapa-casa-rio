// lapa-casa-hostel/backend/src/integrations/google-sheets/booking-sync.ts

import { pool } from '../../config/database';
import { SheetsClient, type BookingRowData, SheetsConfig } from './sheets-client';

export interface SyncResult {
  success: boolean;
  bookingsAdded: number;
  bookingsUpdated: number;
  bookingsDeleted: number;
  errors: string[];
}

export interface SyncOptions {
  fullSync?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  roomId?: string;
}

export class BookingSync {
  private sheetsClient: SheetsClient;

  constructor(config: SheetsConfig) {
    this.sheetsClient = new SheetsClient(config);
  }

  async syncToSheets(options: SyncOptions = {}): Promise<SyncResult> {
    const errors: string[] = [];
    let bookingsAdded = 0, bookingsUpdated = 0;

    try {
      await this.sheetsClient.initializeSheet();

      const params: any[] = [];
      let sql = `
        SELECT r.id, g.full_name AS guest_name, g.email AS guest_email,
               rm.name AS room_name, rb.check_in, rb.check_out,
               r.status, c.code AS platform, r.total_price, r.notes,
               r.beds_count, r.nights_count, r.created_at
        FROM reservations r
        JOIN guests g ON g.id = r.guest_id
        JOIN reservation_beds rb ON rb.reservation_id = r.id
        JOIN beds b ON b.id = rb.bed_id
        JOIN rooms rm ON rm.id = b.room_id
        JOIN channels c ON c.id = r.channel_id
        WHERE r.status IN ('confirmed','pending_payment')
      `;

      if (options.dateFrom) {
        params.push(options.dateFrom);
        sql += ` AND rb.check_in >= $${params.length}`;
      }
      if (options.dateTo) {
        params.push(options.dateTo);
        sql += ` AND rb.check_out <= $${params.length}`;
      }
      if (options.roomId) {
        params.push(options.roomId);
        sql += ` AND b.room_id = $${params.length}`;
      }
      sql += ` ORDER BY rb.check_in`;

      const { rows: bookings } = await pool.query(sql, params);

      for (const booking of bookings) {
        try {
          const rowData = this.convertToRowData(booking);
          const existingRow = await this.sheetsClient.findRowByBookingId(booking.id);
          if (existingRow) {
            await this.sheetsClient.updateRow(existingRow, rowData);
            bookingsUpdated++;
          } else {
            await this.sheetsClient.appendRow(rowData);
            bookingsAdded++;
          }
        } catch (error) {
          errors.push(`Failed to sync booking ${booking.id}: ${this.getErrorMessage(error)}`);
        }
      }

      return { success: errors.length === 0, bookingsAdded, bookingsUpdated, bookingsDeleted: 0, errors };
    } catch (error) {
      errors.push(`Sync failed: ${this.getErrorMessage(error)}`);
      return { success: false, bookingsAdded, bookingsUpdated, bookingsDeleted: 0, errors };
    }
  }

  async syncFromSheets(): Promise<SyncResult> {
    const errors: string[] = [];
    let bookingsUpdated = 0;

    try {
      const rows = await this.sheetsClient.getAllRows();

      for (const row of rows) {
        try {
          const { rows: existing } = await pool.query(`SELECT id FROM reservations WHERE id = $1`, [row.bookingId]);
          if (existing.length > 0) {
            await pool.query(
              `UPDATE reservations SET notes = $1, updated_at = NOW() WHERE id = $2`,
              [row.notes, row.bookingId]
            );
            bookingsUpdated++;
          } else {
            errors.push(`Booking ${row.bookingId} not found in database - skipping`);
          }
        } catch (error) {
          errors.push(`Failed to sync booking ${row.bookingId}: ${this.getErrorMessage(error)}`);
        }
      }

      return { success: errors.length === 0, bookingsAdded: 0, bookingsUpdated, bookingsDeleted: 0, errors };
    } catch (error) {
      return { success: false, bookingsAdded: 0, bookingsUpdated: 0, bookingsDeleted: 0, errors: [this.getErrorMessage(error)] };
    }
  }

  async getBookingFromSheet(bookingId: string): Promise<BookingRowData | null> {
    try {
      const rowIndex = await this.sheetsClient.findRowByBookingId(bookingId);
      if (!rowIndex) return null;
      const allRows = await this.sheetsClient.getAllRows();
      return allRows.find(r => r.bookingId === bookingId) || null;
    } catch { return null; }
  }

  async deleteBookingFromSheet(bookingId: string): Promise<boolean> {
    try {
      const rowIndex = await this.sheetsClient.findRowByBookingId(bookingId);
      if (!rowIndex) return false;
      await this.sheetsClient.deleteRow(rowIndex);
      return true;
    } catch { return false; }
  }

  async fullSync(): Promise<SyncResult> {
    try {
      await this.sheetsClient.clearSheet();
      await this.sheetsClient.initializeSheet();
      return await this.syncToSheets({ fullSync: true });
    } catch (error) {
      return { success: false, bookingsAdded: 0, bookingsUpdated: 0, bookingsDeleted: 0, errors: [this.getErrorMessage(error)] };
    }
  }

  private convertToRowData(booking: any): BookingRowData {
    const nights = Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000);
    return {
      bookingId: booking.id,
      guestName: booking.guest_name,
      guestEmail: booking.guest_email || '',
      roomName: booking.room_name,
      checkIn: new Date(booking.check_in).toISOString().split('T')[0],
      checkOut: new Date(booking.check_out).toISOString().split('T')[0],
      nights,
      adults: booking.beds_count,
      children: 0,
      totalPrice: booking.total_price,
      status: booking.status,
      platform: booking.platform,
      createdAt: new Date(booking.created_at).toISOString(),
      notes: booking.notes,
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

export function createBookingSync(config: SheetsConfig): BookingSync {
  return new BookingSync(config);
}
