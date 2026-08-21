// lapa-casa-hostel/frontend/src/components/booking/apartment-mini-calendar.tsx

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Check, AlertTriangle, Undo2, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './apartment-engine.module.css';
import { availabilityAPI } from '@/lib/api';

/** BCP-47 usado para nomes de mês/dia da semana localizados (Intl), no mesmo
 * mapeamento que o resto do site (ver date-selector.tsx / apartment-engine.tsx). */
const BCP47: Record<string, string> = { pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE' };

function monthLabel(y: number, m: number, locale: string): string {
  return new Date(y, m, 1).toLocaleDateString(BCP47[locale] ?? 'pt-BR', { month: 'long', year: 'numeric' });
}
function weekdayNarrowLabels(locale: string): string[] {
  const bcp = BCP47[locale] ?? 'pt-BR';
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    labels.push(new Date(2023, 0, 1 + i).toLocaleDateString(bcp, { weekday: 'narrow' }));
  }
  return labels;
}
function monthShortLabel(y: number, m: number, locale: string): string {
  return new Date(y, m, 1).toLocaleDateString(BCP47[locale] ?? 'pt-BR', { month: 'short' });
}

interface ApartmentMiniCalendarProps {
  apartmentId: string;
  globalCheckIn: Date;
  globalCheckOut: Date;
  onApply: (range: { checkIn: Date; checkOut: Date }) => void;
}

function toDs(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseDs(s: string): Date {
  const [y, m, d] = s.split('-') as [string, string, string];
  return new Date(Number(y), Number(m) - 1, Number(d));
}
function fmtShort(ds: string | null, locale: string): string {
  if (!ds) { return ''; }
  const d = parseDs(ds);
  return String(d.getDate()).padStart(2, '0') + ' ' + monthShortLabel(d.getFullYear(), d.getMonth(), locale);
}
function todayDs(): string {
  return toDs(new Date());
}

function monthCells(
  y: number,
  m: number,
  cin: string | null,
  cout: string | null,
  blocked: Set<string>,
  onDayClick: (ds: string) => void
): React.ReactNode {
  const dim = new Date(y, m + 1, 0).getDate();
  const fdow = new Date(y, m, 1).getDay();
  const today = todayDs();
  const hasEnd = !!(cin && cout);
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < fdow; i++) {
    cells.push(<span key={'e' + i} className={`${styles.miniDay} ${styles.miniDayPast}`} />);
  }
  for (let d = 1; d <= dim; d++) {
    const s = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const past = s < today;
    const isCin = s === cin;
    const isCout = s === cout;
    const inRng = hasEnd && s > (cin as string) && s < (cout as string);
    const isBlocked = blocked.has(s);
    let cls = styles.miniDay;
    if (past) { cls += ` ${styles.miniDayPast}`; }
    else if (isCin || isCout) { cls += ` ${isCin ? styles.miniDayCheckin : styles.miniDayCheckout}`; }
    else if (inRng) { cls += ` ${styles.miniDayInrange}`; }
    else if (isBlocked) { cls += ` ${styles.miniDayBlocked}`; }
    else { cls += ` ${styles.miniDayAvail}`; }
    cells.push(
      <button
        key={s}
        type="button"
        className={cls}
        disabled={past}
        onClick={() => onDayClick(s)}
      >
        {d}
      </button>
    );
  }
  return cells;
}

export const ApartmentMiniCalendar: React.FC<ApartmentMiniCalendarProps> = ({
  apartmentId,
  globalCheckIn,
  globalCheckOut,
  onApply,
}) => {
  const t = useTranslations('apartments');
  const tc = useTranslations('common');
  const locale = useLocale();
  const wdays = useMemo(() => weekdayNarrowLabels(locale), [locale]);
  const [cin, setCin] = useState<string | null>(toDs(globalCheckIn));
  const [cout, setCout] = useState<string | null>(toDs(globalCheckOut));
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ available: boolean } | null>(null);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());

  // Single-month display: offset from the check-in month (0 = check-in month, 1 = next, etc.)
  const [monthOffset, setMonthOffset] = useState(0);

  const baseMonth = useMemo(() => {
    const ref = cin ? parseDs(cin) : new Date();
    let y = ref.getFullYear();
    let m = ref.getMonth() + monthOffset;
    while (m > 11) { m -= 12; y += 1; }
    while (m < 0) { m += 12; y -= 1; }
    return { y, m };
  }, [cin, monthOffset]);

  // For API: always fetch current + next month for smooth navigation
  const nextApiMonth = useMemo(() => {
    let { y, m } = baseMonth;
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    return { y, m };
  }, [baseMonth]);

  /** Carga la ocupación diaria de este apartamento para pintar de rojo los
   * días bloqueados en cuanto se abre el mini-calendario. */
  useEffect(() => {
    let cancelled = false;
    const months = [
      `${baseMonth.y}-${String(baseMonth.m + 1).padStart(2, '0')}`,
      `${nextApiMonth.y}-${String(nextApiMonth.m + 1).padStart(2, '0')}`,
    ];
    (async () => {
      try {
        const responses = await Promise.all(
          months.map((month) => availabilityAPI.getCalendar({ month, roomId: apartmentId }))
        );
        if (cancelled) { return; }
        const blocked = new Set<string>();
        for (const res of responses) {
          const days = res?.data?.days ?? [];
          for (const d of days as Array<{ date: string; availableBeds: number }>) {
            if (d.availableBeds <= 0) { blocked.add(d.date); }
          }
        }
        setBlockedDates(blocked);
      } catch {
        if (!cancelled) { setBlockedDates(new Set()); }
      }
    })();
    return () => { cancelled = true; };
  }, [apartmentId, baseMonth.y, baseMonth.m, nextApiMonth.y, nextApiMonth.m]);

  const handleDayClick = (ds: string) => {
    setResult(null);
    if (!cin || cout) {
      setCin(ds);
      setCout(null);
    } else if (ds <= cin) {
      setCin(ds);
    } else {
      setCout(ds);
    }
  };

  const handleReset = () => {
    setCin(toDs(globalCheckIn));
    setCout(toDs(globalCheckOut));
    setResult(null);
    setMonthOffset(0);
  };

  const nights = cin && cout ? Math.round((parseDs(cout).getTime() - parseDs(cin).getTime()) / 86400000) : 0;
  const changed = cin !== toDs(globalCheckIn) || cout !== toDs(globalCheckOut);

  // Disable prev if we're already at the current month
  const today = new Date();
  const isAtMinMonth = baseMonth.y === today.getFullYear() && baseMonth.m === today.getMonth();

  const handleApply = async () => {
    if (!cin || !cout) { return; }
    setChecking(true);
    setResult(null);
    try {
      const res = await availabilityAPI.checkApartments({ checkIn: cin, checkOut: cout });
      const apartments = res?.data?.apartments ?? [];
      const found = apartments.find((a: { id: string }) => a.id === apartmentId);
      const available = !!found?.available;
      setResult({ available });
      if (available) {
        onApply({ checkIn: parseDs(cin), checkOut: parseDs(cout) });
      }
    } catch {
      setResult({ available: false });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={styles.aptMiniCal}>
      {/* Month header with prev/next navigation */}
      <div className={styles.miniCalHeader}>
        <button
          type="button"
          className={styles.miniNavBtn}
          onClick={() => setMonthOffset((o) => o - 1)}
          disabled={isAtMinMonth}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={14} />
        </button>
        <span className={styles.miniMonthTitle}>
          {monthLabel(baseMonth.y, baseMonth.m, locale)}
        </span>
        <button
          type="button"
          className={styles.miniNavBtn}
          onClick={() => setMonthOffset((o) => o + 1)}
          aria-label="Próximo mês"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className={styles.miniWdayHeaders}>
        {wdays.map((w, i) => <span key={i} className={styles.miniWday}>{w}</span>)}
      </div>

      {/* Day cells — single month */}
      <div className={styles.miniDayCells}>
        {monthCells(baseMonth.y, baseMonth.m, cin, cout, blockedDates, handleDayClick)}
      </div>

      {/* Apply / hint bar */}
      {cin && cout ? (
        <div className={styles.miniApplyBar}>
          <span>{fmtShort(cin, locale)} → {fmtShort(cout, locale)} · {nights} {nights !== 1 ? t('nights') : t('night')}</span>
          <button type="button" className={styles.miniApplyBtn} onClick={handleApply} disabled={checking}>
            {checking ? t('checking') : (
              <span className={styles.inlineIconText}><Check size={13} /> {tc('apply')}</span>
            )}
          </button>
        </div>
      ) : (
        <div className={`${styles.miniApplyBar} ${styles.miniApplyHint}`}>
          {cin ? t('selectCheckoutDate') : t('selectCheckinDate')}
        </div>
      )}

      {result && !result.available && (
        <div className={styles.miniOccupiedNote}>
          <AlertTriangle size={13} /> {t('apartmentOccupied')}
        </div>
      )}

      {changed && (
        <button type="button" className={styles.miniResetLink} onClick={handleReset}>
          <Undo2 size={12} /> {t('backToOriginalDates', { from: fmtShort(toDs(globalCheckIn), locale), to: fmtShort(toDs(globalCheckOut), locale) })}
        </button>
      )}

      <div className={styles.miniCalLegend}>
        <span className={styles.miniLegendDot} style={{ background: 'var(--primary)' }} />
        <span>{t('checkinCheckoutLegend')}</span>
        <span className={styles.miniLegendDot} style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary)' }} />
        <span>{t('periodLegend')}</span>
      </div>
    </div>
  );
};
