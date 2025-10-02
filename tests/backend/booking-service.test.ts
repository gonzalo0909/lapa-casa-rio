// lapa-casa-hostel/tests/backend/booking-service.test.ts

import { BookingService } from '@/services/booking-service';
import { BookingRepository } from '@/database/repositories/booking-repository';
import { AvailabilityService } from '@/services/availability-service';
import { PricingService } from '@/services/pricing-service';
import { EmailService } from '@/services/email-service';

jest.mock('@/database/repositories/booking-repository');
jest.mock('@/services/availability-service');
jest.mock('@/services/pricing-service');
jest.mock('@/services/email-service');

/**
 * @fileoverview Test suite for BookingService
 * Tests booking creation, validation, updates, cancellations, and business logic
 */

describe('BookingService', () => {
  let bookingService: BookingService;
  let mockBookingRepository: jest.Mocked<BookingRepository>;
  let mockAvailabilityService: jest.Mocked<AvailabilityService>;
  let mockPricingService: jest.Mocked<PricingService>;
  let mockEmailService: jest.Mocked<EmailService>;

  const mockBookingData = {
    checkIn: '2025-07-01',
    checkOut: '2025-07-05',
    rooms: [
      { roomId: 'room_mixto_12a', beds: 8 }
    ],
    guest: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+5521999999999',
      country: 'BR'
    },
    specialRequests: 'Late check-in'
  };

  beforeEach(() => {
    mockBookingRepository = new BookingRepository() as jest.Mocked<BookingRepository>;
    mockAvailabilityService = new AvailabilityService() as jest.Mocked<AvailabilityService>;
    mockPricingService = new PricingService() as jest.Mocked<PricingService>;
    mockEmailService = new EmailService() as jest.Mocked<EmailService>;

    bookingService = new BookingService(
      mockBookingRepository,
      mockAvailabilityService,
      mockPricingService,
      mockEmailService
    );

    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    test('creates booking successfully', async () => {
      mockAvailabilityService.checkAvailability.mockResolvedValue({
        available: true,
        rooms: [{ id: 'room_mixto_12a', available: 12 }]
      });

      mockPricingService.calculatePrice.mockReturnValue({
        total: 1382.40,
        basePrice: 1920.00,
        depositAmount: 414.72,
        remainingAmount: 967.68
      });

      mockBookingRepository.create.mockResolvedValue({
        id: 'booking_123',
        status: 'PENDING',
        ...mockBookingData,
        totalAmount: 1382.40,
        depositAmount: 414.72,
        createdAt: new Date()
      });

      const result = await bookingService.createBooking(mockBookingData);

      expect(result.id).toBe('booking_123');
      expect(result.status).toBe('PENDING');
      expect(mockAvailabilityService.checkAvailability).toHaveBeenCalled();
      expect(mockPricingService.calculatePrice).toHaveBeenCalled();
      expect(mockBookingRepository.create).toHaveBeenCalled();
      expect(mockEmailService.sendBookingConfirmation).toHaveBeenCalled();
    });

    test('validates check-in before check-out', async () => {
      const invalidData = {
        ...mockBookingData,
        checkIn: '2025-07-05',
        checkOut: '2025-07-01'
      };

      await expect(bookingService.createBooking(invalidData))
        .rejects.toThrow('Check-out must be after check-in');

      expect(mockBookingRepository.create).not.toHaveBeenCalled();
    });

    test('validates dates not in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const invalidData = {
        ...mockBookingData,
        checkIn: pastDate.toISOString().split('T')[0]
      };

      await expect(bookingService.createBooking(invalidData))
        .rejects.toThrow('Check-in date cannot be in the past');
    });

    test('validates carnival minimum nights', async () => {
      const invalidData = {
        ...mockBookingData,
        checkIn: '2026-02-14',
        checkOut: '2026-02-16'
      };

      await expect(bookingService.createBooking(invalidData))
        .rejects.toThrow('Carnival bookings require minimum 5 nights');
    });

    test('validates room availability', async () => {
      mockAvailabilityService.checkAvailability.mockResolvedValue({
        available: false,
        rooms: []
      });

      await expect(bookingService.createBooking(mockBookingData))
        .rejects.toThrow('No rooms available for selected dates');

      expect(mockBookingRepository.create).not.toHaveBeenCalled();
    });

    test('validates at least one room selected', async () => {
      const invalidData = {
        ...mockBookingData,
        rooms: []
      };

      await expect(bookingService.createBooking(invalidData))
        .rejects.toThrow('At least one room must be selected');
    });

    test('validates guest information', async () => {
      const invalidData = {
        ...mockBookingData,
        guest: {
          name: '',
          email: 'invalid-email',
          phone: '123',
          country: 'BR'
        }
      };

      await expect(bookingService.createBooking(invalidData))
        .rejects.toThrow('Invalid guest information');
    });

    test('handles database errors gracefully', async () => {
      mockAvailabilityService.checkAvailability.mockResolvedValue({
        available: true,
        rooms: [{ id: 'room_mixto_12a', available: 12 }]
      });

      mockPricingService.calculatePrice.mockReturnValue({
        total: 1382.40,
        depositAmount: 414.72
      });

      mockBookingRepository.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(bookingService.createBooking(mockBookingData))
        .rejects.toThrow('Database connection failed');
    });

    test('applies correct deposit percentage for standard booking', async () => {
      mockAvailabilityService.checkAvailability.mockResolvedValue({
        available: true,
        rooms: [{ id: 'room_mixto_12a', available: 12 }]
      });

      mockPricingService.calculatePrice.mockReturnValue({
        total: 1000.00,
        depositAmount: 300.00,
        depositPercentage: 0.30
      });

      mockBookingRepository.create.mockResolvedValue({
        id: 'booking_123',
        ...mockBookingData,
        totalAmount: 1000.00,
        depositAmount: 300.00
      });

      const result = await bookingService.createBooking(mockBookingData);

      expect(result.depositAmount).toBe(300.00);
    });

    test('applies correct deposit percentage for large groups', async () => {
      const largeGroupData = {
        ...mockBookingData,
        rooms: [
          { roomId: 'room_mixto_12a', beds: 12 },
          { roomId: 'room_mixto_7', beds: 7 }
        ]
      };

      mockAvailabilityService.checkAvailability.mockResolvedValue({
        available: true,
        rooms: [
          { id: 'room_mixto_12a', available: 12 },
          { id: 'room_mixto_7', available: 7 }
        ]
      });

      mockPricingService.calculatePrice.mockReturnValue({
        total: 2000.00,
        depositAmount: 1000.00,
        depositPercentage: 0.50
      });

      mockBookingRepository.create.mockResolvedValue({
        id: 'booking_123',
        ...largeGroupData,
        totalAmount: 2000.00,
        depositAmount: 1000.00
      });

      const result = await bookingService.createBooking(largeGroupData);

      expect(result.depositAmount).toBe(1000.00);
    });
  });

  describe('getBooking', () => {
    test('retrieves booking by ID', async () => {
      const mockBooking = {
        id: 'booking_123',
        status: 'CONFIRMED',
        ...mockBookingData
      };

      mockBookingRepository.findById.mockResolvedValue(mockBooking);

      const result = await bookingService.getBooking('booking_123');

      expect(result).toEqual(mockBooking);
      expect(mockBookingRepository.findById).toHaveBeenCalledWith('booking_123');
    });

    test('throws error when booking not found', async () => {
      mockBookingRepository.findById.mockResolvedValue(null);

      await expect(bookingService.getBooking('nonexistent'))
        .rejects.toThrow('Booking not found');
    });
  });

  describe('updateBooking', () => {
    test('updates booking successfully', async () => {
      const existingBooking = {
        id: 'booking_123',
        status: 'PENDING',
        ...mockBookingData
      };

      const updateData = {
        specialRequests: 'Updated request'
      };

      mockBookingRepository.findById.mockResolvedValue(existingBooking);
      mockBookingRepository.update.mockResolvedValue({
        ...existingBooking,
        ...updateData
      });

      const result = await bookingService.updateBooking('booking_123', updateData);

      expect(result.specialRequests).toBe('Updated request');
      expect(mockBookingRepository.update).toHaveBeenCalledWith('booking_123', updateData);
    });

    test('prevents updating confirmed bookings', async () => {
      const confirmedBooking = {
        id: 'booking_123',
        status: 'CONFIRMED',
        ...mockBookingData
      };

      mockBookingRepository.findById.mockResolvedValue(confirmedBooking);

      await expect(bookingService.updateBooking('booking_123', { specialRequests: 'New' }))
        .rejects.toThrow('Cannot update confirmed booking');
    });

    test('validates availability for date changes', async () => {
      const existingBooking = {
        id: 'booking_123',
        status: 'PENDING',
        ...mockBookingData
      };

      const updateData = {
        checkIn: '2025-08-01',
        checkOut: '2025-08-05'
      };

      mockBookingRepository.findById.mockResolvedValue(existingBooking);
      mockAvailabilityService.checkAvailability.mockResolvedValue({
        available: false,
        rooms: []
      });

      await expect(bookingService.updateBooking('booking_123', updateData))
        .rejects.toThrow('No availability for new dates');
    });
  });

  describe('cancelBooking', () => {
    test('cancels booking successfully', async () => {
      const existingBooking = {
        id: 'booking_123',
        status: 'CONFIRMED',
        ...mockBookingData,
        depositPaid: true
      };

      mockBookingRepository.findById.mockResolvedValue(existingBooking);
      mockBookingRepository.update.mockResolvedValue({
        ...existingBooking,
        status: 'CANCELLED'
      });

      const result = await bookingService.cancelBooking('booking_123');

      expect(result.status).toBe('CANCELLED');
      expect(mockEmailService.sendCancellationEmail).toHaveBeenCalled();
    });

    test('calculates refund amount based on cancellation policy', async () => {
      const existingBooking = {
        id: 'booking_123',
        status: 'CONFIRMED',
        checkIn: '2025-07-15',
        depositAmount: 400.00,
        depositPaid: true
      };

      mockBookingRepository.findById.mockResolvedValue(existingBooking);

      // Cancel 10 days before check-in (full refund)
      const mockDate = new Date('2025-07-05');
      jest.useFakeTimers().setSystemTime(mockDate);

      const result = await bookingService.cancelBooking('booking_123');

      expect(result.refundAmount).toBe(400.00);
      expect(result.refundPercentage).toBe(1.00);

      jest.useRealTimers();
    });

    test('applies cancellation fees for late cancellations', async () => {
      const existingBooking = {
        id: 'booking_123',
        status: 'CONFIRMED',
        checkIn: '2025-07-05',
        depositAmount: 400.00,
        depositPaid: true
      };

      mockBookingRepository.findById.mockResolvedValue(existingBooking);

      // Cancel 2 days before check-in (50% refund)
      const mockDate = new Date('2025-07-03');
      jest.useFakeTimers().setSystemTime(mockDate);

      const result = await bookingService.cancelBooking('booking_123');

      expect(result.refundAmount).toBe(200.00);
      expect(result.refundPercentage).toBe(0.50);

      jest.useRealTimers();
    });

    test('prevents cancelling already cancelled bookings', async () => {
      const cancelledBooking = {
        id: 'booking_123',
        status: 'CANCELLED'
      };

      mockBookingRepository.findById.mockResolvedValue(cancelledBooking);

      await expect(bookingService.cancelBooking('booking_123'))
        .rejects.toThrow('Booking already cancelled');
    });
  });

  describe('confirmBooking', () => {
    test('confirms booking after deposit payment', async () => {
      const pendingBooking = {
        id: 'booking_123',
        status: 'PENDING',
        ...mockBookingData,
        depositPaid: false
      };

      mockBookingRepository.findById.mockResolvedValue(pendingBooking);
      mockBookingRepository.update.mockResolvedValue({
        ...pendingBooking,
        status: 'CONFIRMED',
        depositPaid: true
      });

      const result = await bookingService.confirmBooking('booking_123', 'payment_123');

      expect(result.status).toBe('CONFIRMED');
      expect(result.depositPaid).toBe(true);
      expect(mockEmailService.sendBookingConfirmation).toHaveBeenCalled();
    });

    test('prevents double confirmation', async () => {
      const confirmedBooking = {
        id: 'booking_123',
        status: 'CONFIRMED',
        depositPaid: true
      };

      mockBookingRepository.findById.mockResolvedValue(confirmedBooking);

      await expect(bookingService.confirmBooking('booking_123', 'payment_123'))
        .rejects.toThrow('Booking already confirmed');
    });
  });

  describe('listBookings', () => {
    test('lists bookings with filters', async () => {
      const mockBookings = [
        { id: 'booking_1', status: 'CONFIRMED', checkIn: '2025-07-01' },
        { id: 'booking_2', status: 'CONFIRMED', checkIn: '2025-07-15' }
      ];

      mockBookingRepository.findMany.mockResolvedValue(mockBookings);

      const result = await bookingService.listBookings({
        status: 'CONFIRMED',
        fromDate: '2025-07-01',
        toDate: '2025-07-31'
      });

      expect(result).toHaveLength(2);
      expect(mockBookingRepository.findMany).toHaveBeenCalledWith({
        status: 'CONFIRMED',
        fromDate: '2025-07-01',
        toDate: '2025-07-31'
      });
    });

    test('lists bookings with pagination', async () => {
      const mockBookings = Array(10).fill(null).map((_, i) => ({
        id: `booking_${i}`,
        status: 'CONFIRMED'
      }));

      mockBookingRepository.findMany.mockResolvedValue(mockBookings);

      const result = await bookingService.listBookings({
        page: 1,
        limit: 10
      });

      expect(result).toHaveLength(10);
    });
  });

  describe('Flexible Room Logic', () => {
    test('auto-converts flexible room 48h before check-in', async () => {
      const flexibleRoomBooking = {
        ...mockBookingData,
        checkIn: '2025-07-03',
        rooms: [{ roomId: 'room_flexible_7', beds: 7 }]
      };

      const mockDate = new Date('2025-07-01');
      jest.useFakeTimers().setSystemTime(mockDate);

      mockAvailabilityService.checkAvailability.mockResolvedValue({
        available: true,
        rooms: [{
          id: 'room_flexible_7',
          type: 'mixed',
          available: 7,
          wasConverted: true
        }]
      });

      mockPricingService.calculatePrice.mockReturnValue({
        total: 1000.00,
        depositAmount: 300.00
      });

      mockBookingRepository.create.mockResolvedValue({
        id: 'booking_123',
        ...flexibleRoomBooking,
        roomType: 'mixed'
      });

      const result = await bookingService.createBooking(flexibleRoomBooking);

      expect(result.roomType).toBe('mixed');

      jest.useRealTimers();
    });
  });

  describe('Integration Tests', () => {
    test('complete booking flow end-to-end', async () => {
      // Step 1: Create booking
      mockAvailabilityService.checkAvailability.mockResolvedValue({
        available: true,
        rooms: [{ id: 'room_mixto_12a', available: 12 }]
      });

      mockPricingService.calculatePrice.mockReturnValue({
        total: 1382.40,
        depositAmount: 414.72
      });

      mockBookingRepository.create.mockResolvedValue({
        id: 'booking_123',
        status: 'PENDING',
        ...mockBookingData
      });

      const booking = await bookingService.createBooking(mockBookingData);
      expect(booking.status).toBe('PENDING');

      // Step 2: Confirm booking
      mockBookingRepository.findById.mockResolvedValue(booking);
      mockBookingRepository.update.mockResolvedValue({
        ...booking,
        status: 'CONFIRMED',
        depositPaid: true
      });

      const confirmed = await bookingService.confirmBooking('booking_123', 'payment_123');
      expect(confirmed.status).toBe('CONFIRMED');

      // Step 3: Cancel booking
      mockBookingRepository.findById.mockResolvedValue(confirmed);
      mockBookingRepository.update.mockResolvedValue({
        ...confirmed,
        status: 'CANCELLED'
      });

      const cancelled = await bookingService.cancelBooking('booking_123');
      expect(cancelled.status).toBe('CANCELLED');
    });
  });
});
