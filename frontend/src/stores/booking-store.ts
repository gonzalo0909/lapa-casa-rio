// lapa-casa-hostel/frontend/src/stores/booking-store.ts

import { create } from 'zustand';
import { bookingAPI } from '@/lib/api';
import { toDateOnly, splitFullName } from '@/lib/utils';
import type { DateRange, Room, GuestDetails, BookingGender } from '@/types/global';

interface CreateBookingParams {
  dateRange: DateRange;
  rooms: Room[];
  guestDetails: GuestDetails;
  totalPrice: number;
  gender: BookingGender;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

interface BookingState {
  dateRange: DateRange | null;
  gender: BookingGender;
  selectedRooms: Room[];
  guestDetails: GuestDetails | null;
  totalPrice: number | null;

  setDateRange: (range: DateRange) => void;
  setGender: (gender: BookingGender) => void;
  setSelectedRooms: (rooms: Room[]) => void;
  setGuestDetails: (details: GuestDetails) => void;
  setTotalPrice: (price: number) => void;
  clearBooking: () => void;

  /** Crea la reserva real contra el backend y devuelve el ID. */
  createBooking: (params: CreateBookingParams) => Promise<string>;
}

export const useBookingStore = create<BookingState>((set) => ({
  dateRange: null,
  gender: 'mixed',
  selectedRooms: [],
  guestDetails: null,
  totalPrice: null,

  setDateRange: (range) => set({ dateRange: range }),
  setGender: (gender) => set({ gender, selectedRooms: [] }),
  setSelectedRooms: (rooms) => set({ selectedRooms: rooms }),
  setGuestDetails: (details) => set({ guestDetails: details }),
  setTotalPrice: (price) => set({ totalPrice: price }),
  clearBooking: () =>
    set({ dateRange: null, gender: 'mixed', selectedRooms: [], guestDetails: null, totalPrice: null }),

  createBooking: async ({ dateRange, rooms, guestDetails, gender, locale }) => {
    if (!dateRange.checkIn || !dateRange.checkOut) {
      throw new Error('Missing check-in/check-out dates');
    }

    const { firstName, lastName } = splitFullName(guestDetails.fullName);

    const response = await bookingAPI.create({
      checkIn: toDateOnly(dateRange.checkIn),
      checkOut: toDateOnly(dateRange.checkOut),
      rooms: rooms.map((r) => ({ roomId: r.id, bedsCount: r.bedsCount, preferredBedIds: r.preferredBedIds })),
      guest: {
        firstName,
        lastName,
        email: guestDetails.email,
        phone: guestDetails.phone,
        country: guestDetails.country,
        document: guestDetails.documentNumber,
      },
      specialRequests: guestDetails.specialRequests,
      arrivalTime: guestDetails.arrivalTime,
      language: locale,
      source: 'direct',
      guestGender: gender,
    });

    return response.data.booking.id as string;
  },
}));
