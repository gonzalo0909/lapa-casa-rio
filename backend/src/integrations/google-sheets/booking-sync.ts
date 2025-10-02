// lapa-casa-hostel/backend/src/integrations/google-sheets/booking-sync.ts

import { sheetsClient } from './sheets-client';
import { logger } from '../../utils/logger';

interface SyncBookingData {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkInDate: Date;
  checkOutDate: Date;
  roomId: string;
  bedsCount: number;
  totalPrice: number;
  depositPaid: boolean;
  remainingPaid: boolean;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: Date;
  notes?: string;
}

export class BookingSync {
  private readonly ROOM_NAMES: Record<string, string> = {
    'room_mixto_12a': 'Mixto 12A',
    'room_mixto_12b': 'Mixto 12B',
    'room_mixto_7': 'Mixto 7',
    'room_flexible_7': 'Flexible 7'
  };

  async initialize(): Promise<void> {
    try {
      await sheetsClient.initialize();
      logger.info('BookingSync initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize BookingSync', { error });
      throw error;
    }
  }

  async syncBookingToSheet(booking: SyncBookingData): Promise<void> {
    try {
      const rowData = this.transformBookingToRow(booking);
      await sheetsClient.appendRow(rowData);
      
      logger.info('Booking synced to sheet', { bookingId: booking.id });
    } catch (error) {
      logger.error('Failed to sync booking to sheet', { 
        error, 
        bookingId: booking.id 
      });
      throw error;
    }
  }

  async updateBookingInSheet(
    bookingId: string, 
    updates: Partial<SyncBookingData>
  ): Promise<void> {
    try {
      const rowUpdates = this.transformBookingToRow(updates as SyncBookingData);
      await sheetsClient.updateRow(bookingId, rowUpdates);
      
      logger.info('Booking updated in sheet', { bookingId });
    } catch (error) {
      logger.error('Failed to update booking in sheet', { 
        error, 
        bookingId 
      });
      throw error;
    }
  }

  async deleteBookingFromSheet(bookingId: string): Promise<void> {
    try {
      await sheetsClient.deleteRow(bookingId);
      logger.info('Booking deleted from sheet', { bookingId });
    } catch (error) {
      logger.error('Failed to delete booking from sheet', { 
        error, 
        bookingId 
      });
      throw error;
    }
  }

  async markDepositPaid(bookingId: string): Promise<void> {
    try {
      await sheetsClient.updateRow(bookingId, {
        bookingId,
        depositPaid: true,
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        checkInDate: '',
        checkOutDate: '',
        roomAssigned: '',
        bedsCount: 0,
        totalPrice: 0,
        remainingPaid: false,
        status: 'CONFIRMED',
        createdDate: ''
      });
      
      logger.info('Deposit marked as paid in sheet', { bookingId });
    } catch (error) {
      logger.error('Failed to mark deposit as paid', { error, bookingId });
      throw error;
    }
  }

  async markRemainingPaid(bookingId: string): Promise<void> {
    try {
      await sheetsClient.updateRow(bookingId, {
        bookingId,
        remainingPaid: true,
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        checkInDate: '',
        checkOutDate: '',
        roomAssigned: '',
        bedsCount: 0,
        totalPrice: 0,
        depositPaid: false,
        status: 'CONFIRMED',
        createdDate: ''
      });
      
      logger.info('Remaining payment marked as paid in sheet', { bookingId });
    } catch (error) {
      logger.error('Failed to mark remaining as paid', { error, bookingId });
      throw error;
    }
  }

  async updateBookingStatus(
    bookingId: string, 
    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  ): Promise<void> {
    try {
      await sheetsClient.updateRow(bookingId, {
        bookingId,
        status,
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        checkInDate: '',
        checkOutDate: '',
        roomAssigned: '',
        bedsCount: 0,
        totalPrice: 0,
        depositPaid: false,
        remainingPaid: false,
        createdDate: ''
      });
      
      logger.info('Booking status updated in sheet', { bookingId, status });
    } catch (error) {
      logger.error('Failed to update booking status', { 
        error, 
        bookingId, 
        status 
      });
      throw error;
    }
  }

  async addNoteToBooking(bookingId: string, note: string): Promise<void> {
    try {
      await sheetsClient.updateRow(bookingId, {
        bookingId,
        notes: note,
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        checkInDate: '',
        checkOutDate: '',
        roomAssigned: '',
        bedsCount: 0,
        totalPrice: 0,
        depositPaid: false,
        remainingPaid: false,
        status: 'PENDING',
        createdDate: ''
      });
      
      logger.info('Note added to booking in sheet', { bookingId });
    } catch (error) {
      logger.error('Failed to add note to booking', { error, bookingId });
      throw error;
    }
  }

  async getAllBookingsFromSheet() {
    try {
      const bookings = await sheetsClient.getAllBookings();
      logger.info('Retrieved all bookings from sheet', { 
        count: bookings.length 
      });
      return bookings;
    } catch (error) {
      logger.error('Failed to get all bookings from sheet', { error });
      throw error;
    }
  }

  async syncBulkBookings(bookings: SyncBookingData[]): Promise<void> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ bookingId: string; error: any }>
    };

    for (const booking of bookings) {
      try {
        await this.syncBookingToSheet(booking);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ bookingId: booking.id, error });
      }
    }

    logger.info('Bulk booking sync completed', results);

    if (results.failed > 0) {
      logger.warn('Some bookings failed to sync', { 
        failed: results.failed,
        errors: results.errors 
      });
    }
  }

  private transformBookingToRow(booking: SyncBookingData | Partial<SyncBookingData>) {
    if (!booking.id) {
      throw new Error('Booking ID is required');
    }

    return {
      bookingId: booking.id,
      guestName: booking.guestName || '',
      guestEmail: booking.guestEmail || '',
      guestPhone: booking.guestPhone || '',
      checkInDate: booking.checkInDate 
        ? this.formatDate(booking.checkInDate) 
        : '',
      checkOutDate: booking.checkOutDate 
        ? this.formatDate(booking.checkOutDate) 
        : '',
      roomAssigned: booking.roomId 
        ? this.ROOM_NAMES[booking.roomId] || booking.roomId 
        : '',
      bedsCount: booking.bedsCount || 0,
      totalPrice: booking.totalPrice || 0,
      depositPaid: booking.depositPaid || false,
      remainingPaid: booking.remainingPaid || false,
      status: booking.status || 'PENDING',
      createdDate: booking.createdAt 
        ? this.formatDate(booking.createdAt) 
        : '',
      notes: booking.notes || ''
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async verifyBookingExists(bookingId: string): Promise<boolean> {
    try {
      const row = await sheetsClient.findRowByBookingId(bookingId);
      return row !== null;
    } catch (error) {
      logger.error('Error verifying booking exists', { error, bookingId });
      return false;
    }
  }

  async getBookingFromSheet(bookingId: string) {
    try {
      const allBookings = await sheetsClient.getAllBookings();
      return allBookings.find(b => b.bookingId === bookingId);
    } catch (error) {
      logger.error('Error getting booking from sheet', { error, bookingId });
      throw error;
    }
  }
}

export const bookingSync = new BookingSync();
