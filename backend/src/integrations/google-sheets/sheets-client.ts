// lapa-casa-hostel/backend/src/integrations/google-sheets/sheets-client.ts

import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

/**
 * @module SheetsClient
 * @description Google Sheets API client for syncing booking data
 */

/**
 * @interface BookingRowData
 * @description Data structure for a booking row in Google Sheets
 */
export interface BookingRowData {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalPrice: number;
  status: string;
  platform: string;
  createdAt: string;
  notes?: string;
}

/**
 * @interface SheetsConfig
 * @description Configuration for Google Sheets integration
 */
export interface SheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  credentials: {
    clientEmail: string;
    privateKey: string;
  };
}

/**
 * @interface SheetRange
 * @description Represents a range in Google Sheets
 */
export interface SheetRange {
  sheetName: string;
  startRow: number;
  endRow?: number;
  startColumn?: string;
  endColumn?: string;
}

/**
 * @class SheetsClient
 * @description Client for interacting with Google Sheets API
 */
export class SheetsClient {
  private auth: JWT;
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;
  private sheetName: string;

  constructor(config: SheetsConfig) {
    this.spreadsheetId = config.spreadsheetId;
    this.sheetName = config.sheetName;

    // Initialize authentication
    this.auth = new JWT({
      email: config.credentials.clientEmail,
      key: config.credentials.privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Initialize Sheets API
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * @method appendRow
   * @description Appends a new row to the sheet
   * @param {BookingRowData} data - Booking data to append
   * @returns {Promise<void>}
   */
  async appendRow(data: BookingRowData): Promise<void> {
    try {
      const values = [
        [
          data.bookingId,
          data.guestName,
          data.guestEmail,
          data.roomName,
          data.checkIn,
          data.checkOut,
          data.nights,
          data.adults,
          data.children,
          data.totalPrice,
          data.status,
          data.platform,
          data.createdAt,
          data.notes || '',
        ],
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:N`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
    } catch (error) {
      console.error('Error appending row to Google Sheets:', error);
      throw new Error(`Failed to append row: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method updateRow
   * @description Updates an existing row in the sheet
   * @param {number} rowIndex - Row index (1-based)
   * @param {BookingRowData} data - Updated booking data
   * @returns {Promise<void>}
   */
  async updateRow(rowIndex: number, data: BookingRowData): Promise<void> {
    try {
      const values = [
        [
          data.bookingId,
          data.guestName,
          data.guestEmail,
          data.roomName,
          data.checkIn,
          data.checkOut,
          data.nights,
          data.adults,
          data.children,
          data.totalPrice,
          data.status,
          data.platform,
          data.createdAt,
          data.notes || '',
        ],
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A${rowIndex}:N${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
    } catch (error) {
      console.error('Error updating row in Google Sheets:', error);
      throw new Error(`Failed to update row: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method findRowByBookingId
   * @description Finds a row by booking ID
   * @param {string} bookingId - Booking ID to search for
   * @returns {Promise<number | null>} Row index (1-based) or null if not found
   */
  async findRowByBookingId(bookingId: string): Promise<number | null> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:A`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return null;
      }

      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === bookingId) {
          return i + 1; // Return 1-based index
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding row in Google Sheets:', error);
      throw new Error(`Failed to find row: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method getAllRows
   * @description Retrieves all rows from the sheet
   * @returns {Promise<BookingRowData[]>} Array of booking data
   */
  async getAllRows(): Promise<BookingRowData[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A2:N`, // Skip header row
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      return rows.map((row) => this.parseRowData(row));
    } catch (error) {
      console.error('Error getting all rows from Google Sheets:', error);
      throw new Error(`Failed to get rows: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method deleteRow
   * @description Deletes a row from the sheet
   * @param {number} rowIndex - Row index (1-based)
   * @returns {Promise<void>}
   */
  async deleteRow(rowIndex: number): Promise<void> {
    try {
      // Get sheet ID first
      const sheetId = await this.getSheetId();

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1, // 0-based for API
                  endIndex: rowIndex,
                },
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('Error deleting row from Google Sheets:', error);
      throw new Error(`Failed to delete row: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method clearSheet
   * @description Clears all data from the sheet (except header)
   * @returns {Promise<void>}
   */
  async clearSheet(): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A2:N`,
      });
    } catch (error) {
      console.error('Error clearing Google Sheets:', error);
      throw new Error(`Failed to clear sheet: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method initializeSheet
   * @description Initializes the sheet with headers if empty
   * @returns {Promise<void>}
   */
  async initializeSheet(): Promise<void> {
    try {
      const headers = [
        [
          'Booking ID',
          'Guest Name',
          'Guest Email',
          'Room',
          'Check In',
          'Check Out',
          'Nights',
          'Adults',
          'Children',
          'Total Price',
          'Status',
          'Platform',
          'Created At',
          'Notes',
        ],
      ];

      // Check if headers already exist
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:N1`,
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Add headers
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A1:N1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: headers,
          },
        });

        // Format headers (bold)
        const sheetId = await this.getSheetId();
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: {
                        bold: true,
                      },
                    },
                  },
                  fields: 'userEnteredFormat.textFormat.bold',
                },
              },
            ],
          },
        });
      }
    } catch (error) {
      console.error('Error initializing Google Sheets:', error);
      throw new Error(`Failed to initialize sheet: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * @method getSheetId
   * @description Gets the sheet ID by name
   * @returns {Promise<number>} Sheet ID
   */
  private async getSheetId(): Promise<number> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheet = response.data.sheets?.find(
        (s) => s.properties?.title === this.sheetName
      );

      if (!sheet || sheet.properties?.sheetId === undefined) {
        throw new Error(`Sheet "${this.sheetName}" not found`);
      }

      return sheet.properties.sheetId;
    } catch (error) {
      console.error('Error getting sheet ID:', error);
      throw error;
    }
  }

  /**
   * @method parseRowData
   * @description Parses raw row data into BookingRowData
   * @param {any[]} row - Raw row data
   * @returns {BookingRowData} Parsed booking data
   */
  private parseRowData(row: any[]): BookingRowData {
    return {
      bookingId: String(row[0] || ''),
      guestName: String(row[1] || ''),
      guestEmail: String(row[2] || ''),
      roomName: String(row[3] || ''),
      checkIn: String(row[4] || ''),
      checkOut: String(row[5] || ''),
      nights: Number(row[6] || 0),
      adults: Number(row[7] || 0),
      children: Number(row[8] || 0),
      totalPrice: Number(row[9] || 0),
      status: String(row[10] || ''),
      platform: String(row[11] || ''),
      createdAt: String(row[12] || ''),
      notes: row[13] ? String(row[13]) : undefined,
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
 * @function createSheetsClient
 * @description Factory function to create a new SheetsClient instance
 * @param {SheetsConfig} config - Sheets configuration
 * @returns {SheetsClient} New SheetsClient instance
 */
export function createSheetsClient(config: SheetsConfig): SheetsClient {
  return new SheetsClient(config);
}

// ✅ Archivo 1/2 - sheets-client.ts completado
