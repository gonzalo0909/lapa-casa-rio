// lapa-casa-hostel/frontend/src/components/booking/apartment-card.tsx

'use client';

import React, { useState } from 'react';
import styles from './apartment-engine.module.css';
import { ApartmentMiniCalendar } from './apartment-mini-calendar';
import type { ApartmentAvailability } from '@/types/global';

/** Mismo orden/gradiente que LCACOPIA (APT_COLORS), por codigo apt-01..apt-10. */
const APT_GRADIENTS = [
  'linear-gradient(135deg,#1E3A5F,#2D5F8A)',
  'linear-gradient(135deg,#2D5F4A,#1E3A2F)',
  'linear-gradient(135deg,#5F3A1E,#8A5A2D)',
  'linear-gradient(135deg,#3A1E5F,#5A2D8A)',
  'linear-gradient(135deg,#1E4F5F,#2D7A8A)',
  'linear-gradient(135deg,#5F4A1E,#8A6A2D)',
  'linear-gradient(135deg,#1E5F3A,#2D8A5A)',
  'linear-gradient(135deg,#5F1E3A,#8A2D5A)',
  'linear-gradient(135deg,#3A3A1E,#5F5A2D)',
  'linear-gradient(135deg,#1E3A5F,#5A2D2D)',
];

const APT_ICONS: Record<string, string> = {
  'apt-01': '🏙️', 'apt-02': '🌉', 'apt-03': '🏡', 'apt-04': '🎨', 'apt-05': '⛰️',
  'apt-06': '🎶', 'apt-07': '🌿', 'apt-08': '🏢', 'apt-09': '✨', 'apt-10': '🎬',
};

const FALLBACK_GRADIENT = 'linear-gradient(135deg,#1E3A5F,#2D5F8A)';

function gradientFor(code: string): string {
  const idx = parseInt(code.replace('apt-', ''), 10) - 1;
  return APT_GRADIENTS[idx] ?? FALLBACK_GRADIENT;
}

function seasonBadgeClass(seasonType: ApartmentAvailability['seasonType']): string {
  switch (seasonType) {
    case 'carnaval': return styles.badgeCarnaval ?? '';
    case 'alta': return styles.badgeAlta ?? '';
    case 'baja': return styles.badgeBaixa ?? '';
    default: return '';
  }
}
function seasonLabel(seasonType: ApartmentAvailability['seasonType']): string {
  switch (seasonType) {
    case 'carnaval': return '🎊 Carnaval';
    case 'alta': return '☀️ Alta';
    case 'baja': return '🌿 Baixa';
    default: return '';
  }
}

interface ApartmentCardProps {
  apartment: ApartmentAvailability;
  nights: number;
  selected: boolean;
  onSelect: (apt: ApartmentAvailability) => void;
  disabledReason?: 'unavailable' | 'too-small';
  globalCheckIn: Date;
  globalCheckOut: Date;
  onApplyDates: (range: { checkIn: Date; checkOut: Date }) => void;
}

export const ApartmentCard: React.FC<ApartmentCardProps> = ({
  apartment,
  nights,
  selected,
  onSelect,
  disabledReason,
  globalCheckIn,
  globalCheckOut,
  onApplyDates,
}) => {
  const [calOpen, setCalOpen] = useState(false);
  const isSelectable = !disabledReason;
  const seasonBadge = apartment.seasonType !== 'media'
    ? <span className={`${styles.cardSeasonBadge} ${seasonBadgeClass(apartment.seasonType)}`}>{seasonLabel(apartment.seasonType)}</span>
    : null;
  const mulBadge = apartment.seasonMultiplier !== 1
    ? <span className={`${styles.priceMultiplier} ${seasonBadgeClass(apartment.seasonType)}`}>×{apartment.seasonMultiplier}</span>
    : null;
  const baseNote = apartment.seasonMultiplier !== 1
    ? <span className={styles.priceBaseStrike}>R$ {apartment.basePrice.toFixed(0)}</span>
    : null;
  const nightPrice = nights > 0 ? Math.round(apartment.priceTotal / nights) : Math.round(apartment.basePrice * apartment.seasonMultiplier);

  return (
    <div
      className={`${styles.aptCard} ${disabledReason ? styles.aptCardUnavailable : ''} ${selected ? styles.aptCardSelected : ''}`}
    >
      <div className={styles.aptPhoto} style={{ background: gradientFor(apartment.code) }}>
        <span className={styles.aptPhotoIcon}>{APT_ICONS[apartment.code] ?? '🏠'}</span>
        <span className={styles.aptPhotoLabel}>📷 Foto ilustrativa</span>
        <span className={`${styles.availStripe} ${apartment.available ? styles.availStripeAvail : styles.availStripeUnavail}`}>
          {apartment.available ? 'Disponível' : 'Indisponível'}
        </span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardName}>{apartment.name}</div>
            <div className={styles.cardCapacity}>até {apartment.capacity} hóspede{apartment.capacity !== 1 ? 's' : ''}</div>
            {disabledReason === 'too-small' && (
              <div className={styles.cardCapacityWarn}>⚠️ Capacidade máx: {apartment.capacity} hóspedes</div>
            )}
          </div>
        </div>

        <div className={styles.cardPriceBox}>
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>por noite</span>
            <span className={styles.pricePerNight}>{baseNote}R$ {nightPrice}{mulBadge}</span>
          </div>
          {nights > 0 && (
            <>
              <div className={styles.priceDivider} />
              <div className={styles.priceRow}>
                <span className={styles.nightsLabel}>{nights} noite{nights !== 1 ? 's' : ''}</span>
                <span className={styles.priceTotal}>R$ {apartment.priceTotal.toLocaleString('pt-BR')}</span>
              </div>
            </>
          )}
        </div>
        {seasonBadge}

        {isSelectable && (
          <button
            type="button"
            className={styles.aptCalToggle}
            onClick={(e) => { e.stopPropagation(); setCalOpen((v) => !v); }}
          >
            📅 Ajustar datas / ver disponibilidade
          </button>
        )}
        {calOpen && (
          <ApartmentMiniCalendar
            apartmentId={apartment.id}
            globalCheckIn={globalCheckIn}
            globalCheckOut={globalCheckOut}
            onApply={(range) => { onApplyDates(range); setCalOpen(false); }}
          />
        )}

        <button
          type="button"
          className={`${styles.cardBtn} ${selected ? styles.cardBtnSelected : ''}`}
          disabled={!isSelectable}
          onClick={() => isSelectable && onSelect(apartment)}
        >
          {selected ? '✓ Selecionado' : !apartment.available ? 'Indisponível' : disabledReason === 'too-small' ? 'Capacidade insuficiente' : 'Selecionar'}
        </button>
      </div>
    </div>
  );
};

export { APT_ICONS };
