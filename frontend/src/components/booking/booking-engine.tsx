// lapa-casa-hostel/frontend/src/components/booking/booking-engine.tsx

"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { DateSelector } from './date-selector';
import { GenderSelector } from './gender-selector';
import { RoomSelector } from './room-selector';
import { PropertyManagementBanner } from './property-management-banner';
import { PricingCalculator } from './pricing-calculator';
import { GuestForm } from './guest-form';
import { BookingSummary } from './booking-summary';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useBookingStore } from '@/stores/booking-store';
import { useAvailability } from '@/hooks/use-availability';
import { validateBookingDates } from '@/lib/pricing';
import { availabilityAPI } from '@/lib/api';
import type { BookingStep, Room, DateRange } from '@/types/global';

/**
 * BookingEngine Component
 *
 * Orquestrador principal da reserva do Lapa Casa Hostel.
 * Fluxo de 4 passos: Datas → Quartos → Hóspede → Resumo.
 * Usa next-intl para i18n em vez de funcções T() embutidas.
 *
 * @component
 */
interface BookingEngineProps {
  onComplete?: (bookingId: string) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  initialStep?: BookingStep;
  className?: string;
}

const STEPS: BookingStep[] = ['dates', 'rooms', 'guest', 'summary'];

const STEP_KEYS: Record<BookingStep, string> = {
  dates: 'stepDates',
  rooms: 'stepRooms',
  guest: 'stepGuest',
  summary: 'stepSummary',
};

export const BookingEngine: React.FC<BookingEngineProps> = ({
  onComplete,
  locale = 'pt',
  initialStep = 'dates',
  className = ''
}) => {
  const router = useRouter();
  const t = useTranslations('bookingEngine');
  const tc = useTranslations('common');

  const {
    dateRange,
    gender,
    selectedRooms,
    guestDetails,
    totalPrice,
    setDateRange,
    setGender,
    setSelectedRooms,
    setGuestDetails,
    setTotalPrice,
    clearBooking,
    createBooking
  } = useBookingStore();

  const [currentStep, setCurrentStep] = useState<BookingStep>(initialStep);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookingConfirmedRef = useRef(false);

  // Limpa o store só ao desmontar (navegação real fora do wizard).
  // Limpar antes deixava o passo "summary" renderizando com dateRange/
  // selectedRooms/guestDetails em null enquanto router.push ainda não
  // terminou, causando crash em produção.
  useEffect(() => {
    return () => {
      if (bookingConfirmedRef.current) {
        clearBooking();
      }
    };
  }, [clearBooking]);

  const {
    availableRooms,
    groupDiscountTiers,
    isLoading,
    error: availabilityError,
    checkAvailability
  } = useAvailability();

  const validateStep = useCallback((step: BookingStep): boolean => {
    setError(null);

    if (step === 'dates') {
      if (!dateRange?.checkIn || !dateRange?.checkOut) {
        setError(t('errorDatesRequired'));
        return false;
      }
      const validation = validateBookingDates(dateRange.checkIn, dateRange.checkOut);
      if (!validation.isValid) {
        setError(validation.error || t('errorInvalidDates'));
        return false;
      }
    }

    if (step === 'rooms') {
      if (!selectedRooms || selectedRooms.length === 0) {
        setError(t('errorRoomRequired'));
        return false;
      }
      const totalBeds = selectedRooms.reduce((sum, r) => sum + r.bedsCount, 0);
      if (totalBeds === 0) {
        setError(t('errorBedsRequired'));
        return false;
      }
    }

    if (step === 'guest') {
      if (!guestDetails?.fullName || !guestDetails?.email || !guestDetails?.phone) {
        setError(t('errorGuestRequired'));
        return false;
      }
    }

    return true;
  }, [dateRange, selectedRooms, guestDetails, t]);

  const handleNext = useCallback(async () => {
    if (!validateStep(currentStep)) {return;}

    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) {
      if (currentStep === 'dates' && dateRange?.checkIn && dateRange?.checkOut) {
        setIsProcessing(true);
        try {
          await checkAvailability(dateRange.checkIn, dateRange.checkOut);
        } catch (_err) {
          setError(t('errorAvailabilityCheck'));
          return;
        } finally {
          setIsProcessing(false);
        }
      }
      setCurrentStep(STEPS[idx + 1]!);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep, validateStep, dateRange, checkAvailability, t]);

  const handleBack = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(STEPS[idx - 1]!);
      setError(null);
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
        } catch (_err) {
          // Handled by hook
        }
      }
    }
  }, [setDateRange, checkAvailability]);

  const handleRoomSelection = useCallback(async (rooms: Room[]) => {
    setSelectedRooms(rooms);
    setError(null);

    if (dateRange?.checkIn && dateRange?.checkOut && rooms.length > 0) {
      try {
        const response = await availabilityAPI.quote({
          checkIn: dateRange.checkIn.toISOString().slice(0, 10),
          checkOut: dateRange.checkOut.toISOString().slice(0, 10),
          rooms: rooms.map((r) => ({ roomId: r.id, bedsCount: r.bedsCount })),
        });
        setTotalPrice(response.data.totalPrice as number);
      } catch (_err) {
        // O erro real é mostrado no PricingCalculator; aqui só evitamos
        // deixar um totalPrice velho/incorreto se a cotização falhar.
        setTotalPrice(0);
      }
    }
  }, [dateRange, setSelectedRooms, setTotalPrice]);

  const handleConfirm = useCallback(async () => {
    if (!validateStep('summary')) {return;}

    setIsProcessing(true);
    setError(null);

    try {
      const bookingId = await createBooking({
        dateRange: dateRange!,
        rooms: selectedRooms!,
        guestDetails: guestDetails!,
        totalPrice: totalPrice!,
        gender,
        locale
      });

      bookingConfirmedRef.current = true;
      if (onComplete) {
        onComplete(bookingId);
      } else {
        router.push(`/${locale}/payment/${bookingId}`);
      }
    } catch (err: any) {
      setError(err.message || t('errorBookingFailed'));
      setIsProcessing(false);
    }
  }, [validateStep, createBooking, dateRange, selectedRooms, guestDetails, totalPrice, gender, locale, onComplete, router, t]);

  const progress = ((STEPS.indexOf(currentStep) + 1) / STEPS.length) * 100;

  return (
    <div className={`max-w-6xl mx-auto px-4 py-8 ${className}`} role="main">
      {/* Barra de progresso */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`flex-1 text-center text-sm ${
                i <= STEPS.indexOf(currentStep)
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground'
              }`}
            >
              {t(STEP_KEYS[step])}
            </div>
          ))}
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && <Alert variant="danger" className="mb-6">{error}</Alert>}
      {availabilityError && <Alert variant="warning" className="mb-6">{availabilityError}</Alert>}

      {(isProcessing || isLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-8 shadow-xl">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-center text-foreground">{t('loading')}</p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg shadow-lg p-6 mb-6 border border-border">
        {currentStep === 'dates' && (
          <>
            <GenderSelector value={gender} onChange={setGender} locale={locale} className="mb-6" />
            <DateSelector value={dateRange} onChange={handleDateChange} locale={locale} />
          </>
        )}
        {currentStep === 'rooms' && (
          <>
            <RoomSelector
              dateRange={dateRange!}
              gender={gender}
              availableRooms={availableRooms}
              groupDiscountTiers={groupDiscountTiers}
              selectedRooms={selectedRooms}
              onChange={handleRoomSelection}
              locale={locale}
            />
            <PropertyManagementBanner locale={locale} className="mt-6" />
          </>
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
          className="px-6 py-3 border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {tc('back')}
        </button>
        <button
          onClick={currentStep === 'summary' ? handleConfirm : handleNext}
          disabled={isProcessing}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity font-semibold"
        >
          {currentStep === 'summary' ? tc('confirm') : tc('next')}
        </button>
      </div>
    </div>
  );
};
