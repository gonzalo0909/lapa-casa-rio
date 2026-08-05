// lapa-casa-hostel/backend/src/integrations/google-sheets/sheets-client.ts
// ventana4 (bloque 2)
//
// Cliente de bajo nivel contra la API de Google Sheets. Reescrito
// contra el schema real (0002_tables.sql) y la estructura de columnas
// A-N del prompt de esta ventana -- la version anterior apuntaba a una
// tabla `rooms` y columnas (`total_price`, `notes`, `room_id`) que no
// existen en el schema real, y nunca se probo.
//
// Autenticacion: service account de Google Cloud. Sin las credenciales
// configuradas (GOOGLE_SERVICE_ACCOUNT_EMAIL / _PRIVATE_KEY /
// GOOGLE_SHEETS_SPREADSHEET_ID), el cliente queda deshabilitado y cada
// metodo resuelve como no-op logueando un warning -- mismo patron que
// Resend/Stripe/MercadoPago en el resto del repo, para no romper el
// server si Sheets todavia no esta configurado.

import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { logger } from '../../utils/logger';

/**
 * Estructura de columnas A-N (prompt de Ventana 4):
 * A=booking_id, B=guest_name, C=guest_email, D=guest_phone, E=check_in,
 * F=check_out, G=room_assigned, H=beds_count, I=total_price,
 * J=deposit_paid, K=remaining_paid, L=booking_status, M=created_date, N=notes
 */
export interface BookingRowData {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  roomAssigned: string;
  bedsCount: number;
  totalPrice: number;
  depositPaid: number;
  remainingPaid: number;
  bookingStatus: string;
  createdDate: string;
  notes: string;
}

const COLUMN_RANGE = 'A:N';
const HEADER_ROW = [
  'booking_id', 'guest_name', 'guest_email', 'guest_phone', 'check_in', 'check_out',
  'room_assigned', 'beds_count', 'total_price', 'deposit_paid', 'remaining_paid',
  'booking_status', 'created_date', 'notes'
];

function rowToValues(data: BookingRowData): (string | number)[] {
  return [
    data.bookingId, data.guestName, data.guestEmail, data.guestPhone,
    data.checkIn, data.checkOut, data.roomAssigned, data.bedsCount,
    data.totalPrice, data.depositPaid, data.remainingPaid,
    data.bookingStatus, data.createdDate, data.notes
  ];
}

function valuesToRow(row: any[]): BookingRowData {
  return {
    bookingId: String(row[0] ?? ''),
    guestName: String(row[1] ?? ''),
    guestEmail: String(row[2] ?? ''),
    guestPhone: String(row[3] ?? ''),
    checkIn: String(row[4] ?? ''),
    checkOut: String(row[5] ?? ''),
    roomAssigned: String(row[6] ?? ''),
    bedsCount: Number(row[7] ?? 0),
    totalPrice: Number(row[8] ?? 0),
    depositPaid: Number(row[9] ?? 0),
    remainingPaid: Number(row[10] ?? 0),
    bookingStatus: String(row[11] ?? ''),
    createdDate: String(row[12] ?? ''),
    notes: String(row[13] ?? '')
  };
}

export class SheetsClient {
  private sheets: sheets_v4.Sheets | null = null;
  private spreadsheetId: string;
  private sheetName: string;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '';
    this.sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Bookings';

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!email || !privateKey || !this.spreadsheetId) {
      logger.warn('Google Sheets no configurado (faltan GOOGLE_SERVICE_ACCOUNT_EMAIL / _PRIVATE_KEY / GOOGLE_SHEETS_SPREADSHEET_ID) — exportación deshabilitada');
      return;
    }

    const auth = new JWT({
      email,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  isEnabled(): boolean {
    return this.sheets !== null;
  }

  private requireClient(): sheets_v4.Sheets {
    if (!this.sheets) throw new Error('Google Sheets no configurado');
    return this.sheets;
  }

  async initializeSheet(): Promise<void> {
    if (!this.sheets) return;
    const existing = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A1:N1`
    });
    if (existing.data.values && existing.data.values.length > 0) return;

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A1:N1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADER_ROW] }
    });

    const sheetId = await this.getSheetId();
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold'
          }
        }]
      }
    });
  }

  async appendRow(data: BookingRowData): Promise<void> {
    const sheets = this.requireClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!${COLUMN_RANGE}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowToValues(data)] }
    });
  }

  async updateRow(rowIndex: number, data: BookingRowData): Promise<void> {
    const sheets = this.requireClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A${rowIndex}:N${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowToValues(data)] }
    });
  }

  /** Devuelve el índice de fila (1-based) para un bookingId, o null si no existe. */
  async findRowByBookingId(bookingId: string): Promise<number | null> {
    const sheets = this.requireClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:A`
    });
    const rows = response.data.values;
    if (!rows) return null;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === bookingId) return i + 1;
    }
    return null;
  }

  async deleteRow(rowIndex: number): Promise<void> {
    const sheets = this.requireClient();
    const sheetId = await this.getSheetId();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
          }
        }]
      }
    });
  }

  async getAllRows(): Promise<BookingRowData[]> {
    const sheets = this.requireClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A2:N`
    });
    const rows = response.data.values;
    if (!rows) return [];
    return rows.map(valuesToRow);
  }

  private async getSheetId(): Promise<number> {
    const sheets = this.requireClient();
    const response = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
    const sheet = response.data.sheets?.find(s => s.properties?.title === this.sheetName);
    // ventana4: acá estaba el bug reportado (sheet.properties?.sheetId es
    // `number | null`, no se puede devolver directo como `number`) --
    // 0 es un sheetId valido (la primera hoja de un spreadsheet nuevo lo
    // usa), por eso se chequea con `??`, no con `||`.
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined || sheetId === null) {
      throw new Error(`Hoja "${this.sheetName}" no encontrada en el spreadsheet`);
    }
    return sheetId;
  }
}

export const sheetsClient = new SheetsClient();
