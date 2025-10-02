// lapa-casa-hostel/backend/src/integrations/google-sheets/sheets-client.ts

import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { logger } from '../../utils/logger';

interface BookingRowData {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  roomAssigned: string;
  bedsCount: number;
  totalPrice: number;
  depositPaid: boolean;
  remainingPaid: boolean;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdDate: string;
  notes?: string;
}

export class SheetsClient {
  private sheets: sheets_v4.Sheets | null = null;
  private auth: JWT | null = null;
  private spreadsheetId: string;
  private sheetName: string = 'Bookings';

  private readonly COLUMNS = {
    BOOKING_ID: 'A',
    GUEST_NAME: 'B',
    GUEST_EMAIL: 'C',
    GUEST_PHONE: 'D',
    CHECK_IN: 'E',
    CHECK_OUT: 'F',
    ROOM_ASSIGNED: 'G',
    BEDS_COUNT: 'H',
    TOTAL_PRICE: 'I',
    DEPOSIT_PAID: 'J',
    REMAINING_PAID: 'K',
    STATUS: 'L',
    CREATED_DATE: 'M',
    NOTES: 'N'
  } as const;

  private readonly HEADER_ROW = [
    'Booking ID',
    'Guest Name',
    'Guest Email',
    'Guest Phone',
    'Check-In Date',
    'Check-Out Date',
    'Room Assigned',
    'Beds Count',
    'Total Price (BRL)',
    'Deposit Paid',
    'Remaining Paid',
    'Status',
    'Created Date',
    'Notes'
  ];

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
    if (!this.spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not configured');
    }
  }

  async initialize(): Promise<void> {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');

      this.auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      await this.ensureSheetExists();
      
      logger.info('Google Sheets client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Google Sheets client', { error });
      throw new Error('Google Sheets initialization failed');
    }
  }

  private async ensureSheetExists(): Promise<void> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const sheetExists = response.data.sheets?.some(
        sheet => sheet.properties?.title === this.sheetName
      );

      if (!sheetExists) {
        await this.createSheet();
      } else {
        await this.validateHeaders();
      }
    } catch (error) {
      logger.error('Error ensuring sheet exists', { error });
      throw error;
    }
  }

  private async createSheet(): Promise<void> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: this.sheetName,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 14,
                  frozenRowCount: 1
                }
              }
            }
          }]
        }
      });

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:N1`,
        valueInputOption: 'RAW',
        requestBody: { values: [this.HEADER_ROW] }
      });

      await this.formatHeaders();
      logger.info('Created new bookings sheet with headers');
    } catch (error) {
      logger.error('Error creating sheet', { error });
      throw error;
    }
  }

  private async validateHeaders(): Promise<void> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:N1`
      });

      const headers = response.data.values?.[0] || [];
      
      if (JSON.stringify(headers) !== JSON.stringify(this.HEADER_ROW)) {
        logger.warn('Sheet headers do not match expected format, updating...');
        await this.updateHeaders();
      }
    } catch (error) {
      logger.error('Error validating headers', { error });
      throw error;
    }
  }

  private async updateHeaders(): Promise<void> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A1:N1`,
      valueInputOption: 'RAW',
      requestBody: { values: [this.HEADER_ROW] }
    });
  }

  private async formatHeaders(): Promise<void> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    const sheetId = await this.getSheetId();

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 14
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  bold: true
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        }]
      }
    });
  }

  private async getSheetId(): Promise<number> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });

    const sheet = response.data.sheets?.find(
      s => s.properties?.title === this.sheetName
    );

    return sheet?.properties?.sheetId || 0;
  }

  async appendRow(data: BookingRowData): Promise<void> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    try {
      const row = this.formatBookingRow(data);

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:N`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] }
      });

      logger.info('Booking appended to sheet', { bookingId: data.bookingId });
    } catch (error) {
      logger.error('Error appending row to sheet', { error, data });
      throw error;
    }
  }

  async updateRow(bookingId: string, updates: Partial<BookingRowData>): Promise<void> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    try {
      const rowIndex = await this.findRowByBookingId(bookingId);
      
      if (!rowIndex) {
        throw new Error(`Booking ${bookingId} not found in sheet`);
      }

      const currentData = await this.getRowData(rowIndex);
      const updatedData = { ...currentData, ...updates };
      const row = this.formatBookingRow(updatedData);

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A${rowIndex}:N${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] }
      });

      logger.info('Booking updated in sheet', { bookingId, rowIndex });
    } catch (error) {
      logger.error('Error updating row in sheet', { error, bookingId });
      throw error;
    }
  }

  async deleteRow(bookingId: string): Promise<void> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    try {
      const rowIndex = await this.findRowByBookingId(bookingId);
      
      if (!rowIndex) {
        throw new Error(`Booking ${bookingId} not found in sheet`);
      }

      const sheetId = await this.getSheetId();

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              }
            }
          }]
        }
      });

      logger.info('Booking deleted from sheet', { bookingId, rowIndex });
    } catch (error) {
      logger.error('Error deleting row from sheet', { error, bookingId });
      throw error;
    }
  }

  async findRowByBookingId(bookingId: string): Promise<number | null> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:A`
      });

      const values = response.data.values || [];
      
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === bookingId) {
          return i + 1;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error finding booking row', { error, bookingId });
      throw error;
    }
  }

  private async getRowData(rowIndex: number): Promise<BookingRowData> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A${rowIndex}:N${rowIndex}`
    });

    const row = response.data.values?.[0] || [];
    
    return {
      bookingId: row[0] || '',
      guestName: row[1] || '',
      guestEmail: row[2] || '',
      guestPhone: row[3] || '',
      checkInDate: row[4] || '',
      checkOutDate: row[5] || '',
      roomAssigned: row[6] || '',
      bedsCount: parseInt(row[7]) || 0,
      totalPrice: parseFloat(row[8]) || 0,
      depositPaid: row[9] === 'TRUE',
      remainingPaid: row[10] === 'TRUE',
      status: row[11] as any || 'PENDING',
      createdDate: row[12] || '',
      notes: row[13] || ''
    };
  }

  private formatBookingRow(data: BookingRowData): any[] {
    return [
      data.bookingId,
      data.guestName,
      data.guestEmail,
      data.guestPhone,
      data.checkInDate,
      data.checkOutDate,
      data.roomAssigned,
      data.bedsCount,
      data.totalPrice,
      data.depositPaid ? 'TRUE' : 'FALSE',
      data.remainingPaid ? 'TRUE' : 'FALSE',
      data.status,
      data.createdDate,
      data.notes || ''
    ];
  }

  async getAllBookings(): Promise<BookingRowData[]> {
    if (!this.sheets) throw new Error('Sheets client not initialized');

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A2:N`
      });

      const rows = response.data.values || [];
      
      return rows.map(row => ({
        bookingId: row[0] || '',
        guestName: row[1] || '',
        guestEmail: row[2] || '',
        guestPhone: row[3] || '',
        checkInDate: row[4] || '',
        checkOutDate: row[5] || '',
        roomAssigned: row[6] || '',
        bedsCount: parseInt(row[7]) || 0,
        totalPrice: parseFloat(row[8]) || 0,
        depositPaid: row[9] === 'TRUE',
        remainingPaid: row[10] === 'TRUE',
        status: row[11] as any || 'PENDING',
        createdDate: row[12] || '',
        notes: row[13] || ''
      }));
    } catch (error) {
      logger.error('Error getting all bookings', { error });
      throw error;
    }
  }
}

export const sheetsClient = new SheetsClient();
