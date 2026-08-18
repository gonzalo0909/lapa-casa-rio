// frontend/src/components/booking/apartment-selector-step.tsx
//
// Paso 2 del motor de reservas de apartamentos: selector de apartamento.
// Flujo: grid → selección → apartamento expandido con mini cal + continuar.

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

  return (
    <div>
      {isLoading ? (
        <div className={styles.spinnerWrap}>{tc('loading')}</div>
      ) : selectedApartment ? (
        /* ── Apartamento seleccionado: vista expandida ─── */
        <>
          {/* Cabecera con fechas */}
          <div className={styles.aptHeader}>
            <div className={styles.datePill}>
              <strong>{fmtDate(checkIn, locale)}</strong> →{' '}
              <strong>{fmtDate(checkOut, locale)}</strong> · {nights}{' '}
              {nights !== 1 ? t('nights') : t('night')}
            </div>
            <h2>{selectedApartment.name}</h2>
          </div>

          {/* Card expandida del apartamento seleccionado */}
          <ApartmentCard
            apartment={selectedApartment}
            nights={nights}
            selected={true}
            onSelect={onSelect}
            disabledReason={undefined}
            globalCheckIn={parseDs(checkIn)}
            globalCheckOut={parseDs(checkOut)}
            onApplyDates={onApplyDates}
            onContinue={onContinue}
          />

          {/* Volver al grid */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cardChangeLink}
              onClick={onDeselect}
            >
              ← {t('changeApartment')}
            </button>
          </div>
        </>
      ) : (
        /* ── Grid de apartamentos ────────────────────── */
        <>
          {/* Cabecera: datePill + título + subtítulo */}
          <div className={styles.aptHeader}>
            <div className={styles.datePill}>
              <strong>{fmtDate(checkIn, locale)}</strong> →{' '}
              <strong>{fmtDate(checkOut, locale)}</strong> · {nights}{' '}
              {nights !== 1 ? t('nights') : t('night')}
            </div>
            <h2>{t('chooseApartment')}</h2>
            <p>
              {t('availableForGuests', {
                count: rankedApartments.filter(({ apt, disabledReason }) => apt.available && !disabledReason).length,
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
                selected={false}
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
    </div>
  );
};
