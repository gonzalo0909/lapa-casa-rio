// lapa-casa-hostel/frontend/src/components/booking/date-range-picker.tsx

"use client";

import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import type { DateRange } from '@/types/global';

/**
 * DateRangePicker Component
 * 
 * Manual date input for check-in and check-out dates
 * Alternative to calendar selection
 * 
 * @component
 */
interface DateRangePickerProps {
  value: DateRange | null;
  onChange: (dateRange: DateRange) => void;
  locale?: 'pt' | 'es' | 'en';
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  locale = 'pt',
  minDate,
  maxDate,
  className = ''
}) => {
  const [checkInValue, setCheckInValue] = useState(
    value?.checkIn ? formatDateForInput(value.checkIn) : ''
  );
  const [checkOutValue, setCheckOutValue] = useState(
    value?.checkOut ? formatDateForInput(value.checkOut) : ''
  );
  const [error, setError] = useState<string | null>(null);

  const validateAndUpdate = useCallback(
    (checkIn: string, checkOut: string) => {
      setError(null);

      if (!checkIn && !checkOut) {
        onChange({ checkIn: null, checkOut: null });
        return;
      }

      if (checkIn && !checkOut) {
        const checkInDate = new Date(checkIn);
        if (isNaN(checkInDate.getTime())) {
          setError(T('invalidCheckIn', locale));
          return;
        }
        onChange({ checkIn: checkInDate, checkOut: null });
        return;
      }

      if (!checkIn && checkOut) {
        setError(T('checkInRequired', locale));
        return;
      }

      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        setError(T('invalidDates', locale));
        return;
      }

      if (checkInDate >= checkOutDate) {
        setError(T('checkOutAfterCheckIn', locale));
        return;
      }

      if (minDate && checkInDate < minDate) {
        setError(T('checkInTooEarly', locale));
        return;
      }

      if (maxDate && checkOutDate > maxDate) {
        setError(T('checkOutTooLate', locale));
        return;
      }

      onChange({ checkIn: checkInDate, checkOut: checkOutDate });
    },
    [onChange, minDate, maxDate, locale]
  );

  const handleCheckInChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setCheckInValue(newValue);
      validateAndUpdate(newValue, checkOutValue);
    },
    [checkOutValue, validateAndUpdate]
  );

  const handleCheckOutChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setCheckOutValue(newValue);
      validateAndUpdate(checkInValue, newValue);
    },
    [checkInValue, validateAndUpdate]
  );

  const handleCheckInBlur = useCallback(() => {
    if (checkInValue && !value?.checkIn) {
      validateAndUpdate(checkInValue, checkOutValue);
    }
  }, [checkInValue, checkOutValue, value, validateAndUpdate]);

  const handleCheckOutBlur = useCallback(() => {
    if (checkOutValue && (!value?.checkOut || !value?.checkIn)) {
      validateAndUpdate(checkInValue, checkOutValue);
    }
  }, [checkInValue, checkOutValue, value, validateAndUpdate]);

  const handleClear = useCallback(() => {
    setCheckInValue('');
    setCheckOutValue('');
    setError(null);
    onChange({ checkIn: null, checkOut: null });
  }, [onChange]);

  const minDateStr = minDate ? formatDateForInput(minDate) : undefined;
  const maxDateStr = maxDate ? formatDateForInput(maxDate) : undefined;

  return (
    <div className={`date-range-picker ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="check-in" className="block text-sm font-medium text-gray-700 mb-2">
            {T('checkIn', locale)}
          </label>
          <Input
            id="check-in"
            type="date"
            value={checkInValue}
            onChange={handleCheckInChange}
            onBlur={handleCheckInBlur}
            min={minDateStr}
            max={maxDateStr}
            className="w-full"
            aria-label={T('checkIn', locale)}
            aria-describedby={error ? 'date-error' : undefined}
          />
          <p className="text-xs text-gray-500 mt-1">{T('checkInTime', locale)}: 14:00</p>
        </div>

        <div>
          <label htmlFor="check-out" className="block text-sm font-medium text-gray-700 mb-2">
            {T('checkOut', locale)}
          </label>
          <Input
            id="check-out"
            type="date"
            value={checkOutValue}
            onChange={handleCheckOutChange}
            onBlur={handleCheckOutBlur}
            min={checkInValue || minDateStr}
            max={maxDateStr}
            className="w-full"
            aria-label={T('checkOut', locale)}
            aria-describedby={error ? 'date-error' : undefined}
          />
          <p className="text-xs text-gray-500 mt-1">{T('checkOutTime', locale)}: 11:00</p>
        </div>
      </div>

      {error && (
        <Alert id="date-error" variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      {value?.checkIn && value?.checkOut && (
        <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {formatDateDisplay(value.checkIn, locale)} → {formatDateDisplay(value.checkOut, locale)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {calculateNights(value.checkIn, value.checkOut)}{' '}
              {calculateNights(value.checkIn, value.checkOut) === 1
                ? T('night', locale)
                : T('nights', locale)}
            </p>
          </div>
          <button
            onClick={handleClear}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
            aria-label={T('clear', locale)}
          >
            {T('clear', locale)}
          </button>
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">{T('dateFormat', locale)}</p>
      </div>
    </div>
  );
};

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date: Date, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  return date.toLocaleDateString(
    locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
    opts
  );
}

function calculateNights(checkIn: Date, checkOut: Date): number {
  return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      checkInTime: 'Horário',
      checkOutTime: 'Horário',
      night: 'noite',
      nights: 'noites',
      clear: 'Limpar',
      dateFormat: 'Formato: DD/MM/AAAA',
      invalidCheckIn: 'Data de check-in inválida',
      invalidCheckOut: 'Data de check-out inválida',
      invalidDates: 'Datas inválidas',
      checkInRequired: 'Selecione a data de check-in primeiro',
      checkOutAfterCheckIn: 'Check-out deve ser após check-in',
      checkInTooEarly: 'Check-in não pode ser no passado',
      checkOutTooLate: 'Check-out muito distante'
    },
    es: {
      checkIn: 'Entrada',
      checkOut: 'Salida',
      checkInTime: 'Horario',
      checkOutTime: 'Horario',
      night: 'noche',
      nights: 'noches',
      clear: 'Limpiar',
      dateFormat: 'Formato: DD/MM/AAAA',
      invalidCheckIn: 'Fecha de entrada inválida',
      invalidCheckOut: 'Fecha de salida inválida',
      invalidDates: 'Fechas inválidas',
      checkInRequired: 'Seleccione fecha de entrada primero',
      checkOutAfterCheckIn: 'Salida debe ser después de entrada',
      checkInTooEarly: 'Entrada no puede ser en el pasado',
      checkOutTooLate: 'Salida muy lejana'
    },
    en: {
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      checkInTime: 'Time',
      checkOutTime: 'Time',
      night: 'night',
      nights: 'nights',
      clear: 'Clear',
      dateFormat: 'Format: MM/DD/YYYY',
      invalidCheckIn: 'Invalid check-in date',
      invalidCheckOut: 'Invalid check-out date',
      invalidDates: 'Invalid dates',
      checkInRequired: 'Select check-in date first',
      checkOutAfterCheckIn: 'Check-out must be after check-in',
      checkInTooEarly: 'Check-in cannot be in the past',
      checkOutTooLate: 'Check-out too far'
    }
  };
  return t[locale]?.[key] || key;
}
