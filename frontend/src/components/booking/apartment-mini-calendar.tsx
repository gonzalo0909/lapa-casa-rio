// lapa-casa-hostel/frontend/src/components/booking/apartment-mini-calendar.tsx

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { availabilityAPI } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ApartmentMiniCalendarProps {
  apartmentId: string;
  globalCheckIn: Date | null;
  globalCheckOut: Date | null;
  onApply: (range: { checkIn: Date; checkOut: Date }) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Mini-calendario interactivo por apartamento -- puerto de LCACOPIA
 * (miniCalState / renderInteractiveMiniCal), pero sin el objeto BLOCKED[]
 * hardcodeado de la maqueta: el estado de cada día sale de
 * GET /availability/calendar?roomId=, que ahora respeta roomId (antes lo
 * ignoraba, ver availability-service.ts).
 *
 * "Aplicar" no dispara ningún fetch propio -- delega en onApply, que en
 * ApartmentEngine es el mismo handleDateChange que ya usa el DateSelector
 * principal, así que aplicar acá re-consulta y re-renderiza toda la
 * grilla de apartamentos exactamente como en LCACOPIA.
 */
export const ApartmentMiniCalendar: React.FC<ApartmentMiniCalendarProps> = ({
  apartmentId,
  globalCheckIn,
  globalCheckOut,
  onApply,
  locale = 'pt',
}) => {
  const [baseMonth, setBaseMonth] = useState(() => globalCheckIn ?? new Date());
  const [days, setDays] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [cin, setCin] = useState<Date | null>(globalCheckIn);
  const [cout, setCout] = useState<Date | null>(globalCheckOut);

  const nextMonth = useMemo(
    () => new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1),
    [baseMonth]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      availabilityAPI.getCalendar({ month: monthKey(baseMonth), roomId: apartmentId }),
      availabilityAPI.getCalendar({ month: monthKey(nextMonth), roomId: apartmentId }),
    ])
      .then(([a, b]) => {
        if (cancelled) {return;}
        const map: Record<string, boolean> = {};
        for (const res of [a, b]) {
          const dayList = (res?.data?.days ?? []) as Array<{ date: string; availableBeds: number }>;
          for (const d of dayList) {
            map[d.date] = d.availableBeds <= 0;
          }
        }
        setDays(map);
      })
      .catch(() => {
        if (!cancelled) {setDays({});}
      })
      .finally(() => {
        if (!cancelled) {setIsLoading(false);}
      });
    return () => {
      cancelled = true;
    };
  }, [apartmentId, baseMonth, nextMonth]);

  const buildMonthCells = useCallback(
    (month: Date): (Date | null)[] => {
      const year = month.getFullYear();
      const mIdx = month.getMonth();
      const firstDay = new Date(year, mIdx, 1);
      const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
      const cells: (Date | null)[] = [];
      for (let i = 0; i < firstDay.getDay(); i++) {cells.push(null);}
      for (let d = 1; d <= daysInMonth; d++) {cells.push(new Date(year, mIdx, d));}
      return cells;
    },
    []
  );

  const isBlocked = useCallback(
    (date: Date) => days[toDateOnly(date)] === true,
    [days]
  );

  const isPast = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }, []);

  const handleDayClick = useCallback(
    (date: Date) => {
      if (isPast(date) || isBlocked(date)) {return;}
      if (!cin || (cin && cout)) {
        setCin(date);
        setCout(null);
      } else if (date > cin) {
        setCout(date);
      } else {
        setCin(date);
        setCout(null);
      }
    },
    [cin, cout, isPast, isBlocked]
  );

  const rangeHasBlockedDay = useMemo(() => {
    if (!cin || !cout) {return false;}
    const d = new Date(cin);
    while (d < cout) {
      if (isBlocked(d)) {return true;}
      d.setDate(d.getDate() + 1);
    }
    return false;
  }, [cin, cout, isBlocked]);

  const canApply = !!cin && !!cout && !rangeHasBlockedDay;
  const hasChanged =
    cin && cout && globalCheckIn && globalCheckOut &&
    (!isSameDay(cin, globalCheckIn) || !isSameDay(cout, globalCheckOut));

  const weekDays = getWeekDays(locale);

  const renderMonth = (month: Date) => (
    <div>
      <p className="text-center text-xs font-semibold text-foreground mb-1 capitalize">
        {month.toLocaleDateString(localeString(locale), { month: 'long', year: 'numeric' })}
      </p>
      <div className="grid grid-cols-7 gap-px">
        {weekDays.map((w) => (
          <div key={w} className="text-center text-[9px] font-semibold text-muted-foreground py-0.5">
            {w}
          </div>
        ))}
        {buildMonthCells(month).map((date, idx) => {
          if (!date) {return <div key={`e${idx}`} />;}
          const blocked = isBlocked(date);
          const past = isPast(date);
          const selStart = cin && isSameDay(date, cin);
          const selEnd = cout && isSameDay(date, cout);
          const inRange = cin && cout && date > cin && date < cout;
          const disabled = past || blocked;
          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => handleDayClick(date)}
              className={`aspect-square text-[10px] rounded flex items-center justify-center transition-colors ${
                disabled
                  ? blocked
                    ? 'bg-red-100 text-red-700 cursor-not-allowed'
                    : 'text-muted-foreground/30 cursor-not-allowed'
                  : selStart || selEnd
                  ? 'bg-primary text-primary-foreground font-bold'
                  : inRange
                  ? 'bg-primary/15 text-primary'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-muted/40 rounded-lg p-3 text-xs">
      {isLoading ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner size="sm" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {renderMonth(baseMonth)}
          {renderMonth(nextMonth)}
        </div>
      )}

      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-100 inline-block" /> {T('blocked', locale)}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> {T('chosen', locale)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border">
        <button
          type="button"
          disabled={!canApply}
          onClick={() => cin && cout && onApply({ checkIn: cin, checkOut: cout })}
          className="text-[11px] font-bold bg-primary text-primary-foreground rounded-md px-2.5 py-1 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {T('apply', locale)}
        </button>
        {hasChanged && (
          <button
            type="button"
            onClick={() => {
              setCin(globalCheckIn);
              setCout(globalCheckOut);
              setBaseMonth(globalCheckIn ?? new Date());
            }}
            className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {T('reset', locale)}
          </button>
        )}
      </div>
    </div>
  );
};

function localeString(locale: string): string {
  switch (locale) {
    case 'pt': return 'pt-BR';
    case 'es': return 'es-ES';
    case 'fr': return 'fr-FR';
    case 'de': return 'de-DE';
    default: return 'en-US';
  }
}

function getWeekDays(locale: string): string[] {
  const days: Record<string, string[]> = {
    pt: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
    es: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    fr: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
    de: ['S', 'M', 'D', 'M', 'D', 'F', 'S'],
  };
  return days[locale] || days.en!;
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: { blocked: 'Ocupado', chosen: 'Escolhido', apply: '✓ Aplicar', reset: '↩ Voltar às datas originais' },
    es: { blocked: 'Ocupado', chosen: 'Elegido', apply: '✓ Aplicar', reset: '↩ Volver a las fechas originales' },
    en: { blocked: 'Booked', chosen: 'Chosen', apply: '✓ Apply', reset: '↩ Back to original dates' },
    fr: { blocked: 'Occupé', chosen: 'Choisi', apply: '✓ Appliquer', reset: '↩ Revenir aux dates initiales' },
    de: { blocked: 'Belegt', chosen: 'Gewählt', apply: '✓ Anwenden', reset: '↩ Zu ursprünglichen Daten zurück' },
  };
  return t[locale]?.[key] || key;
}
