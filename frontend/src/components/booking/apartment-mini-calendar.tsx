// lapa-casa-hostel/frontend/src/components/booking/apartment-mini-calendar.tsx

'use client';

import React, { useMemo, useState } from 'react';
import styles from './apartment-engine.module.css';
import { availabilityAPI } from '@/lib/api';

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

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
function fmtShort(ds: string | null): string {
  if (!ds) { return ''; }
  const d = parseDs(ds);
  return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS_SHORT[d.getMonth()];
}
function todayDs(): string {
  return toDs(new Date());
}

function monthCells(y: number, m: number, cin: string | null, cout: string | null, onDayClick: (ds: string) => void): React.ReactNode {
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
    let cls = styles.miniDay;
    if (past) { cls += ` ${styles.miniDayPast}`; }
    else if (isCin || isCout) { cls += ` ${isCin ? styles.miniDayCheckin : styles.miniDayCheckout}`; }
    else if (inRng) { cls += ` ${styles.miniDayInrange}`; }
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
  const [cin, setCin] = useState<string | null>(toDs(globalCheckIn));
  const [cout, setCout] = useState<string | null>(toDs(globalCheckOut));
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ available: boolean } | null>(null);

  const baseMonth = useMemo(() => {
    const ref = cin ? parseDs(cin) : new Date();
    return { y: ref.getFullYear(), m: ref.getMonth() };
  }, [cin]);
  const nextMonth = useMemo(() => {
    let { y, m } = baseMonth;
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    return { y, m };
  }, [baseMonth]);

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
  };

  const nights = cin && cout ? Math.round((parseDs(cout).getTime() - parseDs(cin).getTime()) / 86400000) : 0;
  const changed = cin !== toDs(globalCheckIn) || cout !== toDs(globalCheckOut);

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
      <div className={styles.calMonths} style={{ gap: '1rem' }}>
        <div>
          <div className={styles.miniMonthTitle}>{MONTHS_SHORT[baseMonth.m]} {baseMonth.y}</div>
          <div className={styles.miniWdayHeaders}>
            {WDAYS.map((w, i) => <span key={i} className={styles.miniWday}>{w}</span>)}
          </div>
          <div className={styles.miniDayCells}>
            {monthCells(baseMonth.y, baseMonth.m, cin, cout, handleDayClick)}
          </div>
        </div>
        <div>
          <div className={styles.miniMonthTitle}>{MONTHS_SHORT[nextMonth.m]} {nextMonth.y}</div>
          <div className={styles.miniWdayHeaders}>
            {WDAYS.map((w, i) => <span key={i} className={styles.miniWday}>{w}</span>)}
          </div>
          <div className={styles.miniDayCells}>
            {monthCells(nextMonth.y, nextMonth.m, cin, cout, handleDayClick)}
          </div>
        </div>
      </div>

      {cin && cout ? (
        <div className={styles.miniApplyBar}>
          <span>{fmtShort(cin)} → {fmtShort(cout)} · {nights} noite{nights !== 1 ? 's' : ''}</span>
          <button type="button" className={styles.miniApplyBtn} onClick={handleApply} disabled={checking}>
            {checking ? 'Verificando…' : '✓ Aplicar'}
          </button>
        </div>
      ) : (
        <div className={`${styles.miniApplyBar} ${styles.miniApplyHint}`}>
          {cin ? 'Selecione a data de saída' : 'Selecione a data de entrada'}
        </div>
      )}

      {result && !result.available && (
        <div style={{ fontSize: '.68rem', color: '#991B1B', textAlign: 'center', marginTop: '.35rem' }}>
          ⚠️ Este apartamento está ocupado nessas datas — outros podem estar disponíveis
        </div>
      )}

      {changed && (
        <button type="button" className={styles.miniResetLink} onClick={handleReset}>
          ↩ Voltar às datas originais ({fmtShort(toDs(globalCheckIn))} → {fmtShort(toDs(globalCheckOut))})
        </button>
      )}

      <div className={styles.miniCalLegend}>
        <span className={styles.miniLegendDot} style={{ background: 'var(--primary)' }} />
        <span>Entrada/Saída</span>
        <span className={styles.miniLegendDot} style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary)' }} />
        <span>Período</span>
      </div>
    </div>
  );
};
