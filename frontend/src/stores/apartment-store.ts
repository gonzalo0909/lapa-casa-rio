// lapa-casa-hostel/frontend/src/stores/apartment-store.ts
// Persiste en sessionStorage: el progreso sobrevive navegación dentro
// de la misma pestaña, pero se limpia al cerrar la pestaña/ventana.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { bookingAPI } from '@/lib/api';
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

/** Revive strings ISO-8601 como Date al rehidratar desde sessionStorage. */
const isoDateReviver = (_key: string, value: unknown): unknown => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value);
  }
  return value;
};

const aptStorage = createJSONStorage(() => sessionStorage, {
  reviver: isoDateReviver,
});

export const useApartmentStore = create<ApartmentState>()(
  persist(
    (set) => ({
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
          arrivalTime: guestDetails.arrivalTime || '15:00',
          language: locale,
          source: 'web',
          guestGender: 'mixed' as const,
        };

        const response = await bookingAPI.create(payload);
        const data = response?.data ?? response;
        const reservationId = data?.id ?? data?.reservationId ?? data?.booking?.id;
        if (!reservationId) { throw new Error('No se recibió ID de reserva del servidor'); }

        return reservationId;
      },
    }),
    {
      name: 'apt-booking',
      storage: aptStorage,
      // Solo persiste el estado de datos, no las acciones
      partialize: (state) => ({
        dateRange: state.dateRange,
        selectedApartment: state.selectedApartment,
        guestDetails: state.guestDetails,
        totalPrice: state.totalPrice,
      }),
    },
  ),
);
