// lapa-casa-hostel/frontend/src/stores/payment-store.ts

import { create } from 'zustand';

export interface PaymentData {
  bookingId: string;
  amount: number;
  currency: 'BRL' | 'USD';
  depositAmount: number;
  remainingAmount: number;
  guestEmail: string;
  guestName: string;
  checkInDate: string;
}

interface PaymentState {
  paymentData: PaymentData | null;
  setPaymentData: (data: PaymentData) => void;
  clearPaymentData: () => void;
}

export const usePaymentStore = create<PaymentState>((set) => ({
  paymentData: null,
  setPaymentData: (data) => set({ paymentData: data }),
  clearPaymentData: () => set({ paymentData: null }),
}));
