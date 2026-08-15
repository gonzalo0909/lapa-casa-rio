'use client';
// frontend/src/components/booking/hostel-calendar.tsx
// Step 1 — Calendário de check-in/check-out.
// Componente puro de apresentação: toda lógica de estado fica no orquestrador.

import React from 'react';
import { Lang, T, DAY_LBL, MON_LBL } from './hostel-engine.types';
import { getSeason, fmtDate, sameDay, dayBefore, inRange } from './hostel-engine.utils';

// ─── Props ──────────────────────────────────────────────
interface HostelCalendarProps {
  lang: Lang;
  calMonth: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  hoverDate: Date | null;
  selectingEnd: boolean;
  today: Date;
  onCalClick: (date: Date) => void;
  onMonthChange: (delta: number) => void;
  onHoverDate: (date: Date | null) => void;
}

// ─── Component ──────────────────────────────────────────
export function HostelCalendar({
  lang, calMonth, checkIn, checkOut, hoverDate, selectingEnd,
  today, onCalClick, onMonthChange, onHoverDate,
}: HostelCalendarProps) {
  const t = T[lang];

  // Build calendar grid cells
  const calCells = (() => {
    const firstDay = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
    const cells: Array<{ day: number; date: Date; isEmpty?: false } | { isEmpty: true }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ isEmpty: true });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: new Date(calMonth.getFullYear(), calMonth.getMonth(), d), isEmpty: false });
    }
    return cells;
  })();

  // Minimum nights warning
  const minNightsWarn = (() => {
    if (!checkIn || !checkOut) return null;
    const n = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
    const s = getSeason(checkIn);
    if (s.minNights > 1 && n < s.minNights)
      return `📅 ${s.label}: ${t.tToastMinNights} ${s.minNights} ${t.tToastNights}`;
    return null;
  })();

  return (
    <div className="he-panel">
      <div className="he-panel-title">{t.p1title}</div>
      <div className="he-panel-sub">{t.p1sub}</div>

      {/* Month navigation */}
      <div className="he-cal-nav">
        <button
          className="he-cal-nav-btn"
          onClick={() => onMonthChange(-1)}
          aria-label={t.calPrev}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="he-cal-month">
          {MON_LBL[lang][calMonth.getMonth()]} {calMonth.getFullYear()}
        </div>
        <button
          className="he-cal-nav-btn"
          onClick={() => onMonthChange(1)}
          aria-label={t.calNext}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Day grid */}
      <div className="he-cal-grid">
        {DAY_LBL[lang].map(d => <div key={d} className="he-cal-dlbl">{d}</div>)}
        {calCells.map((cell, i) => {
          if (cell.isEmpty) return <div key={i} className="he-cal-cell" />;

          const { date } = cell;
          const isPast = dayBefore(date, today) && !sameDay(date, today);
          const isToday = sameDay(date, today);
          const isStart = sameDay(date, checkIn);
          const isEnd   = sameDay(date, checkOut);
          const refEnd  = selectingEnd && hoverDate ? hoverDate : checkOut;
          const inRng   = inRange(date, checkIn, refEnd);
          const isHover = selectingEnd && sameDay(date, hoverDate);
          const s = !isPast ? getSeason(date) : null;

          let cls = 'he-cal-cell';
          if (isStart)                  cls += ' in-range range-start';
          if (isEnd)                    cls += ' in-range range-end';
          if (isHover && !isStart)      cls += ' in-range range-end';
          if (inRng)                    cls += ' in-range';
          if (isToday)                  cls += ' is-today';
          if (s?.label === 'Alta Temporada')  cls += ' s-alta';
          else if (s?.label === 'Carnaval')   cls += ' s-carnaval';
          else if (s?.label === 'Baixa Temporada') cls += ' s-baixa';

          return (
            <div key={i} className={cls}>
              <button
                className="he-cal-day"
                disabled={isPast}
                onClick={() => !isPast && onCalClick(date)}
                onMouseEnter={() => selectingEnd && onHoverDate(date)}
                onMouseLeave={() => selectingEnd && onHoverDate(null)}
              >
                {cell.day}
              </button>
            </div>
          );
        })}
      </div>

      {/* Selected dates bar */}
      {checkIn && (
        <div className="he-dates-sel">
          <div className="he-date-col">
            <div className="he-date-lbl">{t.checkin}</div>
            <div className="he-date-val">{fmtDate(checkIn)}</div>
          </div>
          <div className="he-nights-c">
            {checkOut
              ? `${Math.round((checkOut.getTime()-checkIn.getTime())/86400000)} ${
                  Math.round((checkOut.getTime()-checkIn.getTime())/86400000)===1
                    ? t.tNight : t.tNights2}`
              : ''}
          </div>
          <div className="he-date-col" style={{ textAlign: 'right' }}>
            <div className="he-date-lbl">{t.checkout}</div>
            <div className="he-date-val">{checkOut ? fmtDate(checkOut) : '—'}</div>
          </div>
        </div>
      )}

      {/* Minimum nights warning */}
      {minNightsWarn && <div className="he-min-warn">{minNightsWarn}</div>}

      {/* Season legend */}
      <div className="he-season-info">
        <span className="he-chip media">{t.seasonMedia}</span>
        <span className="he-chip alta">{t.seasonAlta}</span>
        <span className="he-chip carnaval">{t.seasonCarnaval}</span>
        <span className="he-chip baixa">{t.seasonBaixa}</span>
      </div>
    </div>
  );
}
