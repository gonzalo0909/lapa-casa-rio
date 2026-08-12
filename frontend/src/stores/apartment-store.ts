// lapa-casa-hostel/frontend/src/stores/apartment-store.ts

import { create } from 'zustand';
import { bookingAPI } from '@/lib/api';
import { toDateOnly, splitFullName } from '@/lib/utils';
import type { DateRange, ApartmentAvailability, GuestDetails } from '@/types/global';

interface CreateApartmentBookingParams {
  dateRange: DateRange;
  apartment: ApartmentAvailability;
  guestDetails: GuestDetails;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

interface ApartmentState {
  dateRange: DateRange | null;
  selectedApartment: ApartmentAvailability | null;
  guestDetails: GuestDetails | null;
  totalPrice: number | null;

  setDateRange: (range: DateRange) => void;
  setSelectedApartment: (apt: ApartmentAvailability | null) => void;
  setGuestDetails: (details: GuestDetails) => void;
  setTotalPrice: (price: number) => void;
  clearBooking: () => void;

  /** Crea la reserva de apartamento contra el backend y devuelve el ID. */
  createBooking: (params: CreateApartmentBookingParams) => Promise<string>;
}

export const useApartmentStore = create<ApartmentState>((set) => ({
  dateRange: null,
  selectedApartment: null,
  guestDetails: null,
  totalPrice: null,

  setDateRange: (range) => set({ dateRange: range, selectedApartment: null }),
  setSelectedApartment: (apt) => set({ selectedApartment: apt }),
  setGuestDetails: (details) => set({ guestDetails: details }),
  setTotalPrice: (price) => set({ totalPrice: price }),
  clearBooking: () =>
    set({ dateRange: null, selectedApartment: null, guestDetails: null, totalPrice: null }),

  createBooking: async ({ dateRange, apartment, guestDetails, locale = 'pt' }) => {
    if (!dateRange.checkIn || !dateRange.checkOut) {
      throw new Error('Fechas requeridas');
    }

    const { firstName, lastName } = splitFullName(guestDetails.fullName);

    const payload = {
      checkIn: toDateOnly(dateRange.checkIn),
      checkOut: toDateOnly(dateRange.checkOut),
      // 1 cama = la unidad completa del apartamento
      rooms: [{ roomId: apartment.id, bedsCount: 1 }],
      guest: {
        firstName,
        lastName,
        email: guestDetails.email,
        phone: guestDetails.phone,
        country: guestDetails.country,
        document: guestDetails.documentNumber,
      },
      specialRequests: guestDetails.specialRequests || '',
      arrivalTime: guestDetails.arrivalTime,
      language: locale,
      source: 'web',
      guestGender: 'mixed' as const,
    };

    const response = await bookingAPI.create(payload);
    const data = response?.data ?? response;
    const reservationId = data?.id ?? data?.reservationId ?? data?.booking?.id;
    if (!reservationId) throw new Error('No se recibió ID de reserva del servidor');

    return reservationId;
  },
}));
