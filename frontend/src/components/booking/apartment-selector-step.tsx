// frontend/src/components/booking/apartment-selector-step.tsx
//
// Paso 2 del motor de reservas de apartamentos: selector de apartamento.
//
// Tres estados de render:
//   A) selectedApartment && available    → vista expandida con mini-cal + Continuar
//   B) selectedApartment && !available   → apt bloqueado (no disponible) + alternativas
//   C) !selectedApartment                → grid completo de apartamentos

'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Info } from 'lucide-react';
import styles from './apartment-engine.module.css';
import { ApartmentCard } from './apartment-card';
import type { ApartmentAvailability } from '@/types/global';
import { MAX_APT_GUESTS, type AptLocale } from './apartment-engine.types';
import { fmtDate, parseDs, rankApartments } from './apartment-engine.utils';

interface ApartmentSelectorStepProps {
  locale: AptLocale;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  onGuestCountChange: (count: number) => void;
  apartments: ApartmentAvailability[];
  isLoading: boolean;
  selectedApartment: ApartmentAvailability | null;
  onSelect: (apt: ApartmentAvailability) => void;
  onDeselect: () => void;
  onApplyDates: (range: { checkIn: Date; checkOut: Date }) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const ApartmentSelectorStep: React.FC<ApartmentSelectorStepProps> = ({
  locale,
  checkIn,
  checkOut,
  nights,
  guestCount,
  onGuestCountChange,
  apartments,
  isLoading,
  selectedApartment,
  onSelect,
  onDeselect,
  onApplyDates,
  onBack,
  onContinue,
}) => {
  const t = useTranslations('apartments');
  const tc = useTranslations('common');

  const rankedApartments = useMemo(
    () => rankApartments(apartments, guestCount),
    [apartments, guestCount],
  );

  // Alternativas: disponibles, sin disabledReason, excluyendo el seleccionado
  const availableAlternatives = useMemo(
    () => rankedApartments.filter(
      ({ apt, disabledReason: dr }) =>
        apt.available && !dr && apt.id !== selectedApartment?.id,
    ),
    [rankedApartments, selectedApartment],
  );

  const datePill = (
    <div className={styles.datePill}>
      <strong>{fmtDate(checkIn, locale)}</strong> →{' '}
      <strong>{fmtDate(checkOut, locale)}</strong> · {nights}{' '}
      {nights !== 1 ? t('nights') : t('night')}
      <span className={styles.datePillGuests}>
        <button
          type="button"
          className={styles.guestCounterBtn}
          onClick={() => onGuestCountChange(Math.max(1, guestCount - 1))}
          disabled={guestCount <= 1}
          aria-label="-"
        >−</button>
        <span className={styles.guestCounterVal}>{guestCount} {guestCount === 1 ? t('guest') : t('guests')}</span>
        <button
          type="button"
          className={styles.guestCounterBtn}
          onClick={() => onGuestCountChange(Math.min(MAX_APT_GUESTS, guestCount + 1))}
          disabled={guestCount >= MAX_APT_GUESTS}
          aria-label="+"
        >+</button>
      </span>
    </div>
  );

  return (
    <div>
      {isLoading && !selectedApartment ? (
        /* ── Cargando (sin selección previa) ─── */
        <div className={styles.spinnerWrap}>{tc('loading')}</div>

      ) : selectedApartment && selectedApartment.available ? (
        /* ── A) Apartamento seleccionado y disponible ─── */
        <>
          <div className={styles.aptHeader}>
            {datePill}
            {isLoading
              ? <div className={styles.loadingInline}>{tc('loading')}</div>
              : <h2>{selectedApartment.name}</h2>}
          </div>

          <ApartmentCard
            apartment={selectedApartment}
            nights={nights}
            selected={true}
            onSelect={onSelect}
            disabledReason={undefined}
            globalCheckIn={parseDs(checkIn)}
            globalCheckOut={parseDs(checkOut)}
            onApplyDates={onApplyDates}
            onContinue={isLoading ? undefined : onContinue}
            guestCount={guestCount}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.cardChangeLink} onClick={onDeselect}>
              ← {t('changeApartment')}
            </button>
          </div>
        </>

      ) : selectedApartment && !selectedApartment.available ? (
        /* ── B) Seleccionado pero sin disponibilidad para las nuevas fechas ─── */
        <>
          <div className={styles.aptHeader}>
            {datePill}
            {isLoading && <div className={styles.loadingInline}>{tc('loading')}</div>}
          </div>

          {/* Banner de aviso */}
          <div className={styles.unavailBanner}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '.1rem' }} />
            <span>{t('noAvailabilityBanner')}</span>
          </div>

          {/* Tu selección — bloqueada */}
          <div className={styles.blockedSection}>
            <div className={styles.blockedSectionTitle}>{t('yourSelection')}</div>
            <ApartmentCard
              apartment={selectedApartment}
              nights={nights}
              selected={true}         /* muestra mini-cal para ajustar fechas */
              onSelect={() => {}}     /* no-op: no se puede seleccionar bloqueado */
              disabledReason="unavailable"  /* borde ámbar, sin botón Continuar */
              globalCheckIn={parseDs(checkIn)}
              globalCheckOut={parseDs(checkOut)}
              onApplyDates={onApplyDates}
              onContinue={undefined}  /* sin botón Continuar */
              guestCount={guestCount}
            />
            <div className={styles.actions}>
              <button type="button" className={styles.cardChangeLink} onClick={onDeselect}>
                ← {t('changeApartment')}
              </button>
            </div>
          </div>

          {/* Alternativas disponibles */}
          {availableAlternatives.length > 0 ? (
            <div className={styles.alternativesSection}>
              <div className={styles.alternativesTitle}>{t('availableAlternatives')}</div>
              <div className={styles.aptGrid}>
                {availableAlternatives.map(({ apt, disabledReason: dr }) => (
                  <ApartmentCard
                    key={apt.id}
                    apartment={apt}
                    nights={nights}
                    selected={false}
                    onSelect={onSelect}
                    disabledReason={dr}
                    globalCheckIn={parseDs(checkIn)}
                    globalCheckOut={parseDs(checkOut)}
                    onApplyDates={onApplyDates}
                    guestCount={guestCount}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.noAlternativesBanner}>
              {t('noAlternativesAvailable')}
            </div>
          )}
        </>

      ) : (
        /* ── C) Grid completo de apartamentos ─── */
        <>
          <div className={styles.aptHeader}>
            {datePill}
            <h2>{t('chooseApartment')}</h2>
            <p>
              {t('availableForGuests', {
                count: rankedApartments.filter(({ apt, disabledReason }) => apt.available && !disabledReason).length,
                guests: guestCount,
              })}
            </p>
          </div>

          {apartments.some((a) => a.pricingFailed) && (
            <div className={styles.unavailBanner} style={{ borderColor: 'var(--color-info, #3b82f6)', background: 'var(--color-info-bg, #eff6ff)' }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: '.1rem' }} />
              <span>{t('pricingEstimate')}</span>
            </div>
          )}

          <div className={styles.aptGrid}>
            {rankedApartments.map(({ apt, disabledReason }) => (
              <ApartmentCard
                key={apt.id}
                apartment={apt}
                nights={nights}
                selected={false}
                onSelect={onSelect}
                disabledReason={disabledReason}
                globalCheckIn={parseDs(checkIn)}
                globalCheckOut={parseDs(checkOut)}
                onApplyDates={onApplyDates}
                guestCount={guestCount}
              />
            ))}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnBack} onClick={onBack}>
              ← {tc('back')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
