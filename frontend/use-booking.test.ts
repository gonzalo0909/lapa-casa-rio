// lapa-casa-hostel/tests/frontend/use-booking.test.ts

import { renderHook, act, waitFor } from '@testing-library/react';
import { useBooking } from '@/hooks/use-booking';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

/**
 * @fileoverview Test suite for useBooking hook
 * Tests booking state management, API interactions, and edge cases
 */

describe('useBooking Hook', () => {
  const mockBookingData = {
    checkIn: '2025-06-01',
    checkOut: '2025-06-05',
    rooms: [
      { id: 'room_mixto_12a', beds: 8 }
    ],
    guest: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+5521999999999'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('initializes with default state', () => {
      const { result } = renderHook(() => useBooking());

      expect(result.current.booking).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.step).toBe('dates');
    });

    test('initializes with provided initial data', () => {
      const initialData = { checkIn: '2025-06-01', checkOut: '2025-06-05' };
      const { result } = renderHook(() => useBooking(initialData));

      expect(result.current.booking).toEqual(initialData);
    });
  });

  describe('setDates', () => {
    test('updates check-in and check-out dates', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
      });

      act(() => {
        result.current.setGuest({
          name: 'Jane Smith',
          email: 'invalid-email',
          phone: '+5521988888888'
        });
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toMatch(/invalid.*email/i);
    });

    test('validates phone format', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
      });

      act(() => {
        result.current.setGuest({
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '123'
        });
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toMatch(/invalid.*phone/i);
    });

    test('advances to payment step after valid guest', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
        result.current.setGuest({
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+5521988888888'
        });
      });

      expect(result.current.step).toBe('payment');
    });
  });

  describe('createBooking', () => {
    test('creates booking successfully', async () => {
      const mockResponse = {
        id: 'booking_123',
        status: 'confirmed',
        ...mockBookingData
      };

      (api.createBooking as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
        result.current.setGuest({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+5521999999999'
        });
      });

      await act(async () => {
        await result.current.createBooking();
      });

      expect(api.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          checkIn: '2025-06-01',
          checkOut: '2025-06-05'
        })
      );

      expect(result.current.booking?.id).toBe('booking_123');
      expect(result.current.isLoading).toBe(false);
    });

    test('sets loading state during creation', async () => {
      (api.createBooking as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
        result.current.setGuest({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+5521999999999'
        });
      });

      act(() => {
        result.current.createBooking();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    test('handles API errors', async () => {
      (api.createBooking as jest.Mock).mockRejectedValue(
        new Error('Booking creation failed')
      );

      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
        result.current.setGuest({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+5521999999999'
        });
      });

      await act(async () => {
        await result.current.createBooking();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toMatch(/creation failed/i);
      expect(result.current.isLoading).toBe(false);
    });

    test('validates booking data before creation', async () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
      });

      await act(async () => {
        await result.current.createBooking();
      });

      expect(result.current.error).toBeTruthy();
      expect(api.createBooking).not.toHaveBeenCalled();
    });
  });

  describe('calculatePrice', () => {
    test('calculates base price correctly', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 1 }]);
      });

      const price = result.current.calculatePrice();

      // 1 bed × 4 nights × R$60 × 0.80 (low season) = R$192
      expect(price.total).toBe(192.00);
      expect(price.basePrice).toBe(240.00);
      expect(price.seasonMultiplier).toBe(0.80);
    });

    test('applies group discount for 7+ beds', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
      });

      const price = result.current.calculatePrice();

      expect(price.groupDiscount).toBe(0.10);
      expect(price.total).toBe(1382.40); // 8×4×60×0.80×0.90
    });

    test('applies carnival pricing', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2026-02-14', '2026-02-19');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 2 }]);
      });

      const price = result.current.calculatePrice();

      expect(price.seasonMultiplier).toBe(2.00);
      expect(price.total).toBe(1200.00); // 2×5×60×2.00
    });

    test('calculates deposit amount (30% standard)', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 5 }]);
      });

      const price = result.current.calculatePrice();

      expect(price.depositAmount).toBe(price.total * 0.30);
      expect(price.remainingAmount).toBe(price.total * 0.70);
    });

    test('calculates deposit amount (50% large group)', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([
          { id: 'room_mixto_12a', beds: 12 },
          { id: 'room_mixto_7', beds: 7 }
        ]);
      });

      const price = result.current.calculatePrice();

      expect(price.depositAmount).toBe(price.total * 0.50);
      expect(price.remainingAmount).toBe(price.total * 0.50);
    });
  });

  describe('Navigation', () => {
    test('allows going back to previous step', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
      });

      expect(result.current.step).toBe('guest');

      act(() => {
        result.current.goBack();
      });

      expect(result.current.step).toBe('rooms');

      act(() => {
        result.current.goBack();
      });

      expect(result.current.step).toBe('dates');
    });

    test('does not go back from first step', () => {
      const { result } = renderHook(() => useBooking());

      expect(result.current.step).toBe('dates');

      act(() => {
        result.current.goBack();
      });

      expect(result.current.step).toBe('dates');
    });

    test('resets form', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
        result.current.setGuest({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+5521999999999'
        });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.booking).toBeNull();
      expect(result.current.step).toBe('dates');
      expect(result.current.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('clears error on successful action', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-05', '2025-07-01');
      });

      expect(result.current.error).toBeTruthy();

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
      });

      expect(result.current.error).toBeNull();
    });

    test('preserves data on validation error', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
      });

      act(() => {
        result.current.setGuest({
          name: '',
          email: 'john@example.com',
          phone: '+5521999999999'
        });
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.booking?.rooms).toBeDefined();
      expect(result.current.booking?.checkIn).toBe('2025-06-01');
    });
  });

  describe('Edge Cases', () => {
    test('handles concurrent updates', async () => {
      const { result } = renderHook(() => useBooking());

      await act(async () => {
        result.current.setDates('2025-06-01', '2025-06-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
        result.current.setGuest({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+5521999999999'
        });
      });

      expect(result.current.step).toBe('payment');
      expect(result.current.booking?.guest.name).toBe('John Doe');
    });

    test('validates carnival minimum nights', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2026-02-14', '2026-02-16');
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toMatch(/minimum.*5.*nights/i);
    });

    test('handles undefined booking data', () => {
      const { result } = renderHook(() => useBooking());

      const price = result.current.calculatePrice();

      expect(price.total).toBe(0);
      expect(price.depositAmount).toBe(0);
    });
  });
});
        result.current.setDates('2025-07-01', '2025-07-05');
      });

      expect(result.current.booking?.checkIn).toBe('2025-07-01');
      expect(result.current.booking?.checkOut).toBe('2025-07-05');
    });

    test('validates check-out after check-in', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-05', '2025-07-01');
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toMatch(/check-out.*after.*check-in/i);
    });

    test('prevents dates in the past', () => {
      const { result } = renderHook(() => useBooking());

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      act(() => {
        result.current.setDates(
          yesterday.toISOString().split('T')[0],
          '2025-07-05'
        );
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toMatch(/past/i);
    });

    test('advances to rooms step after valid dates', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
      });

      expect(result.current.step).toBe('rooms');
    });
  });

  describe('setRooms', () => {
    test('updates selected rooms', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
      });

      act(() => {
        result.current.setRooms([
          { id: 'room_mixto_12a', beds: 8 },
          { id: 'room_mixto_7', beds: 5 }
        ]);
      });

      expect(result.current.booking?.rooms).toHaveLength(2);
      expect(result.current.booking?.rooms[0].beds).toBe(8);
    });

    test('validates at least one room selected', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
      });

      act(() => {
        result.current.setRooms([]);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toMatch(/select.*room/i);
    });

    test('validates at least one bed per room', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
      });

      act(() => {
        result.current.setRooms([
          { id: 'room_mixto_12a', beds: 0 }
        ]);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toMatch(/at least one bed/i);
    });

    test('advances to guest step after valid rooms', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
      });

      act(() => {
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
      });

      expect(result.current.step).toBe('guest');
    });
  });

  describe('setGuest', () => {
    test('updates guest information', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
      });

      act(() => {
        result.current.setGuest({
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+5521988888888'
        });
      });

      expect(result.current.booking?.guest.name).toBe('Jane Smith');
      expect(result.current.booking?.guest.email).toBe('jane@example.com');
    });

    test('validates required fields', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
        result.current.setDates('2025-07-01', '2025-07-05');
        result.current.setRooms([{ id: 'room_mixto_12a', beds: 8 }]);
      });

      act(() => {
        result.current.setGuest({
          name: '',
          email: 'jane@example.com',
          phone: '+5521988888888'
        });
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toMatch(/name.*required/i);
    });

    test('validates email format', () => {
      const { result } = renderHook(() => useBooking());

      act(() => {
