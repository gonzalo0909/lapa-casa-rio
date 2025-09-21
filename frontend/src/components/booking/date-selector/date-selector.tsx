// lapa-casa-hostel-frontend/src/components/booking/date-selector/date-selector.tsx

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { format, parseISO, addDays, differenceInDays, isAfter, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Alert, AlertDescription } from '../../ui/alert';
import { Badge } from '../../ui/badge';
import { Calendar } from './calendar';
import { DateRangePicker } from './date-range-picker';
import { SeasonIndicator } from './season-indicator';
import { validateMinimumNights, getSeasonMultiplier } from '../../../lib/pricing';
import { BUSINESS_RULES } from '../../../constants/config';
import { cn } from '../../../lib/utils';

interface DateSelectorProps {
  initialDates?: {
    checkIn: string;
    checkOut: string;
    nights: number;
  } | null;
  onChange: (dates: {
    checkIn: string;
    checkOut: string;
    nights: number;
  }) => void;
  disabled?: boolean;
  className?: string;
}

interface DateState {
  checkIn: Date | null;
  checkOut: Date | null;
  nights: number;
  isValid: boolean;
  error: string | null;
}

export function DateSelector({
  initialDates,
  onChange,
  disabled = false,
  className
}: DateSelectorProps) {
  const t = useTranslations('booking.dates');
  
  const [state, setState] = useState<DateState>({
    checkIn: initialDates ? parseISO(initialDates.checkIn) : null,
    checkOut: initialDates ? parseISO(initialDates.checkOut) : null,
    nights: initialDates?.nights || 0,
    isValid: false,
    error: null
  });

  const [showCalendar, setShowCalendar] = useState(false);
  const [bedsCount, setBedsCount] = useState(1);

  // Validar fechas cuando cambien
  useEffect(() => {
    validateDates(state.checkIn, state.checkOut);
  }, [state.checkIn, state.checkOut]);

  // Función de validación
  const validateDates = useCallback((checkIn: Date | null, checkOut: Date | null) => {
    if (!checkIn || !checkOut) {
      setState(prev => ({
        ...prev,
        isValid: false,
        error: null,
        nights: 0
      }));
      return;
    }

    const today = startOfDay(new Date());
    const maxDate = addDays(today, BUSINESS_RULES.maxAdvanceBookingDays);
    const nights = differenceInDays(checkOut, checkIn);

    // Validaciones
    if (isBefore(checkIn, today)) {
      setState(prev => ({
        ...prev,
        isValid: false,
        error: t('errors.pastDate'),
        nights
      }));
      return;
    }

    if (!isAfter(checkOut, checkIn)) {
      setState(prev => ({
        ...prev,
        isValid: false,
        error: t('errors.invalidRange'),
        nights
      }));
      return;
    }

    if (isAfter(checkIn, maxDate)) {
      setState(prev => ({
        ...prev,
        isValid: false,
        error: t('errors.tooFarAdvance', { days: BUSINESS_RULES.maxAdvanceBookingDays }),
        nights
      }));
      return;
    }

    if (nights < BUSINESS_RULES.minNights) {
      setState(prev => ({
        ...prev,
        isValid: false,
        error: t('errors.minNights', { nights: BUSINESS_RULES.minNights }),
        nights
      }));
      return;
    }

    if (nights > BUSINESS_RULES.maxNights) {
      setState(prev => ({
        ...prev,
        isValid: false,
        error: t('errors.maxNights', { nights: BUSINESS_RULES.maxNights }),
        nights
      }));
      return;
    }

    // Validar noches mínimas por temporada
    const seasonValidation = validateMinimumNights(checkIn, checkOut);
    if (!seasonValidation.isValid) {
      setState(prev => ({
        ...prev,
        isValid: false,
        error: t('errors.seasonMinNights', {
          nights: seasonValidation.minimumRequired,
          season: seasonValidation.seasonName
        }),
        nights
      }));
      return;
    }

    // Todo válido
    setState(prev => ({
      ...prev,
      isValid: true,
      error: null,
      nights
    }));
  }, [t]);

  // Manejar cambio de fecha de entrada
  const handleCheckInChange = useCallback((date: Date) => {
    setState(prev => {
      const newCheckOut = prev.checkOut && isBefore(date, prev.checkOut) 
        ? prev.checkOut 
        : addDays(date, 1);

      return {
        ...prev,
        checkIn: date,
        checkOut: newCheckOut
      };
    });
  }, []);

  // Manejar cambio de fecha de salida
  const handleCheckOutChange = useCallback((date: Date) => {
    setState(prev => ({
      ...prev,
      checkOut: date
    }));
  }, []);

  // Manejar rango de fechas del calendario
  const handleDateRangeChange = useCallback((range: { from: Date; to: Date }) => {
    setState(prev => ({
      ...prev,
      checkIn: range.from,
      checkOut: range.to
    }));
  }, []);

  // Continuar al siguiente paso
  const handleContinue = useCallback(() => {
    if (state.isValid && state.checkIn && state.checkOut) {
      onChange({
        checkIn: format(state.checkIn, 'yyyy-MM-dd'),
        checkOut: format(state.checkOut, 'yyyy-MM-dd'),
        nights: state.nights
      });
    }
  }, [state.isValid, state.checkIn, state.checkOut, state.nights, onChange]);

  // Obtener información de temporada
  const getSeasonInfo = useCallback(() => {
    if (!state.checkIn || !state.checkOut) return null;
    
    return getSeasonMultiplier(state.checkIn, state.checkOut);
  }, [state.checkIn, state.checkOut]);

  const seasonInfo = getSeasonInfo();

  return (
    <div className={cn('space-y-6', className)}>
      {/* Título y descripción */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('title')}
        </h2>
        <p className="text-gray-600">
          {t('description')}
        </p>
      </div>

      {/* Inputs de fecha */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Check-in */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('checkIn')}
            </label>
            <Input
              type="date"
              value={state.checkIn ? format(state.checkIn, 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                if (e.target.value) {
                  handleCheckInChange(parseISO(e.target.value));
                }
              }}
              min={format(new Date(), 'yyyy-MM-dd')}
              max={format(addDays(new Date(), BUSINESS_RULES.maxAdvanceBookingDays), 'yyyy-MM-dd')}
              disabled={disabled}
              className="w-full"
            />
          </div>

          {/* Check-out */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('checkOut')}
            </label>
            <Input
              type="date"
              value={state.checkOut ? format(state.checkOut, 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                if (e.target.value) {
                  handleCheckOutChange(parseISO(e.target.value));
                }
              }}
              min={state.checkIn ? format(addDays(state.checkIn, 1), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd')}
              disabled={disabled || !state.checkIn}
              className="w-full"
            />
          </div>

          {/* Número de camas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('beds')}
            </label>
            <Input
              type="number"
              min={1}
              max={45}
              value={bedsCount}
              onChange={(e) => setBedsCount(parseInt(e.target.value) || 1)}
              disabled={disabled}
              className="w-full"
            />
          </div>
        </div>

        {/* Información de noches */}
        {state.nights > 0 && (
          <div className="mt-4 text-center">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {t('nightsCount', { count: state.nights })}
            </Badge>
          </div>
        )}

        {/* Botón para mostrar calendario */}
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={() => setShowCalendar(!showCalendar)}
            disabled={disabled}
          >
            {showCalendar ? t('hideCalendar') : t('showCalendar')}
          </Button>
        </div>
      </Card>

      {/* Calendario visual */}
      {showCalendar && (
        <Card className="p-6">
          <DateRangePicker
            selected={{
              from: state.checkIn,
              to: state.checkOut
            }}
            onSelect={handleDateRangeChange}
            disabled={disabled}
            locale={ptBR}
          />
        </Card>
      )}

      {/* Indicador de temporada */}
      {seasonInfo && state.checkIn && state.checkOut && (
        <SeasonIndicator
          season={seasonInfo.seasonName}
          multiplier={seasonInfo.multiplier}
          minimumNights={seasonInfo.minimumNights}
          checkIn={state.checkIn}
          checkOut={state.checkOut}
        />
      )}

      {/* Error */}
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Información adicional */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">
          {t('info.title')}
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• {t('info.checkInTime', { time: BUSINESS_RULES.checkInTime })}</li>
          <li>• {t('info.checkOutTime', { time: BUSINESS_RULES.checkOutTime })}</li>
          <li>• {t('info.cancellation', { hours: BUSINESS_RULES.cancellationPolicyHours })}</li>
          <li>• {t('info.maxAdvance', { days: BUSINESS_RULES.maxAdvanceBookingDays })}</li>
        </ul>
      </div>

      {/* Botón continuar */}
      <div className="text-center">
        <Button
          onClick={handleContinue}
          disabled={!state.isValid || disabled}
          size="lg"
          className="w-full md:w-auto min-w-48"
        >
          {t('continue')}
        </Button>
      </div>

      {/* Sugerencias de fechas populares */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">
          {t('suggestions.title')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { days: 1, label: t('suggestions.weekend') },
            { days: 3, label: t('suggestions.longWeekend') },
            { days: 7, label: t('suggestions.week') },
            { days: 14, label: t('suggestions.twoWeeks') }
          ].map((suggestion) => (
            <Button
              key={suggestion.days}
              variant="outline"
              size="sm"
              onClick={() => {
                const checkIn = startOfDay(new Date());
                const checkOut = addDays(checkIn, suggestion.days);
                setState(prev => ({
                  ...prev,
                  checkIn,
                  checkOut
                }));
              }}
              disabled={disabled}
              className="text-xs"
            >
              {suggestion.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
