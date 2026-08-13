// lapa-casa-hostel/frontend/src/components/booking/apartment-engine.tsx

"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { DateSelector } from './date-selector';
import { GuestForm } from './guest-form';
import { ApartmentCard } from './apartment-card';
import { GuestCountStepper } from './guest-count-stepper';
import { PricingCalculator } from './pricing-calculator';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useApartmentStore } from '@/stores/apartment-store';
import { availabilityAPI } from '@/lib/api';
import type { ApartmentStep, ApartmentAvailability, DateRange, Room } from '@/types/global';

type RankedApartment = {
  apt: ApartmentAvailability;
  disabledReason?: 'unavailable' | 'too-small';
};

/**
 * Mismo orden que LCACOPIA (renderApartments): disponibles+entran primero
 * (interactivos), disponibles+no entran después (deshabilitados, aviso de
 * capacidad), no disponibles al final.
 */
function rankApartments(apartments: ApartmentAvailability[], guestCount: number): RankedApartment[] {
  const fits = (a: ApartmentAvailability) => a.available && a.capacity >= guestCount;
  const tooSmall = (a: ApartmentAvailability) => a.available && a.capacity < guestCount;

  return [
    ...apartments.filter(fits).map((apt) => ({ apt })),
    ...apartments.filter(tooSmall).map((apt) => ({ apt, disabledReason: 'too-small' as const })),
    ...apartments
      .filter((a) => !a.available)
      .map((apt) => ({ apt, disabledReason: 'unavailable' as const })),
  ];
}

interface ApartmentEngineProps {
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

const STEPS: ApartmentStep[] = ['dates', 'apartment', 'summary'];

export const ApartmentEngine: React.FC<ApartmentEngineProps> = ({ locale = 'pt' }) => {
  const router = useRouter();
  const t = useTranslations('apartments');
  const tc = useTranslations('common');

  const {
    dateRange,
    selectedApartment,
    guestDetails,
    guestCount,
    setDateRange,
    setSelectedApartment,
    setGuestDetails,
    setTotalPrice,
    setGuestCount,
    clearBooking,
    createBooking,
  } = useApartmentStore();

  const [step, setStep] = useState<ApartmentStep>('dates');
  const [apartments, setApartments] = useState<ApartmentAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmedRef = useRef(false);
  const bookingSucceededRef = useRef(false);

  // Limpia el store solo al desmontar (navegación real fuera del wizard).
  // Limpiar antes dejaba el paso "summary" renderizando con dateRange/
  // selectedApartment/guestDetails en null mientras router.push todavía
  // no terminaba, pudiendo crashear la página de pago.
  useEffect(() => {
    return () => {
      if (bookingSucceededRef.current) {
        clearBooking();
      }
    };
  }, [clearBooking]);

  const nights =
    dateRange?.checkIn && dateRange?.checkOut
      ? Math.round(
          (dateRange.checkOut.getTime() - dateRange.checkIn.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

  // Carga apartamentos disponibles al pasar al paso "apartment"
  const loadApartments = useCallback(async (range: DateRange) => {
    if (!range.checkIn || !range.checkOut) {return;}
    setIsLoading(true);
    setError(null);
    try {
      const checkIn = range.checkIn.toISOString().slice(0, 10);
      const checkOut = range.checkOut.toISOString().slice(0, 10);
      const res = await availabilityAPI.checkApartments({ checkIn, checkOut });
      setApartments(res?.data?.apartments ?? []);
    } catch (err: any) {
      setError(err?.message ?? t('errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Actualiza precio total cuando cambia el apartamento seleccionado.
  // Usa priceTotal directo del backend (ya viene calculado para el rango
  // de fechas consultado) en vez de recalcular basePrice * nights en el
  // frontend, que podía desincronizarse si el backend aplica multiplicador
  // de temporada.
  useEffect(() => {
    if (selectedApartment) {
      setTotalPrice(selectedApartment.priceTotal);
    }
  }, [selectedApartment, setTotalPrice]);

  // — Handlers de navegación —

  const handleDateChange = useCallback((range: DateRange) => {
    setDateRange(range);
    setSelectedApartment(null);
    setError(null);
  }, [setDateRange, setSelectedApartment]);

  // "Aplicar" del mini-calendario de un apartamento: a diferencia de
  // handleDateChange (paso "dates", el huésped todavía va a tocar
  // "Continuar"), acá ya estamos en el paso "apartment" y hay que
  // re-consultar disponibilidad de inmediato -- mismo patrón que LCACOPIA,
  // que re-renderiza toda la grilla al aplicar fechas desde una tarjeta.
  const handleMiniCalendarApply = useCallback((range: { checkIn: Date; checkOut: Date }) => {
    const newRange: DateRange = range;
    setDateRange(newRange);
    setSelectedApartment(null);
    setError(null);
    loadApartments(newRange);
  }, [setDateRange, setSelectedApartment, loadApartments]);

  const rankedApartments = React.useMemo(
    () => rankApartments(apartments, guestCount),
    [apartments, guestCount]
  );

  const roomsForPricing: Room[] = React.useMemo(
    () =>
      selectedApartment
        ? [{
            id: selectedApartment.id,
            name: selectedApartment.name,
            type: 'mixed',
            bedsCount: 1,
            capacity: selectedApartment.capacity,
            basePrice: selectedApartment.basePrice,
            isFlexible: false,
          }]
        : [],
    [selectedApartment]
  );

  const handleDatesNext = useCallback(() => {
    if (!dateRange?.checkIn || !dateRange?.checkOut) {
      setError(t('selectDatesFirst'));
      return;
    }
    setError(null);
    setStep('apartment');
    loadApartments(dateRange);
  }, [dateRange, loadApartments, t]);

  const handleApartmentSelect = useCallback((apt: ApartmentAvailability) => {
    setSelectedApartment(apt);
  }, [setSelectedApartment]);

  const handleApartmentContinue = useCallback(() => {
    if (!selectedApartment) {
      setError(t('selectApartmentFirst'));
      return;
    }
    setError(null);
    setStep('summary');
  }, [selectedApartment, t]);

  const handleSubmit = useCallback(async () => {
    if (!dateRange || !selectedApartment || !guestDetails) {return;}
    if (confirmedRef.current) {return;}
    confirmedRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      const reservationId = await createBooking({
        dateRange,
        apartment: selectedApartment,
        guestDetails,
        locale,
      });
      bookingSucceededRef.current = true;
      router.push(`/${locale}/payment/${reservationId}`);
    } catch (err: any) {
      confirmedRef.current = false;
      setError(err?.message ?? t('errorCreating'));
    } finally {
      setIsProcessing(false);
    }
  }, [dateRange, selectedApartment, guestDetails, createBooking, locale, router, t]);

  const goBack = useCallback(() => {
    setError(null);
    const idx = STEPS.indexOf(step);
    const prev = STEPS[idx - 1];
    if (idx > 0 && prev) {setStep(prev);}
  }, [step]);

  // — Indicador de pasos —
  const stepLabels: Record<ApartmentStep, string> = {
    dates: t('stepDates'),
    apartment: t('stepApartment'),
    summary: t('stepSummary'),
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Breadcrumb de pasos */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const current = s === step;
          const done = STEPS.indexOf(step) > i;
          return (
            <React.Fragment key={s}>
              <div
                className={`flex items-center gap-1.5 shrink-0 ${
                  current ? 'text-primary font-semibold' : done ? 'text-muted-foreground' : 'text-muted-foreground/40'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    current
                      ? 'border-primary bg-primary text-primary-foreground'
                      : done
                      ? 'border-muted-foreground bg-muted-foreground text-background'
                      : 'border-muted-foreground/30'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className="text-sm">{stepLabels[s]}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px min-w-4 bg-border" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* PASO 1: Fechas */}
      {step === 'dates' && (
        <div>
          <GuestCountStepper
            value={guestCount}
            onChange={setGuestCount}
            className="mb-4"
          />
          <DateSelector
            value={dateRange}
            onChange={handleDateChange}
            locale={locale}
          />
          <div className="flex justify-end mt-4">
            <button
              onClick={handleDatesNext}
              disabled={!dateRange?.checkIn || !dateRange?.checkOut}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {tc('continue')} →
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Elegir apartamento */}
      {step === 'apartment' && (
        <div>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground">{t('chooseApartment')}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {dateRange?.checkIn?.toLocaleDateString(locale)} →{' '}
                  {dateRange?.checkOut?.toLocaleDateString(locale)} · {nights}{' '}
                  {nights === 1 ? t('night') : t('nights')}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {rankedApartments.map(({ apt, disabledReason }) => (
                  <ApartmentCard
                    key={apt.id}
                    apartment={apt}
                    nights={nights}
                    selected={selectedApartment?.id === apt.id}
                    onSelect={handleApartmentSelect}
                    disabledReason={disabledReason}
                    guestCount={guestCount}
                    globalCheckIn={dateRange?.checkIn ?? null}
                    globalCheckOut={dateRange?.checkOut ?? null}
                    onApplyDates={handleMiniCalendarApply}
                    locale={locale}
                  />
                ))}
              </div>
              <div className="flex justify-between gap-3">
                <button
                  onClick={goBack}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← {tc('back')}
                </button>
                <button
                  onClick={handleApartmentContinue}
                  disabled={!selectedApartment}
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {tc('continue')} →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* PASO 3: Datos del huésped + resumen */}
      {step === 'summary' && (
        <div className="space-y-6">
          {/* Resumen de la reserva: apartamento + fechas, precio real vía
              PricingCalculator (mismo /availability/quote que el hostel) en
              vez de un total recalculado a mano -- así lo que se muestra acá
              siempre coincide con lo que create-booking.ts termina cobrando. */}
          {selectedApartment && dateRange?.checkIn && dateRange?.checkOut && (
            <>
              <div className="bg-muted/50 rounded-xl p-5 border border-border">
                <h3 className="font-bold text-foreground mb-3">{t('bookingSummary')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('apartment')}</span>
                    <span className="font-semibold">{selectedApartment.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('checkIn')}</span>
                    <span>{dateRange.checkIn.toLocaleDateString(locale)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('checkOut')}</span>
                    <span>{dateRange.checkOut.toLocaleDateString(locale)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('nights2')}</span>
                    <span>{nights}</span>
                  </div>
                </div>
              </div>

              <PricingCalculator
                dateRange={dateRange}
                rooms={roomsForPricing}
                locale={locale}
              />
            </>
          )}

          {/* Formulario del huésped -- strict: doble email (sin copiar/
              pegar) y validación más estricta de teléfono, puerto de
              LCACOPIA. Solo se activa acá, no afecta al hostel. */}
          <GuestForm
            value={guestDetails}
            onSubmit={(details) => {
              setGuestDetails(details);
              handleSubmit();
            }}
            locale={locale}
            error={error ?? undefined}
            strict
          />

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={goBack}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {tc('back')}
            </button>
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoadingSpinner />
                {t('processing')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
