// frontend/src/components/booking/apartment-selector-step.tsx
//
// Paso 2 del motor de reservas de apartamentos: selector de apartamento.
// Extraído de apartment-engine.tsx para su uso como componente independiente.

'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import styles from './apartment-engine.module.css';
import { ApartmentCard } from './apartment-card';
import type { ApartmentAvailability } from '@/types/global';
import type { AptLocale } from './apartment-engine.types';
import { fmtDate, parseDs, rankApartments } from './apartment-engine.utils';

interface ApartmentSelectorStepProps {
  locale: AptLocale;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  apartments: ApartmentAvailability[];
  isLoading: boolean;
  selectedApartment: ApartmentAvailability | null;
  onSelect: (apt: ApartmentAvailability) => void;
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
  apartments,
  isLoading,
  selectedApartment,
  onSelect,
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
  const availableCount = apartments.filter(
    (a) => a.available && a.capacity >= guestCount,
  ).length;
  const gridSeasonType = apartments[0]?.seasonType;
  const gridSeasonMultiplier = apartments[0]?.seasonMultiplier;

  function seasonShortLabel(
    seasonType: ApartmentAvailability['seasonType'] | undefined,
  ): string {
    switch (seasonType) {
      case 'carnaval': return t('seasonCarnaval');
      case 'alta': return t('seasonAltaShort');
      case 'baja': return t('seasonBaixaShort');
      case 'media': return t('seasonMediaShort');
      default: return '';
    }
  }

  return (
    <div>
      {isLoading ? (
        <div className={styles.spinnerWrap}>{tc('loading')}</div>
      ) : (
        <>
          {/* Cabecera: datePill + título + subtítulo */}
          <div className={styles.aptHeader}>
            <div className={styles.datePill}>
              <strong>{fmtDate(checkIn, locale)}</strong> →{' '}
              <strong>{fmtDate(checkOut, locale)}</strong> · {nights}{' '}
              {nights !== 1 ? t('nights') : t('night')}
              {gridSeasonType &&
                gridSeasonType !== 'media' &&
                gridSeasonMultiplier !== 1 && (
                  <span
                    className={`${styles.cardSeasonBadge} ${
                      gridSeasonType === 'carnaval'
                        ? styles.badgeCarnaval
                        : gridSeasonType === 'alta'
                          ? styles.badgeAlta
                          : styles.badgeBaixa
                    }`}
                  >
                    {gridSeasonType === 'carnaval'
                      ? '🎊 '
                      : gridSeasonType === 'alta'
                        ? '☀️ '
                        : '🌿 '}
                    {seasonShortLabel(gridSeasonType)}
                  </span>
                )}
            </div>
            <h2>{t('chooseApartment')}</h2>
            <p>
              {t('availableForGuests', {
                count: availableCount,
                guests: guestCount,
              })}
            </p>
          </div>

          {/* Grid de apartamentos */}
          <div className={styles.aptGrid}>
            {rankedApartments.map(({ apt, disabledReason }) => (
              <ApartmentCard
                key={apt.id}
                apartment={apt}
                nights={nights}
                selected={selectedApartment?.id === apt.id}
                onSelect={onSelect}
                disabledReason={disabledReason}
                globalCheckIn={parseDs(checkIn)}
                globalCheckOut={parseDs(checkOut)}
                onApplyDates={onApplyDates}
              />
            ))}
          </div>

          {/* Botón volver */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnBack}
              onClick={onBack}
            >
              ← {tc('back')}
            </button>
          </div>
        </>
      )}

      {/* Sticky bar inferior cuando hay apartamento seleccionado */}
      {selectedApartment && (
        <div className={styles.stickyBar}>
          <div className={styles.stickyBarInfo}>
            <strong>{selectedApartment.name}</strong> · R${' '}
            <strong style={{ color: 'var(--accent)' }}>
              {selectedApartment.priceTotal.toLocaleString('pt-BR')}
            </strong>
          </div>
          <button
            type="button"
            className={styles.stickyBarBtn}
            onClick={onContinue}
          >
            {tc('continue')} →
          </button>
        </div>
      )}
    </div>
  );
};
