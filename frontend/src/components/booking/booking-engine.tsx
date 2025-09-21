// lapa-casa-hostel-frontend/src/components/booking/booking-engine.tsx

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { LoadingSpinner } from '../ui/loading-spinner';
import { DateSelector } from './date-selector/date-selector';
import { RoomSelector } from './room-selector/room-selector';
import { PricingCalculator } from './pricing-calculator/pricing-calculator';
import { GuestInformation } from './guest-information/guest-form';
import { BookingSummary } from './booking-summary/booking-summary';
import { PaymentProcessor } from '../payment/payment-processor';
import { useAvailability } from '../../hooks/use-availability';
import { useBooking } from '../../hooks/use-booking';
import { lapaCasaApi } from '../../lib/api';
import { calculatePricing } from '../../lib/pricing';
import { BookingFormData, PricingCalculation, AvailabilityResponse } from '../../types/global';
import { cn } from '../../lib/utils';

interface BookingEngineProps {
  className?: string;
  initialData?: Partial<BookingFormData>;
  onComplete?: (bookingId: string) => void;
  onError?: (error: string) => void;
}

type BookingStep = 'dates' | 'rooms' | 'guest' | 'payment' | 'confirmation';

interface BookingState {
  step: BookingStep;
  dates: {
    checkIn: string;
    checkOut: string;
    nights: number;
  } | null;
  selection: {
    beds: number;
    rooms: string[];
  } | null;
  pricing: PricingCalculation | null;
  guest: any | null;
  availability: AvailabilityResponse | null;
  loading: boolean;
  error: string | null;
}

export function BookingEngine({
  className,
  initialData,
  onComplete,
  onError
}: BookingEngineProps) {
  const t = useTranslations('booking');
  
  const [state, setState] = useState<BookingState>({
    step: 'dates',
    dates: null,
    selection: null,
    pricing: null,
    guest: null,
    availability: null,
    loading: false,
    error: null
  });

  const {
    checkAvailability,
    availability,
    loading: availabilityLoading,
    error: availabilityError
  } = useAvailability();

  const {
    createBooking,
    loading: bookingLoading,
    error: bookingError
  } = useBooking();

  // Cargar datos iniciales
  useEffect(() => {
    if (initialData) {
      setState(prev => ({
        ...prev,
        dates: initialData.checkIn && initialData.checkOut ? {
          checkIn: initialData.checkIn,
          checkOut: initialData.checkOut,
          nights: initialData.nights || 1
        } : null,
        selection: initialData.beds ? {
          beds: initialData.beds,
          rooms: initialData.rooms || []
        } : null,
        guest: initialData.guest || null
      }));
    }
  }, [initialData]);

  // Manejar cambio de fechas
  const handleDatesChange = useCallback(async (dates: {
    checkIn: string;
    checkOut: string;
    nights: number;
  }) => {
    setState(prev => ({
      ...prev,
      dates,
      loading: true,
      error: null
    }));

    try {
      // Verificar disponibilidad para las fechas seleccionadas
      const response = await lapaCasaApi.checkAvailability({
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        beds: state.selection?.beds || 1
      });

      if (response.success) {
        setState(prev => ({
          ...prev,
          availability: response.data,
          step: 'rooms',
          loading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Error verificando disponibilidad',
          loading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Error de conexión',
        loading: false
      }));
    }
  }, [state.selection?.beds]);

  // Manejar selección de habitaciones
  const handleRoomSelection = useCallback(async (selection: {
    beds: number;
    rooms: string[];
  }) => {
    if (!state.dates) return;

    setState(prev => ({
      ...prev,
      selection,
      loading: true,
      error: null
    }));

    try {
      // Calcular pricing
      const pricing = calculatePricing({
        checkIn: parseISO(state.dates!.checkIn),
        checkOut: parseISO(state.dates!.checkOut),
        beds: selection.beds,
        rooms: []
      });

      setState(prev => ({
        ...prev,
        pricing,
        step: 'guest',
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Error calculando precios',
        loading: false
      }));
    }
  }, [state.dates]);

  // Manejar información del huésped
  const handleGuestInfo = useCallback((guest: any) => {
    setState(prev => ({
      ...prev,
      guest,
      step: 'payment'
    }));
  }, []);

  // Manejar pago completado
  const handlePaymentComplete = useCallback(async (paymentResult: any) => {
    if (!state.dates || !state.selection || !state.guest || !state.pricing) {
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      const bookingData: BookingFormData = {
        checkIn: state.dates.checkIn,
        checkOut: state.dates.checkOut,
        nights: state.dates.nights,
        beds: state.selection.beds,
        rooms: state.selection.rooms,
        guest: state.guest,
        pricing: state.pricing,
        paymentMethod: paymentResult.paymentMethod,
        paymentProvider: paymentResult.provider,
        specialRequests: state.guest.specialRequests,
        receiveMarketing: state.guest.receiveMarketing || false,
        acceptTerms: true,
        acceptPrivacy: true
      };

      const response = await createBooking(bookingData);

      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          step: 'confirmation',
          loading: false
        }));
        
        onComplete?.(response.data.id);
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Error creando reserva',
          loading: false
        }));
        
        onError?.(response.error || 'Error creando reserva');
      }
    } catch (error) {
      const errorMessage = 'Error procesando reserva';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false
      }));
      
      onError?.(errorMessage);
    }
  }, [state, createBooking, onComplete, onError]);

  // Navegar entre pasos
  const goToStep = useCallback((step: BookingStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  // Limpiar error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Renderizar indicador de pasos
  const renderStepIndicator = () => {
    const steps = [
      { key: 'dates', label: t('steps.dates'), icon: '📅' },
      { key: 'rooms', label: t('steps.rooms'), icon: '🛏️' },
      { key: 'guest', label: t('steps.guest'), icon: '👤' },
      { key: 'payment', label: t('steps.payment'), icon: '💳' },
      { key: 'confirmation', label: t('steps.confirmation'), icon: '✅' }
    ];

    const currentIndex = steps.findIndex(s => s.key === state.step);

    return (
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-colors',
                  index <= currentIndex
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                )}
              >
                <span className="text-lg">{step.icon}</span>
              </div>
              
              <div className="hidden sm:block">
                <div
                  className={cn(
                    'text-sm font-medium',
                    index <= currentIndex
                      ? 'text-blue-600'
                      : 'text-gray-500'
                  )}
                >
                  {step.label}
                </div>
              </div>
              
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-2',
                    index < currentIndex
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // Renderizar contenido del paso actual
  const renderStepContent = () => {
    if (state.loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      );
    }

    switch (state.step) {
      case 'dates':
        return (
          <DateSelector
            initialDates={state.dates}
            onChange={handleDatesChange}
            disabled={state.loading}
          />
        );

      case 'rooms':
        return (
          <RoomSelector
            availability={state.availability}
            dates={state.dates}
            initialSelection={state.selection}
            onChange={handleRoomSelection}
            disabled={state.loading}
          />
        );

      case 'guest':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <GuestInformation
                initialData={state.guest}
                onSubmit={handleGuestInfo}
                disabled={state.loading}
              />
            </div>
            <div className="lg:col-span-1">
              <BookingSummary
                dates={state.dates}
                selection={state.selection}
                pricing={state.pricing}
                guest={state.guest}
              />
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <PaymentProcessor
                amount={state.pricing?.depositAmount || 0}
                currency="BRL"
                bookingData={{
                  dates: state.dates,
                  selection: state.selection,
                  guest: state.guest,
                  pricing: state.pricing
                }}
                onSuccess={handlePaymentComplete}
                onError={(error) => setState(prev => ({ ...prev, error }))}
              />
            </div>
            <div className="lg:col-span-1">
              <BookingSummary
                dates={state.dates}
                selection={state.selection}
                pricing={state.pricing}
                guest={state.guest}
                showPaymentBreakdown
              />
            </div>
          </div>
        );

      case 'confirmation':
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {t('confirmation.title')}
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              {t('confirmation.message')}
            </p>
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => window.print()}
                variant="outline"
              >
                {t('confirmation.print')}
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
              >
                {t('confirmation.home')}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Renderizar navegación
  const renderNavigation = () => {
    if (state.step === 'confirmation') return null;

    const canGoBack = state.step !== 'dates';
    const showPricing = state.pricing && ['guest', 'payment'].includes(state.step);

    return (
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <div>
          {canGoBack && (
            <Button
              variant="outline"
              onClick={() => {
                const steps: BookingStep[] = ['dates', 'rooms', 'guest', 'payment'];
                const currentIndex = steps.indexOf(state.step);
                if (currentIndex > 0) {
                  goToStep(steps[currentIndex - 1]);
                }
              }}
              disabled={state.loading}
            >
              {t('navigation.back')}
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {showPricing && (
            <PricingCalculator
              pricing={state.pricing}
              compact
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('max-w-6xl mx-auto', className)}>
      {/* Indicador de pasos */}
      {renderStepIndicator()}

      {/* Error global */}
      {state.error && (
        <Alert className="mb-6" variant="destructive">
          <AlertDescription>
            {state.error}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="ml-2"
            >
              {t('common.dismiss')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Contenido principal */}
      <Card className="p-6">
        {renderStepContent()}
        {renderNavigation()}
      </Card>

      {/* Información adicional */}
      {state.step === 'dates' && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
            <Badge variant="secondary">{t('features.groupDiscount')}</Badge>
            <Badge variant="secondary">{t('features.flexibleCancellation')}</Badge>
            <Badge variant="secondary">{t('features.instantConfirmation')}</Badge>
          </div>
        </div>
      )}
    </div>
  );
}
