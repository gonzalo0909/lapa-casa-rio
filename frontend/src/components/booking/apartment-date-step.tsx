// frontend/src/components/booking/apartment-date-step.tsx
//
// Paso 1 del motor de reservas de apartamentos: selector de fechas y huéspedes.
// Extraído de apartment-engine.tsx para su uso como componente independiente.

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './apartment-engine.module.css';
import { availabilityAPI } from '@/lib/api';
import {
  seasonForDateStr,
  SEASONS,
  CARNAVAL_MULTIPLIER,
  CARNAVAL_MIN_NIGHTS,
} from '@/lib/apartment-seasons';
import type { AptLocale } from './apartment-engine.types';
import {
  parseDs,
  isCarnivalDs,
  fmtDate,
  monthYearLabel,
  weekdayLabels,
  todayDs,
} from './apartment-engine.utils';

interface ApartmentDateStepProps {
  locale: AptLocale;
  guestCount: number;
  onGuestCountChange: (n: number) => void;
  checkIn: string | null;
  checkOut: string | null;
  onDatesChange: (cin: string | null, cout: string | null) => void;
  onContinue: () => void;
}

export const ApartmentDateStep: React.FC<ApartmentDateStepProps> = ({
  locale,
  guestCount,
  onGuestCountChange,
  checkIn,
  checkOut,
  onDatesChange,
  onContinue,
}) => {
  const t = useTranslations('apartments');
  const tc = useTranslations('common');

  const [hoverDs, setHoverDs] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [carnivalRanges, setCarnivalRanges] = useState<
    Array<{ startDate: string; endDate: string }>
  >([]);

  const wdays = useMemo(() => weekdayLabels(locale), [locale]);

  // Carga las fechas de Carnaval para pintar las celdas del calendario.
  // Falla en silencio: es un tinte anticipado, no bloquea la reserva.
  useEffect(() => {
    let cancelled = false;
    availabilityAPI
      .getCarnivalDates()
      .then((res) => {
        if (!cancelled) { setCarnivalRanges(res?.data?.dates ?? []); }
      })
      .catch(() => { /* tinte opcional */ });
    return () => { cancelled = true; };
  }, []);

  const nights =
    checkIn && checkOut
      ? Math.round(
          (parseDs(checkOut).getTime() - parseDs(checkIn).getTime()) /
            86400000,
        )
      : 0;

  const seasonHint = checkIn ? seasonForDateStr(checkIn) : null;
  const minNightsWarn = !!(
    seasonHint &&
    nights > 0 &&
    nights < seasonHint.minNights
  );

  const handleDayClick = (ds: string) => {
    if (ds < todayDs()) { return; }
    if (!checkIn || (checkIn && checkOut)) {
      onDatesChange(ds, null);
    } else if (ds <= checkIn) {
      onDatesChange(ds, null);
    } else {
      onDatesChange(checkIn, ds);
    }
    setHoverDs(null);
  };

  const goPrevMonth = () => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  };

  const goNextMonth = () => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  };

  function renderMonth(y: number, m: number) {
    const dim = new Date(y, m + 1, 0).getDate();
    const fdow = new Date(y, m, 1).getDay();
    const startDs = checkIn;
    const endDs =
      checkOut ||
      (checkIn && hoverDs && hoverDs > checkIn ? hoverDs : null);
    const hasEnd = !!(startDs && endDs);
    const today_ = todayDs();
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < fdow; i++) {
      cells.push(
        <div
          key={'e' + i}
          className={`${styles.dayCell} ${styles.dayCellEmpty}`}
        />,
      );
    }

    for (let d = 1; d <= dim; d++) {
      const s = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const past = s < today_;
      const isToday = s === today_;
      const isCin = s === startDs;
      const isCout = s === checkOut;
      const inRng =
        hasEnd && s > (startDs as string) && s < (endDs as string);
      const isHov = !!(
        !checkOut &&
        checkIn &&
        hoverDs &&
        s === hoverDs &&
        hoverDs > checkIn
      );
      const season = !past ? seasonForDateStr(s) : null;
      const isCarnival = !past && isCarnivalDs(s, carnivalRanges);

      let cls = styles.dayCell;
      if (past) { cls += ` ${styles.dayCellPast}`; }
      else if (isCarnival) { cls += ` ${styles.dayCellCarnival}`; }
      else if (season?.name === 'alta') { cls += ` ${styles.dayCellAlta}`; }
      else if (season?.name === 'baixa') { cls += ` ${styles.dayCellBaixa}`; }

      if (isCin) {
        cls += ` ${styles.dayCellSelStart}${hasEnd ? ` ${styles.dayCellHasEnd}` : ''}`;
      }
      if (isCout) { cls += ` ${styles.dayCellSelEnd}`; }
      if (inRng) { cls += ` ${styles.dayCellInRange}`; }
      if (isHov) { cls += ` ${styles.dayCellHov}`; }

      cells.push(
        <button
          key={s}
          type="button"
          className={cls}
          disabled={past}
          onClick={() => handleDayClick(s)}
          onMouseEnter={() => !past && setHoverDs(s)}
        >
          <span className={styles.dayNum}>{d}</span>
          {isToday && <span className={styles.todayDot} />}
        </button>,
      );
    }

    return (
      <div className={styles.calMonth}>
        <div className={styles.monthTitle}>
          {monthYearLabel(y, m, locale)}
        </div>
        <div className={styles.wdayHeaders}>
          {wdays.map((w, i) => (
            <span key={i} className={styles.wday}>
              {w}
            </span>
          ))}
        </div>
        <div
          className={styles.dayCells}
          onMouseLeave={() => setHoverDs(null)}
        >
          {cells}
        </div>
      </div>
    );
  }

  const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
  const prevDisabled =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth());

  return (
    <div>
      {/* Contador de huéspedes */}
      <div className={styles.guestCounterWrap}>
        <div className={styles.guestCounterLabel}>
          {t('guestCount', { count: guestCount })}
          <small>{t('guestCountHint')}</small>
        </div>
        <div className={styles.guestCounterBtns}>
          <button
            type="button"
            className={styles.gcntBtn}
            disabled={guestCount <= 1}
            onClick={() => onGuestCountChange(Math.max(1, guestCount - 1))}
          >
            −
          </button>
          <span className={styles.gcntVal}>{guestCount}</span>
          <button
            type="button"
            className={styles.gcntBtn}
            disabled={guestCount >= 4}
            onClick={() => onGuestCountChange(Math.min(4, guestCount + 1))}
          >
            +
          </button>
        </div>
      </div>

      {/* Leyenda de temporadas */}
      <div className={styles.seasonLegend}>
        <span className={`${styles.seasonChip} ${styles.seasonChipCarnaval}`}>
          🎊 {t('seasonCarnaval')} ×{CARNAVAL_MULTIPLIER.toFixed(1)}
        </span>
        <span className={`${styles.seasonChip} ${styles.seasonChipAlta}`}>
          ☀️ {t('seasonAltaShort')} ×{SEASONS.alta.multiplier.toFixed(1)}
        </span>
        <span className={`${styles.seasonChip} ${styles.seasonChipMedia}`}>
          — {t('seasonMediaShort')} ×{SEASONS.media.multiplier.toFixed(1)}
        </span>
        <span className={`${styles.seasonChip} ${styles.seasonChipBaixa}`}>
          🌿 {t('seasonBaixaShort')} ×{SEASONS.baixa.multiplier.toFixed(1)}
        </span>
      </div>

      {/* Calendario de dos meses */}
      <div className={styles.calWrapper}>
        <button
          type="button"
          className={styles.calNav}
          disabled={prevDisabled}
          onClick={goPrevMonth}
        >
          ‹
        </button>
        <div className={styles.calMonths}>
          {renderMonth(viewYear, viewMonth)}
          {renderMonth(nextY, nextM)}
        </div>
        <button type="button" className={styles.calNav} onClick={goNextMonth}>
          ›
        </button>
      </div>

      {/* Advertencia de mínimo de noches */}
      {minNightsWarn && seasonHint && (
        <div className={styles.carnivalWarn}>
          📅{' '}
          {t.rich('minNightsWarning', {
            b: (chunks) => <strong>{chunks}</strong>,
            seasonLabel:
              seasonHint.name === 'alta'
                ? t('seasonAlta')
                : seasonHint.name === 'baixa'
                  ? t('seasonBaja')
                  : t('seasonMedia'),
            nights: seasonHint.minNights,
            carnavalNights: CARNAVAL_MIN_NIGHTS,
          })}
        </div>
      )}

      {/* Barra inferior: fechas seleccionadas + botón continuar */}
      <div className={styles.actions} style={{ marginTop: '1.25rem' }}>
        <div
          className={`${styles.dateInfo} ${!checkIn ? styles.dateInfoHint : ''}`}
        >
          {!checkIn ? (
            t('selectCheckinDate')
          ) : !checkOut ? (
            t.rich('checkinSelectedHint', {
              b: (chunks) => <strong>{chunks}</strong>,
              date: fmtDate(checkIn, locale),
            })
          ) : (
            <>
              <strong>{fmtDate(checkIn, locale)}</strong> →{' '}
              <strong>{fmtDate(checkOut, locale)}</strong> ·{' '}
              <strong>{nights}</strong>{' '}
              {nights !== 1 ? t('nights') : t('night')}
            </>
          )}
        </div>
        <button
          type="button"
          className={`${styles.btnContinue} ${checkIn && checkOut ? styles.btnContinueActive : ''}`}
          onClick={onContinue}
          disabled={!checkIn || !checkOut}
        >
          {tc('continue')} →
        </button>
      </div>
    </div>
  );
};
