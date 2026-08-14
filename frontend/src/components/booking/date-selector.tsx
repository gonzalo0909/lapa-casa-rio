// lapa-casa-hostel/frontend/src/components/booking/date-selector.tsx

"use client";

import React, { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar } from './calendar';
import { DateRangePicker } from './date-range-picker';
import { SeasonIndicator } from './season-indicator';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { availabilityAPI } from '@/lib/api';
import type { DateRange } from '@/types/global';

interface CalendarDay {
  date: string;
  availableBeds: number;
}

/**
 * DateSelector Component
 *
 * Interface de seleção de datas com calendário e input manual.
 * Valida mínimo/máximo de noites e exibe info de temporada.
 * Usa next-intl para i18n.
 *
 * @component
 */
interface DateSelectorProps {
  value: DateRange | null;
  onChange: (dateRange: DateRange) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  error?: string;
  minNights?: number;
  maxNights?: number;
  className?: string;
}

/** Check-in mínimo: amanhã à meia-noite local (hoje fica excluído). */
function tomorrowAtMidnight(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const BCP47: Record<string, string> = {
  pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE',
};

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(BCP47[locale] ?? 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
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
  const t = useTranslations('dateSelector');
  const [mode, setMode] = useState<'calendar' | 'manual'>('calendar');
  const [localError, setLocalError] = useState<string | null>(null);
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);
  const loadedMonthsRef = useRef<Set<string>>(new Set());

  // Fuente real de fechas bloqueadas: GET /availability/calendar trae la
  // ocupación diaria del mes -- un día sin camas libres se deshabilita en
  // el calendario. Se cachea por mes (loadedMonthsRef) para no repetir la
  // consulta cada vez que el huésped vuelve a un mes ya visto.
  const handleMonthChange = useCallback((month: Date) => {
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    if (loadedMonthsRef.current.has(monthKey)) {
      return;
    }
    loadedMonthsRef.current.add(monthKey);

    availabilityAPI
      .getCalendar({ month: monthKey })
      .then((response) => {
        const days: CalendarDay[] = response.data?.days ?? [];
        const fullyBooked = days
          .filter((d) => d.availableBeds <= 0)
          .map((d) => {
            const [y, m, dd] = d.date.split('-').map(Number);
            return new Date(y!, m! - 1, dd!);
          });
        if (fullyBooked.length > 0) {
          setDisabledDates((prev) => [...prev, ...fullyBooked]);
        }
      })
      .catch(() => {
        // Si falla, el calendario simplemente no marca ese mes como
        // bloqueado -- la disponibilidad real igual se valida en el
        // siguiente paso (checkAvailability), así que no es bloqueante.
        loadedMonthsRef.current.delete(monthKey);
      });
  }, []);

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
      setLocalError(t('minNightsError', { n: minNights }));
      return;
    }

    if (nights > maxNights) {
      setLocalError(t('maxNightsError', { n: maxNights }));
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (newRange.checkIn < today) {
      setLocalError(t('pastDateError'));
      return;
    }

    onChange(newRange);
  }, [onChange, minNights, maxNights, t]);

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
        <h2 className="text-2xl font-bold text-foreground mb-2">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('calendar')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'calendar'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground hover:bg-muted/80'
          }`}
          aria-pressed={mode === 'calendar'}
        >
          {t('calendarMode')}
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground hover:bg-muted/80'
          }`}
          aria-pressed={mode === 'manual'}
        >
          {t('manualMode')}
        </button>
      </div>

      {(error || localError) && (
        <Alert variant="danger" className="mb-4">
          {error || localError}
        </Alert>
      )}

      {mode === 'calendar' ? (
        <Calendar
          value={value}
          onChange={handleDateChange}
          locale={locale}
          minDate={tomorrowAtMidnight()}
          maxDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)}
          disabledDates={disabledDates}
          onMonthChange={handleMonthChange}
        />
      ) : (
        <DateRangePicker
          value={value}
          onChange={handleDateChange}
          locale={locale}
          minDate={tomorrowAtMidnight()}
        />
      )}

      {value?.checkIn && value?.checkOut && (
        <Card className="mt-6 p-4 bg-primary/5 border-primary/20">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('selectedDates')}</p>
              <p className="font-semibold text-foreground">
                {formatDate(value.checkIn, locale)} → {formatDate(value.checkOut, locale)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {nights} {nights === 1 ? t('night') : t('nights')}
              </p>
            </div>
            <button
              onClick={handleClear}
              className="px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors"
              aria-label={t('clearDates')}
            >
              {t('clear')}
            </button>
          </div>
          <SeasonIndicator checkIn={value.checkIn} checkOut={value.checkOut} locale={locale} />
        </Card>
      )}

      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold text-foreground mb-2">{t('importantInfo')}</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• {t('checkInTime')}: 14:00</li>
          <li>• {t('checkOutTime')}: 12:00</li>
          <li>
            • {t('minStay')}: {minNights}{' '}
            {minNights === 1 ? t('night') : t('nights')}
          </li>
          <li>• {t('carnivalNote')}</li>
        </ul>
      </div>
    </div>
  );
};
