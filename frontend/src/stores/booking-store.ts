// src/stores/booking-store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Tipos para el estado de reservas
export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: 'mixed' | 'female';
  basePrice: number;
  isFlexible: boolean;
  available: number;
}

export interface BookingDates {
  checkIn: Date | null;
  checkOut: Date | null;
  nights: number;
}

export interface GuestInfo {
  name: string;
  email: string;
  phone: string;
  country: string;
  specialRequests: string;
  isGroupLeader: boolean;
}

export interface PricingBreakdown {
  basePrice: number;
  totalBeds: number;
  subtotal: number;
  groupDiscount: number;
  seasonMultiplier: number;
  finalPrice: number;
  depositAmount: number;
  remainingAmount: number;
}

export interface BookingState {
  // Datos de fechas
  dates: BookingDates;
  
  // Habitaciones y disponibilidad
  rooms: Room[];
  selectedRooms: Record<string, number>; // roomId -> bedCount
  totalBeds: number;
  
  // Información del huésped
  guestInfo: GuestInfo;
  
  // Precios y descuentos
  pricing: PricingBreakdown;
  
  // Estado del flujo
  currentStep: 'dates' | 'rooms' | 'guest' | 'payment' | 'confirmation';
  isLoading: boolean;
  errors: Record<string, string>;
  
  // Estado de pago
  paymentMethod: 'stripe' | 'mercado_pago' | null;
  paymentIntentId: string | null;
  
  // Acciones
  setDates: (checkIn: Date, checkOut: Date) => void;
  setRooms: (rooms: Room[]) => void;
  selectRoom: (roomId: string, bedCount: number) => void;
  removeRoom: (roomId: string) => void;
  setGuestInfo: (info: Partial<GuestInfo>) => void;
  setPricing: (pricing: PricingBreakdown) => void;
  setCurrentStep: (step: BookingState['currentStep']) => void;
  setPaymentMethod: (method: BookingState['paymentMethod']) => void;
  setPaymentIntentId: (id: string) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  setLoading: (loading: boolean) => void;
  calculateTotalBeds: () => void;
  resetBooking: () => void;
  canProceedToNextStep: () => boolean;
}

const initialState = {
  dates: {
    checkIn: null,
    checkOut: null,
    nights: 0,
  },
  rooms: [],
  selectedRooms: {},
  totalBeds: 0,
  guestInfo: {
    name: '',
    email: '',
    phone: '',
    country: 'BR',
    specialRequests: '',
    isGroupLeader: false,
  },
  pricing: {
    basePrice: 60,
    totalBeds: 0,
    subtotal: 0,
    groupDiscount: 0,
    seasonMultiplier: 1,
    finalPrice: 0,
    depositAmount: 0,
    remainingAmount: 0,
  },
  currentStep: 'dates' as const,
  isLoading: false,
  errors: {},
  paymentMethod: null,
  paymentIntentId: null,
};

export const useBookingStore = create<BookingState>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      setDates: (checkIn: Date, checkOut: Date) => {
        set((state) => {
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          state.dates = { checkIn, checkOut, nights };
        });
      },

      setRooms: (rooms: Room[]) => {
        set((state) => {
          state.rooms = rooms;
        });
      },

      selectRoom: (roomId: string, bedCount: number) => {
        set((state) => {
          if (bedCount > 0) {
            state.selectedRooms[roomId] = bedCount;
          } else {
            delete state.selectedRooms[roomId];
          }
        });
        get().calculateTotalBeds();
      },

      removeRoom: (roomId: string) => {
        set((state) => {
          delete state.selectedRooms[roomId];
        });
        get().calculateTotalBeds();
      },

      setGuestInfo: (info: Partial<GuestInfo>) => {
        set((state) => {
          state.guestInfo = { ...state.guestInfo, ...info };
        });
      },

      setPricing: (pricing: PricingBreakdown) => {
        set((state) => {
          state.pricing = pricing;
        });
      },

      setCurrentStep: (step: BookingState['currentStep']) => {
        set((state) => {
          state.currentStep = step;
        });
      },

      setPaymentMethod: (method: BookingState['paymentMethod']) => {
        set((state) => {
          state.paymentMethod = method;
        });
      },

      setPaymentIntentId: (id: string) => {
        set((state) => {
          state.paymentIntentId = id;
        });
      },

      setError: (field: string, error: string) => {
        set((state) => {
          state.errors[field] = error;
        });
      },

      clearError: (field: string) => {
        set((state) => {
          delete state.errors[field];
        });
      },

      setLoading: (loading: boolean) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      calculateTotalBeds: () => {
        set((state) => {
          state.totalBeds = Object.values(state.selectedRooms).reduce((sum, beds) => sum + beds, 0);
        });
      },

      resetBooking: () => {
        set((state) => {
          Object.assign(state, initialState);
        });
      },

      canProceedToNextStep: () => {
        const state = get();
        
        switch (state.currentStep) {
          case 'dates':
            return state.dates.checkIn && state.dates.checkOut && state.dates.nights > 0;
          
          case 'rooms':
            return state.totalBeds > 0;
          
          case 'guest':
            return state.guestInfo.name && 
                   state.guestInfo.email && 
                   state.guestInfo.phone &&
                   state.guestInfo.country;
          
          case 'payment':
            return state.paymentMethod && state.paymentIntentId;
          
          default:
            return false;
        }
      },
    })),
    {
      name: 'lapa-casa-booking-storage',
      partialize: (state) => ({
        dates: state.dates,
        selectedRooms: state.selectedRooms,
        totalBeds: state.totalBeds,
        guestInfo: state.guestInfo,
        pricing: state.pricing,
        currentStep: state.currentStep,
        paymentMethod: state.paymentMethod,
      }),
    }
  )
);

// Selectores útiles
export const useBookingDates = () => useBookingStore((state) => state.dates);
export const useSelectedRooms = () => useBookingStore((state) => state.selectedRooms);
export const useTotalBeds = () => useBookingStore((state) => state.totalBeds);
export const useGuestInfo = () => useBookingStore((state) => state.guestInfo);
export const usePricing = () => useBookingStore((state) => state.pricing);
export const useCurrentStep = () => useBookingStore((state) => state.currentStep);
export const useBookingErrors = () => useBookingStore((state) => state.errors);
export const useBookingLoading = () => useBookingStore((state) => state.isLoading);
export const usePaymentInfo = () => useBookingStore((state) => ({
  paymentMethod: state.paymentMethod,
  paymentIntentId: state.paymentIntentId,
}));
