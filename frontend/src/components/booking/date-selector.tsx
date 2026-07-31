// lapa-casa-hostel/frontend/src/components/booking/date-selector.tsx

"use client";

import React, { useState, useCallback } from 'react';
import { Calendar } from './calendar';
import { DateRangePicker } from './date-range-picker';
import { SeasonIndicator } from './season-indicator';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import type { DateRange } from '@/types/global';

/**
 * DateSelector Component
 * 
 * Date selection interface with calendar and manual input modes
 * Validates min/max nights and displays season information
 * 
 * @component
 */
interface DateSelectorProps {
  value: DateRange | null;
  onChange: (dateRange: DateRange) => void;
  locale?: 'pt' | 'es' | 'en';
  error?: string;
  minNights?: number;
  maxNights?: number;
  className?: string;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  value,
  onChange,
  locale = 'pt',
  error,
  minNights = 1,
  maxNights = 30,
  className = ''
}) => {
  const [mode, setMode] = useState<'calendar' | 'manual'>('calendar');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleDateChange = useCallback((newRange: DateRange) => {
    setLocalError(null);

    if (!newRange.checkIn || !newRange.checkOut) {
      onChange(newRange);
      return;
    }

    const nights = Math.ceil(
      (newRange.checkOut.getTime() - newRange.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (nights < minNights) {
      setLocalError(T('minNightsError', locale).replace('{n}', minNights.toString()));
      return;
    }

    if (nights > maxNights) {
      setLocalError(T('maxNightsError', locale).replace('{n}', maxNights.toString()));
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (newRange.checkIn < today) {
      setLocalError(T('pastDateError', locale));
      return;
    }

    onChange(newRange);
  }, [onChange, minNights, maxNights, locale]);

  const handleClear = useCallback(() => {
    onChange({ checkIn: null, checkOut: null });
    setLocalError(null);
  }, [onChange]);

  const nights =
    value?.checkIn && value?.checkOut
      ? Math.ceil((value.checkOut.getTime() - value.checkIn.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  return (
    <div className={`date-selector ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{T('title', locale)}</h2>
        <p className="text-gray-600">{T('subtitle', locale)}</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('calendar')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'calendar'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          aria-pressed={mode === 'calendar'}
        >
          {T('calendarMode', locale)}
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          aria-pressed={mode === 'manual'}
        >
          {T('manualMode', locale)}
        </button>
      </div>

      {(error || localError) && (
        <Alert variant="error" className="mb-4">
          {error || localError}
        </Alert>
      )}

      {mode === 'calendar' ? (
        <Calendar
          value={value}
          onChange={handleDateChange}
          locale={locale}
          minDate={new Date()}
          maxDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)}
        />
      ) : (
        <DateRangePicker value={value} onChange={handleDateChange} locale={locale} minDate={new Date()} />
      )}

      {value?.checkIn && value?.checkOut && (
        <Card className="mt-6 p-4 bg-blue-50 border-blue-200">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">{T('selectedDates', locale)}</p>
              <p className="font-semibold text-gray-900">
                {formatDate(value.checkIn, locale)} → {formatDate(value.checkOut, locale)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {nights} {nights === 1 ? T('night', locale) : T('nights', locale)}
              </p>
            </div>
            <button
              onClick={handleClear}
              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
              aria-label={T('clearDates', locale)}
            >
              {T('clear', locale)}
            </button>
          </div>
          <SeasonIndicator checkIn={value.checkIn} checkOut={value.checkOut} locale={locale} />
        </Card>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">{T('importantInfo', locale)}</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• {T('checkInTime', locale)}: 14:00</li>
          <li>• {T('checkOutTime', locale)}: 11:00</li>
          <li>
            • {T('minStay', locale)}: {minNights}{' '}
            {minNights === 1 ? T('night', locale) : T('nights', locale)}
          </li>
          <li>• {T('carnivalNote', locale)}</li>
        </ul>
      </div>
    </div>
  );
};

function formatDate(date: Date, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleDateString(
    locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
    opts
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Escolha suas Datas',
      subtitle: 'Selecione o período da sua estadia',
      calendarMode: 'Calendário',
      manualMode: 'Manual',
      selectedDates: 'Datas selecionadas',
      night: 'noite',
      nights: 'noites',
      clear: 'Limpar',
      clearDates: 'Limpar datas',
      importantInfo: 'Informações Importantes',
      checkInTime: 'Check-in',
      checkOutTime: 'Check-out',
      minStay: 'Estadia mínima',
      carnivalNote: 'Carnaval: mínimo 5 noites',
      minNightsError: 'Mínimo {n} noites',
      maxNightsError: 'Máximo {n} noites',
      pastDateError: 'Data inválida'
    },
    es: {
      title: 'Elige tus Fechas',
      subtitle: 'Selecciona el período de tu estadía',
      calendarMode: 'Calendario',
      manualMode: 'Manual',
      selectedDates: 'Fechas seleccionadas',
      night: 'noche',
      nights: 'noches',
      clear: 'Limpiar',
      clearDates: 'Limpiar fechas',
      importantInfo: 'Información Importante',
      checkInTime: 'Check-in',
      checkOutTime: 'Check-out',
      minStay: 'Estadía mínima',
      carnivalNote: 'Carnaval: mínimo 5 noches',
      minNightsError: 'Mínimo {n} noches',
      maxNightsError: 'Máximo {n} noches',
      pastDateError: 'Fecha inválida'
    },
    en: {
      title: 'Choose your Dates',
      subtitle: 'Select your stay period',
      calendarMode: 'Calendar',
      manualMode: 'Manual',
      selectedDates: 'Selected dates',
      night: 'night',
      nights: 'nights',
      clear: 'Clear',
      clearDates: 'Clear dates',
      importantInfo: 'Important Information',
      checkInTime: 'Check-in',
      checkOutTime: 'Check-out',
      minStay: 'Minimum stay',
      carnivalNote: 'Carnival: min 5 nights',
      minNightsError: 'Minimum {n} nights',
      maxNightsError: 'Maximum {n} nights',
      pastDateError: 'Invalid date'
    }
  };
  return t[locale]?.[key] || key;
}
