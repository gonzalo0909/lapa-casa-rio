// lapa-casa-hostel/frontend/src/components/booking/booking-engine.tsx

"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DateSelector } from './date-selector';
import { RoomSelector } from './room-selector';
import { PricingCalculator } from './pricing-calculator';
import { GuestForm } from './guest-form';
import { BookingSummary } from './booking-summary';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useBookingStore } from '@/stores/booking-store';
import { useAvailability } from '@/hooks/use-availability';
import { calculateTotalPrice, validateBookingDates } from '@/lib/pricing';
import type { BookingStep, Room, DateRange, GuestDetails } from '@/types/global';

/**
 * BookingEngine Component
 * 
 * Main booking orchestrator for Lapa Casa Hostel
 * Handles 4-step flow: Dates → Rooms → Guest → Summary
 * 
 * @component
 */
interface BookingEngineProps {
  onComplete?: (bookingId: string) => void;
  locale?: 'pt' | 'es' | 'en';
  initialStep?: BookingStep;
  className?: string;
}

const STEPS: BookingStep[] = ['dates', 'rooms', 'guest', 'summary'];

export const BookingEngine: React.FC<BookingEngineProps> = ({
  onComplete,
  locale = 'pt',
  initialStep = 'dates',
  className = ''
}) => {
  const router = useRouter();
  const {
    dateRange,
    selectedRooms,
    guestDetails,
    totalPrice,
    setDateRange,
    setSelectedRooms,
    setGuestDetails,
    setTotalPrice,
    clearBooking,
    createBooking
  } = useBookingStore();

  const [currentStep, setCurrentStep] = useState<BookingStep>(initialStep);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const {
    availableRooms,
    isLoading,
    error: availabilityError,
    checkAvailability
  } = useAvailability();

  const validateStep = useCallback((step: BookingStep): boolean => {
    setError(null);
    
    if (step === 'dates') {
      if (!dateRange?.checkIn || !dateRange?.checkOut) {
        setError(T('errors.datesRequired', locale));
        return false;
      }
      const validation = validateBookingDates(dateRange.checkIn, dateRange.checkOut);
      if (!validation.isValid) {
        setError(validation.error || T('errors.invalidDates', locale));
        return false;
      }
    }

    if (step === 'rooms') {
      if (!selectedRooms || selectedRooms.length === 0) {
        setError(T('errors.roomRequired', locale));
        return false;
      }
      const totalBeds = selectedRooms.reduce((sum, r) => sum + r.bedsCount, 0);
      if (totalBeds === 0) {
        setError(T('errors.bedsRequired', locale));
        return false;
      }
    }

    if (step === 'guest') {
      if (!guestDetails?.fullName || !guestDetails?.email || !guestDetails?.phone) {
        setError(T('errors.guestRequired', locale));
        return false;
      }
    }

    return true;
  }, [dateRange, selectedRooms, guestDetails, locale]);

  const handleNext = useCallback(async () => {
    if (!validateStep(currentStep)) {
      setTouched(true);
      return;
    }

    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) {
      if (currentStep === 'dates' && dateRange) {
        setIsProcessing(true);
        try {
          await checkAvailability(dateRange.checkIn, dateRange.checkOut);
        } catch (err) {
          setError(T('errors.availabilityCheck', locale));
          return;
        } finally {
          setIsProcessing(false);
        }
      }
      setCurrentStep(STEPS[idx + 1]);
      setTouched(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep, validateStep, dateRange, checkAvailability, locale]);

  const handleBack = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1]);
      setError(null);
      setTouched(false);
    }
  }, [currentStep]);

  const handleDateChange = useCallback(async (newRange: DateRange) => {
    setDateRange(newRange);
    setError(null);
    
    if (newRange.checkIn && newRange.checkOut) {
      const validation = validateBookingDates(newRange.checkIn, newRange.checkOut);
      if (validation.isValid) {
        try {
          await checkAvailability(newRange.checkIn, newRange.checkOut);
        } catch (err) {
          // Handled by hook
        }
      }
    }
  }, [setDateRange, checkAvailability]);

  const handleRoomSelection = useCallback((rooms: Room[]) => {
    setSelectedRooms(rooms);
    setError(null);
    
    if (dateRange && rooms.length > 0) {
      const price = calculateTotalPrice({
        rooms,
        checkIn: dateRange.checkIn,
        checkOut: dateRange.checkOut
      });
      setTotalPrice(price);
    }
  }, [dateRange, setSelectedRooms, setTotalPrice]);

  const handleConfirm = useCallback(async () => {
    if (!validateStep('summary')) return;

    setIsProcessing(true);
    setError(null);

    try {
      const bookingId = await createBooking({
        dateRange: dateRange!,
        rooms: selectedRooms!,
        guestDetails: guestDetails!,
        totalPrice: totalPrice!,
        locale
      });

      onComplete ? onComplete(bookingId) : router.push(`/payment/${bookingId}`);
    } catch (err: any) {
      setError(err.message || T('errors.bookingFailed', locale));
      setIsProcessing(false);
    }
  }, [validateStep, createBooking, dateRange, selectedRooms, guestDetails, totalPrice, locale, onComplete, router]);

  const progress = ((STEPS.indexOf(currentStep) + 1) / STEPS.length) * 100;

  return (
    <div className={`max-w-6xl mx-auto px-4 py-8 ${className}`} role="main">
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`flex-1 text-center text-sm ${
                i <= STEPS.indexOf(currentStep)
                  ? 'text-blue-600 font-semibold'
                  : 'text-gray-400'
              }`}
            >
              {T(`steps.${step}`, locale)}
            </div>
          ))}
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {availabilityError && <Alert variant="warning" className="mb-6">{availabilityError}</Alert>}

      {(isProcessing || isLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8">
            <LoadingSpinner size="large" />
            <p className="mt-4 text-center">{T('loading', locale)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        {currentStep === 'dates' && (
          <DateSelector value={dateRange} onChange={handleDateChange} locale={locale} />
        )}
        {currentStep === 'rooms' && (
          <RoomSelector
            dateRange={dateRange!}
            availableRooms={availableRooms}
            selectedRooms={selectedRooms}
            onChange={handleRoomSelection}
            locale={locale}
          />
        )}
        {currentStep === 'guest' && (
          <GuestForm value={guestDetails} onSubmit={setGuestDetails} locale={locale} />
        )}
        {currentStep === 'summary' && (
          <BookingSummary
            dateRange={dateRange!}
            rooms={selectedRooms!}
            guestDetails={guestDetails!}
            totalPrice={totalPrice!}
            locale={locale}
          />
        )}
      </div>

      {currentStep !== 'dates' && dateRange && selectedRooms && selectedRooms.length > 0 && (
        <PricingCalculator dateRange={dateRange} rooms={selectedRooms} locale={locale} className="mb-6" />
      )}

      <div className="flex gap-4 justify-between">
        <button
          onClick={handleBack}
          disabled={isProcessing || currentStep === 'dates'}
          className="px-6 py-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {T('buttons.back', locale)}
        </button>
        <button
          onClick={currentStep === 'summary' ? handleConfirm : handleNext}
          disabled={isProcessing}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {T(currentStep === 'summary' ? 'buttons.confirm' : 'buttons.next', locale)}
        </button>
      </div>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      'steps.dates': 'Datas', 'steps.rooms': 'Quartos', 'steps.guest': 'Hóspede', 'steps.summary': 'Resumo',
      'buttons.back': 'Voltar', 'buttons.next': 'Próximo', 'buttons.confirm': 'Confirmar',
      'errors.datesRequired': 'Selecione as datas', 'errors.invalidDates': 'Datas inválidas',
      'errors.roomRequired': 'Selecione um quarto', 'errors.bedsRequired': 'Selecione camas',
      'errors.guestRequired': 'Preencha os dados', 'errors.availabilityCheck': 'Erro na disponibilidade',
      'errors.bookingFailed': 'Erro ao processar', 'loading': 'Processando...'
    },
    es: {
      'steps.dates': 'Fechas', 'steps.rooms': 'Habitaciones', 'steps.guest': 'Huésped', 'steps.summary': 'Resumen',
      'buttons.back': 'Volver', 'buttons.next': 'Siguiente', 'buttons.confirm': 'Confirmar',
      'errors.datesRequired': 'Seleccione fechas', 'errors.invalidDates': 'Fechas inválidas',
      'errors.roomRequired': 'Seleccione habitación', 'errors.bedsRequired': 'Seleccione camas',
      'errors.guestRequired': 'Complete los datos', 'errors.availabilityCheck': 'Error en disponibilidad',
      'errors.bookingFailed': 'Error al procesar', 'loading': 'Procesando...'
    },
    en: {
      'steps.dates': 'Dates', 'steps.rooms': 'Rooms', 'steps.guest': 'Guest', 'steps.summary': 'Summary',
      'buttons.back': 'Back', 'buttons.next': 'Next', 'buttons.confirm': 'Confirm',
      'errors.datesRequired': 'Select dates', 'errors.invalidDates': 'Invalid dates',
      'errors.roomRequired': 'Select room', 'errors.bedsRequired': 'Select beds',
      'errors.guestRequired': 'Fill details', 'errors.availabilityCheck': 'Availability error',
      'errors.bookingFailed': 'Booking failed', 'loading': 'Processing...'
    }
  };
  return t[locale]?.[key] || key;
}
