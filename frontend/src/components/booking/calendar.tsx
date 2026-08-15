// lapa-casa-hostel/frontend/src/components/booking/calendar.tsx

"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { DateRange } from '@/types/global';

/**
 * Calendar Component
 * 
 * Interactive calendar for date range selection
 * Supports single month view with navigation
 * 
 * @component
 */
interface CalendarProps {
  value: DateRange | null;
  onChange: (dateRange: DateRange) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  /** Avisa al padre cuando cambia el mes visible, para que pueda recargar disabledDates de ese mes (ver date-selector.tsx). */
  onMonthChange?: (month: Date) => void;
  className?: string;
}

export const Calendar: React.FC<CalendarProps> = ({
  value,
  onChange,
  locale = 'pt',
  minDate,
  maxDate,
  disabledDates = [],
  onMonthChange,
  className = ''
}) => {
  const t = useTranslations('bookingCalendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingEnd, setSelectingEnd] = useState(false);

  // Avisa al padre del mes inicial y de cada cambio de mes -- así puede
  // mantener disabledDates sincronizado con el mes que el huésped está
  // mirando en vez de solo el mes en que se montó el calendario.
  useEffect(() => {
    onMonthChange?.(currentMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar al cambio de mes, no a cambios de identidad de la callback del padre.
  }, [currentMonth]);

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {days.push(null);}
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  }, [currentMonth]);

  const isDateDisabled = useCallback(
    (date: Date): boolean => {
      if (minDate && date < minDate) {return true;}
      if (maxDate && date > maxDate) {return true;}
      return disabledDates.some((d) => isSameDay(d, date));
    },
    [minDate, maxDate, disabledDates]
  );

  const isDateSelected = useCallback(
    (date: Date): boolean => {
      if (!value?.checkIn) {return false;}
      if (isSameDay(date, value.checkIn)) {return true;}
      if (value.checkOut && isSameDay(date, value.checkOut)) {return true;}
      return false;
    },
    [value]
  );

  const isDateInRange = useCallback(
    (date: Date): boolean => {
      if (!value?.checkIn || !value?.checkOut) {return false;}
      return date > value.checkIn && date < value.checkOut;
    },
    [value]
  );

  const handleDateClick = useCallback(
    (date: Date) => {
      if (isDateDisabled(date)) {return;}

      if (!value?.checkIn || (value.checkIn && value.checkOut)) {
        onChange({ checkIn: date, checkOut: null });
        setSelectingEnd(true);
      } else if (selectingEnd) {
        if (date < value.checkIn) {
          onChange({ checkIn: date, checkOut: value.checkIn });
        } else {
          onChange({ checkIn: value.checkIn, checkOut: date });
        }
        setSelectingEnd(false);
      }
    },
    [value, selectingEnd, isDateDisabled, onChange]
  );

  const prevMonth = useCallback(() => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  }, [currentMonth]);

  const nextMonth = useCallback(() => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  }, [currentMonth]);

  const monthName = currentMonth.toLocaleDateString(getLocaleString(locale), {
    month: 'long',
    year: 'numeric'
  });
  const weekDays = getWeekDays(locale);

  return (
    <div className={`calendar max-w-xs mx-auto ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          aria-label={t('prevMonth')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="font-semibold text-sm capitalize">{monthName}</h3>
        <button
          onClick={nextMonth}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          aria-label={t('nextMonth')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
            {day}
          </div>
        ))}
        {monthDays.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const disabled = isDateDisabled(date);
          const selected = isDateSelected(date);
          const inRange = isDateInRange(date);
          const isToday = isSameDay(date, new Date());

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(date)}
              disabled={disabled}
              className={`aspect-square flex items-center justify-center text-xs rounded-md transition-colors ${
                disabled
                  ? 'text-muted-foreground/40 cursor-not-allowed'
                  : selected
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : inRange
                  ? 'bg-primary/10 text-primary'
                  : isToday
                  ? 'border-2 border-primary text-primary font-semibold'
                  : 'hover:bg-muted text-foreground'
              }`}
              aria-label={formatDate(date, locale)}
              aria-pressed={selected}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 border-2 border-primary rounded" />
          <span>{t('today')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary rounded" />
          <span>{t('selected')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary/10 rounded" />
          <span>{t('range')}</span>
        </div>
      </div>
    </div>
  );
};

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getWeekDays(locale: string): string[] {
  const days: Record<string, string[]> = {
    pt: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  };
  return (days[locale] || days.en)!;
}

function getLocaleString(locale: string): string {
  switch (locale) {
    case 'pt': return 'pt-BR';
    case 'es': return 'es-ES';
    case 'fr': return 'fr-FR';
    case 'de': return 'de-DE';
    default: return 'en-US';
  }
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(getLocaleString(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}
