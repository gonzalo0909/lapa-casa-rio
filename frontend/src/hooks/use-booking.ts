// lapa-casa-hostel-frontend/src/hooks/use-booking.ts

import { useState, useCallback, useEffect } from 'react';
import { useBookingStore } from '@/stores/booking-store';
import { usePaymentStore } from '@/stores/payment-store';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface UseBookingProps {
  initialData?: Partial<BookingData>;
}

interface BookingData {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountry: string;
  checkInDate: Date;
  checkOutDate: Date;
  roomId: string;
  bedsCount: number;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  paymentMethod: 'stripe' | 'mercadopago';
  specialRequests?: string;
}

interface BookingState {
  isLoading: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
  currentStep: number;
  maxSteps: number;
}

export const useBooking = ({ initialData }: UseBookingProps = {}) => {
  // Store hooks
  const {
    bookingData,
    updateBookingData,
    clearBookingData,
    validateBookingData
  } = useBookingStore();

  const {
    paymentStatus,
    processPayment,
    clearPaymentData
  } = usePaymentStore();

  // Local state
  const [state, setState] = useState<BookingState>({
    isLoading: false,
    isSubmitting: false,
    errors: {},
    currentStep: 1,
    maxSteps: 4
  });

  // Initialize booking data
  useEffect(() => {
    if (initialData) {
      updateBookingData(initialData);
    }
  }, [initialData, updateBookingData]);

  // Update booking field
  const updateField = useCallback((field: keyof BookingData, value: any) => {
    updateBookingData({ [field]: value });
    
    // Clear field-specific error
    if (state.errors[field]) {
      setState(prev => ({
        ...prev,
        errors: { ...prev.errors, [field]: '' }
      }));
    }
  }, [updateBookingData, state.errors]);

  // Validate current step
  const validateCurrentStep = useCallback((): boolean => {
    const { currentStep } = state;
    const errors: Record<string, string> = {};

    switch (currentStep) {
      case 1: // Fechas y habitación
        if (!bookingData.checkInDate) {
          errors.checkInDate = 'Selecciona fecha de entrada';
        }
        if (!bookingData.checkOutDate) {
          errors.checkOutDate = 'Selecciona fecha de salida';
        }
        if (!bookingData.roomId) {
          errors.roomId = 'Selecciona una habitación';
        }
        if (!bookingData.bedsCount || bookingData.bedsCount < 1) {
          errors.bedsCount = 'Selecciona número de camas';
        }
        break;

      case 2: // Información del huésped
        if (!bookingData.guestName?.trim()) {
          errors.guestName = 'Nombre es obligatorio';
        }
        if (!bookingData.guestEmail?.trim()) {
          errors.guestEmail = 'Email es obligatorio';
        } else if (!/\S+@\S+\.\S+/.test(bookingData.guestEmail)) {
          errors.guestEmail = 'Email no válido';
        }
        if (!bookingData.guestPhone?.trim()) {
          errors.guestPhone = 'Teléfono es obligatorio';
        }
        break;

      case 3: // Método de pago
        if (!bookingData.paymentMethod) {
          errors.paymentMethod = 'Selecciona método de pago';
        }
        break;

      case 4: // Confirmación
        // Validation handled by previous steps
        break;
    }

    setState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  }, [state.currentStep, bookingData]);

  // Navigate to next step
  const nextStep = useCallback(async () => {
    if (!validateCurrentStep()) {
      toast.error('Por favor corrige los errores antes de continuar');
      return false;
    }

    setState(prev => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, prev.maxSteps)
    }));

    return true;
  }, [validateCurrentStep]);

  // Navigate to previous step
  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
      errors: {}
    }));
  }, []);

  // Jump to specific step
  const goToStep = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, Math.min(step, prev.maxSteps)),
      errors: {}
    }));
  }, []);

  // Check availability
  const checkAvailability = useCallback(async () => {
    if (!bookingData.checkInDate || !bookingData.checkOutDate) {
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await api.post('/availability/check', {
        checkInDate: bookingData.checkInDate.toISOString(),
        checkOutDate: bookingData.checkOutDate.toISOString(),
        bedsCount: bookingData.bedsCount
      });

      if (!response.data.available) {
        toast.error('No hay disponibilidad para estas fechas');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking availability:', error);
      toast.error('Error verificando disponibilidad');
      return false;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [bookingData.checkInDate, bookingData.checkOutDate, bookingData.bedsCount]);

  // Submit booking
  const submitBooking = useCallback(async () => {
    if (!validateBookingData(bookingData)) {
      toast.error('Datos de reserva incompletos');
      return false;
    }

    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      // First create booking
      const bookingResponse = await api.post('/bookings/create', {
        guestName: bookingData.guestName,
        guestEmail: bookingData.guestEmail,
        guestPhone: bookingData.guestPhone,
        guestCountry: bookingData.guestCountry,
        checkInDate: bookingData.checkInDate?.toISOString(),
        checkOutDate: bookingData.checkOutDate?.toISOString(),
        roomId: bookingData.roomId,
        bedsCount: bookingData.bedsCount,
        totalPrice: bookingData.totalPrice,
        depositAmount: bookingData.depositAmount,
        remainingAmount: bookingData.remainingAmount,
        specialRequests: bookingData.specialRequests
      });

      const booking = bookingResponse.data;

      // Process deposit payment
      const paymentResult = await processPayment({
        bookingId: booking.id,
        amount: bookingData.depositAmount,
        currency: 'BRL',
        paymentMethod: bookingData.paymentMethod,
        description: `Depósito reserva Lapa Casa Hostel - ${booking.id}`
      });

      if (paymentResult.success) {
        toast.success('Reserva confirmada exitosamente');
        
        // Clear booking data after successful submission
        setTimeout(() => {
          clearBookingData();
          clearPaymentData();
        }, 2000);

        return { success: true, booking, paymentId: paymentResult.paymentId };
      } else {
        toast.error('Error procesando el pago: ' + paymentResult.error);
        return { success: false, error: paymentResult.error };
      }
    } catch (error: any) {
      console.error('Error submitting booking:', error);
      const errorMessage = error.response?.data?.message || 'Error procesando la reserva';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [bookingData, validateBookingData, processPayment, clearBookingData, clearPaymentData]);

  // Calculate pricing
  const calculatePricing = useCallback(() => {
    const { checkInDate, checkOutDate, bedsCount } = bookingData;

    if (!checkInDate || !checkOutDate || !bedsCount) {
      return {
        basePrice: 0,
        totalNights: 0,
        subtotal: 0,
        groupDiscount: 0,
        seasonMultiplier: 1,
        totalPrice: 0,
        depositAmount: 0,
        remainingAmount: 0
      };
    }

    const totalNights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const basePrice = 60; // BRL per bed per night
    const subtotal = basePrice * bedsCount * totalNights;

    // Calculate group discount
    let groupDiscount = 0;
    if (bedsCount >= 26) groupDiscount = 0.20;
    else if (bedsCount >= 16) groupDiscount = 0.15;
    else if (bedsCount >= 7) groupDiscount = 0.10;

    // Calculate season multiplier
    const month = checkInDate.getMonth() + 1;
    let seasonMultiplier = 1.0;
    if (month >= 12 || month <= 3) seasonMultiplier = 1.5; // High season
    else if (month >= 6 && month <= 9) seasonMultiplier = 0.8; // Low season

    // Special carnival pricing (February)
    if (month === 2) seasonMultiplier = 2.0;

    const discountAmount = subtotal * groupDiscount;
    const seasonAdjusted = (subtotal - discountAmount) * seasonMultiplier;
    const totalPrice = seasonAdjusted;

    // Calculate deposits
    const isLargeGroup = bedsCount >= 15;
    const depositPercentage = isLargeGroup ? 0.50 : 0.30;
    const depositAmount = totalPrice * depositPercentage;
    const remainingAmount = totalPrice - depositAmount;

    return {
      basePrice,
      totalNights,
      subtotal,
      groupDiscount,
      seasonMultiplier,
      totalPrice: Math.round(totalPrice * 100) / 100,
      depositAmount: Math.round(depositAmount * 100) / 100,
      remainingAmount: Math.round(remainingAmount * 100) / 100
    };
  }, [bookingData]);

  // Auto-calculate pricing when relevant data changes
  useEffect(() => {
    const pricing = calculatePricing();
    updateBookingData({
      totalPrice: pricing.totalPrice,
      depositAmount: pricing.depositAmount,
      remainingAmount: pricing.remainingAmount
    });
  }, [
    bookingData.checkInDate,
    bookingData.checkOutDate,
    bookingData.bedsCount,
    calculatePricing,
    updateBookingData
  ]);

  // Reset booking data
  const resetBooking = useCallback(() => {
    clearBookingData();
    clearPaymentData();
    setState({
      isLoading: false,
      isSubmitting: false,
      errors: {},
      currentStep: 1,
      maxSteps: 4
    });
  }, [clearBookingData, clearPaymentData]);

  return {
    // Booking data
    bookingData,
    updateField,
    
    // State
    ...state,
    
    // Pricing
    pricing: calculatePricing(),
    
    // Navigation
    nextStep,
    prevStep,
    goToStep,
    
    // Actions
    checkAvailability,
    submitBooking,
    resetBooking,
    
    // Validation
    validateCurrentStep,
    
    // Payment status
    paymentStatus
  };
};
