import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface SheetBooking {
  booking_id: string;
  nombre: string;
  email: string;
  telefono: string;
  entrada: string;
  salida: string;
  hombres: number;
  mujeres: number;
  camas_json: string;
  total: number;
  pay_status: string;
  created_at: string;
  source: string;
}

export class SheetsIntegrationService {
  private webappUrl: string;
  private webappToken: string;

  constructor() {
    this.webappUrl = config.sheets.webappUrl;
    this.webappToken = config.sheets.webappToken;
  }

  async syncBookingToSheets(bookingData: any): Promise<void> {
    if (!this.webappUrl || !this.webappToken) {
      logger.warn('Google Sheets integration not configured');
      return;
    }

    try {
      const sheetData: SheetBooking = {
        booking_id: bookingData.bookingId,
        nombre: bookingData.guest.nombre,
        email: bookingData.guest.email,
        telefono: bookingData.guest.telefono || '',
        entrada: bookingData.entrada.toISOString().split('T')[0],
        salida: bookingData.salida.toISOString().split('T')[0],
        hombres: bookingData.hombres,
        mujeres: bookingData.mujeres,
        camas_json: JSON.stringify(this.formatBedsForSheets(bookingData.beds)),
        total: parseFloat(bookingData.totalPrice.toString()),
        pay_status: bookingData.payStatus.toLowerCase(),
        created_at: bookingData.createdAt.toISOString(),
        source: 'web_backend',
      };

      const response = await fetch(this.webappUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: this.webappToken,
          action: 'upsert_booking',
          ...sheetData,
        }),
      });

      const result = await response.json();
      
      if (result.ok) {
        logger.info('Booking synced to Google Sheets', { bookingId: bookingData.bookingId });
      } else {
        logger.error('Google Sheets sync failed:', result);
      }

    } catch (error) {
      logger.error('Google Sheets sync error:', error);
    }
  }

  async updatePaymentStatusInSheets(bookingId: string, payStatus: string): Promise<void> {
    if (!this.webappUrl || !this.webappToken) return;

    try {
      const response = await fetch(this.webappUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: this.webappToken,
          action: 'payment_update',
          booking_id: bookingId,
          pay_status: payStatus.toLowerCase(),
        }),
      });

      const result = await response.json();
      
      if (result.ok) {
        logger.info('Payment status updated in Google Sheets', { bookingId, payStatus });
      }

    } catch (error) {
      logger.error('Google Sheets payment update error:', error);
    }
  }

  private formatBedsForSheets(beds: any[]): Record<string, number[]> {
    const bedsData: Record<string, number[]> = {};
    
    for (const bed of beds) {
      const roomKey = bed.roomId.toString();
      if (!bedsData[roomKey]) {
        bedsData[roomKey] = [];
      }
      bedsData[roomKey].push(bed.bedNumber);
    }

    return bedsData;
  }

  async getBookingsFromSheets(): Promise<SheetBooking[]> {
    if (!this.webappUrl) return [];

    try {
      const response = await fetch(`${this.webappUrl}?mode=rows`);
      const result = await response.json();
      
      return result.rows || [];

    } catch (error) {
      logger.error('Error fetching from Google Sheets:', error);
      return [];
    }
  }
}
