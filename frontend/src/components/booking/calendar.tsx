// lapa-casa-hostel/frontend/src/components/booking/calendar.tsx

"use client";

import React, { useState, useMemo, useCallback } from 'react';
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
  locale?: 'pt' | 'es' | 'en';
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  className?: string;
}

export const Calendar: React.FC<CalendarProps> = ({
  value,
  onChange,
  locale = 'pt',
  minDate,
  maxDate,
  disabledDates = [],
  className = ''
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingEnd, setSelectingEnd] = useState(false);

  const monthDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  }, [currentMonth]);

  const isDateDisabled = useCallback(
    (date: Date): boolean => {
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      return disabledDates.some((d) => isSameDay(d, date));
    },
    [minDate, maxDate, disabledDates]
  );

  const isDateSelected = useCallback(
    (date: Date): boolean => {
      if (!value?.checkIn) return false;
      if (isSameDay(date, value.checkIn)) return true;
      if (value.checkOut && isSameDay(date, value.checkOut)) return true;
      return false;
    },
    [value]
  );

  const isDateInRange = useCallback(
    (date: Date): boolean => {
      if (!value?.checkIn || !value?.checkOut) return false;
      return date > value.checkIn && date < value.checkOut;
    },
    [value]
  );

  const handleDateClick = useCallback(
    (date: Date) => {
      if (isDateDisabled(date)) return;

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
    <div className={`calendar ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={T('prevMonth', locale)}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="font-semibold text-lg capitalize">{monthName}</h3>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={T('nextMonth', locale)}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
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
              className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-colors ${
                disabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : selected
                  ? 'bg-blue-600 text-white font-semibold'
                  : inRange
                  ? 'bg-blue-100 text-blue-900'
                  : isToday
                  ? 'border-2 border-blue-600 text-blue-600 font-semibold'
                  : 'hover:bg-gray-100 text-gray-900'
              }`}
              aria-label={formatDate(date, locale)}
              aria-pressed={selected}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 border-2 border-blue-600 rounded" />
          <span>{T('today', locale)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 bg-blue-600 rounded" />
          <span>{T('selected', locale)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 bg-blue-100 rounded" />
          <span>{T('range', locale)}</span>
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
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  };
  return days[locale] || days.en;
}

function getLocaleString(locale: string): string {
  return locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US';
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(getLocaleString(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      prevMonth: 'Mês anterior',
      nextMonth: 'Próximo mês',
      today: 'Hoje',
      selected: 'Selecionado',
      range: 'Período'
    },
    es: {
      prevMonth: 'Mes anterior',
      nextMonth: 'Próximo mes',
      today: 'Hoy',
      selected: 'Seleccionado',
      range: 'Período'
    },
    en: {
      prevMonth: 'Previous month',
      nextMonth: 'Next month',
      today: 'Today',
      selected: 'Selected',
      range: 'Range'
    }
  };
  return t[locale]?.[key] || key;
}
