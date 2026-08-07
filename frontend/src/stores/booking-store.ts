// lapa-casa-hostel/frontend/src/stores/booking-store.ts

import { create } from 'zustand';
import { bookingAPI } from '@/lib/api';
import type { DateRange, Room, GuestDetails } from '@/types/global';

interface CreateBookingParams {
  dateRange: DateRange;
  rooms: Room[];
  guestDetails: GuestDetails;
  totalPrice: number;
  locale?: 'pt' | 'es' | 'en';
}

interface BookingState {
  dateRange: DateRange | null;
  selectedRooms: Room[];
  guestDetails: GuestDetails | null;
  totalPrice: number | null;

  setDateRange: (range: DateRange) => void;
  setSelectedRooms: (rooms: Room[]) => void;
  setGuestDetails: (details: GuestDetails) => void;
  setTotalPrice: (price: number) => void;
  clearBooking: () => void;

  /** Crea la reserva real contra el backend y devuelve el ID. */
  createBooking: (params: CreateBookingParams) => Promise<string>;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || fullName,
    lastName: parts.slice(1).join(' ') || parts[0] || fullName,
  };
}

export const useBookingStore = create<BookingState>((set) => ({
  dateRange: null,
  selectedRooms: [],
  guestDetails: null,
  totalPrice: null,

  setDateRange: (range) => set({ dateRange: range }),
  setSelectedRooms: (rooms) => set({ selectedRooms: rooms }),
  setGuestDetails: (details) => set({ guestDetails: details }),
  setTotalPrice: (price) => set({ totalPrice: price }),
  clearBooking: () =>
    set({ dateRange: null, selectedRooms: [], guestDetails: null, totalPrice: null }),

  createBooking: async ({ dateRange, rooms, guestDetails, locale }) => {
    if (!dateRange.checkIn || !dateRange.checkOut) {
      throw new Error('Missing check-in/check-out dates');
    }

    const { firstName, lastName } = splitFullName(guestDetails.fullName);

    const response = await bookingAPI.create({
      checkIn: toDateOnly(dateRange.checkIn),
      checkOut: toDateOnly(dateRange.checkOut),
      rooms: rooms.map((r) => ({ roomId: r.id, bedsCount: r.bedsCount })),
      guest: {
        firstName,
        lastName,
        email: guestDetails.email,
        phone: guestDetails.phone,
        country: guestDetails.country,
        document: guestDetails.documentNumber,
      },
      specialRequests: guestDetails.specialRequests,
      language: locale,
      source: 'direct',
    });

    return response.data.booking.id as string;
  },
}));
