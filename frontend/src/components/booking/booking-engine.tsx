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
  const { dateRange, selectedRooms, guestDetails, totalPrice, setDateRange, setSelectedRooms, setGuestDetails, setTotalPrice, clearBooking, createBooking } = useBookingStore();
  const [currentStep, setCurrentStep] = useState<BookingStep>(initialStep);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { availableRooms, isLoading, error: availabilityError, checkAvailability } = useAvailability();

  const validateStep = useCallback((step: BookingStep): boolean => {
    setError(null);
    if (step === 'dates' && (!dateRange?.checkIn || !dateRange?.checkOut)) {
      setError('Selecione as datas');
      return false;
    }
    if (step === 'rooms' && (!selectedRooms || selectedRooms.length === 0)) {
      setError('Selecione um quarto');
      return false;
    }
    if (step === 'guest' && (!guestDetails?.fullName || !guestDetails?.email)) {
      setError('Preencha os dados');
      return false;
    }
    return true;
  }, [dateRange, selectedRooms, guestDetails]);

  const handleNext = useCallback(async () => {
    if (!validateStep(currentStep)) return;
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) {
      if (currentStep === 'dates' && dateRange) {
        setIsProcessing(true);
        try {
          await checkAvailability(dateRange.checkIn, dateRange.checkOut);
        } catch (err) {
          setError('Erro ao verificar disponibilidade');
        } finally {
          setIsProcessing(false);
        }
      }
      setCurrentStep(STEPS[idx + 1]);
    }
  }, [currentStep, validateStep, dateRange, checkAvailability]);

  const handleBack = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1]);
  }, [currentStep]);

  const handleConfirm = useCallback(async () => {
    if (!validateStep('summary')) return;
    setIsProcessing(true);
    try {
      const bookingId = await createBooking({ dateRange: dateRange!, rooms: selectedRooms!, guestDetails: guestDetails!, totalPrice: totalPrice!, locale });
      onComplete ? onComplete(bookingId) : router.push(`/payment/${bookingId}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar');
      setIsProcessing(false);
    }
  }, [validateStep, createBooking, dateRange, selectedRooms, guestDetails, totalPrice, locale, onComplete, router]);

  const progress = ((STEPS.indexOf(currentStep) + 1) / STEPS.length) * 100;

  return (
    <div className={`max-w-6xl mx-auto px-4 py-8 ${className}`} role="main">
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((step, i) => (
            <div key={step} className={`flex-1 text-center text-sm ${i <= STEPS.indexOf(currentStep) ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
              {step.toUpperCase()}
            </div>
          ))}
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {availabilityError && <Alert variant="warning" className="mb-6">{availabilityError}</Alert>}

      {(isProcessing || isLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center">
            <LoadingSpinner size="large" />
            <p className="mt-4">Processando...</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        {currentStep === 'dates' && <DateSelector value={dateRange} onChange={setDateRange} locale={locale} />}
        {currentStep === 'rooms' && <RoomSelector dateRange={dateRange!} availableRooms={availableRooms} selectedRooms={selectedRooms} onChange={setSelectedRooms} locale={locale} />}
        {currentStep === 'guest' && <GuestForm value={guestDetails} onSubmit={setGuestDetails} locale={locale} />}
        {currentStep === 'summary' && <BookingSummary dateRange={dateRange!} rooms={selectedRooms!} guestDetails={guestDetails!} totalPrice={totalPrice!} locale={locale} />}
      </div>

      {currentStep !== 'dates' && dateRange && selectedRooms && selectedRooms.length > 0 && (
        <PricingCalculator dateRange={dateRange} rooms={selectedRooms} locale={locale} className="mb-6" />
      )}

      <div className="flex gap-4 justify-between">
        <button onClick={handleBack} disabled={isProcessing} className="px-6 py-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50">
          Voltar
        </button>
        <button onClick={currentStep === 'summary' ? handleConfirm : handleNext} disabled={isProcessing} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {currentStep === 'summary' ? 'Confirmar' : 'Próximo'}
        </button>
      </div>
    </div>
  );
};
