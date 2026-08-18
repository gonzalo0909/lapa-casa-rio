// lapa-casa-hostel/frontend/src/components/booking/apartment-card.tsx

'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Building2, Landmark, Home, Palette, Mountain, Music, Leaf, Building,
  Sparkles, Clapperboard, Camera, Calendar, AlertTriangle, Check,
  PartyPopper, Sun, MapPin, type LucideIcon,
} from 'lucide-react';
import styles from './apartment-engine.module.css';
import { ApartmentMiniCalendar } from './apartment-mini-calendar';
import type { ApartmentAvailability } from '@/types/global';

/** Lavados tonales en la familia de marca (verde follaje · azulejo · terracota),
 *  por código apt-01..apt-10. Reemplazan los gradientes LCACOPIA. */
const APT_TINTS = [
  'linear-gradient(135deg,#1E4A3A,#2C6E55)',
  'linear-gradient(135deg,#245A54,#2B7E8C)',
  'linear-gradient(135deg,#3A5A2C,#5B7E3A)',
  'linear-gradient(135deg,#7A4A2C,#C2703D)',
  'linear-gradient(135deg,#2C5545,#4E8A6F)',
  'linear-gradient(135deg,#4A5A2C,#7E8A3A)',
  'linear-gradient(135deg,#1E4A3A,#3A7E6A)',
  'linear-gradient(135deg,#8A5A2A,#C2703D)',
  'linear-gradient(135deg,#245A54,#3A8A7E)',
  'linear-gradient(135deg,#2C4A5A,#3A6E8C)',
];

/** Ícono-motivo por apartamento (placeholder mientras no hay foto real). */
const APT_ICONS: Record<string, LucideIcon> = {
  'apt-01': Building2, 'apt-02': Landmark, 'apt-03': Home, 'apt-04': Palette, 'apt-05': Mountain,
  'apt-06': Music, 'apt-07': Leaf, 'apt-08': Building, 'apt-09': Sparkles, 'apt-10': Clapperboard,
};

const FALLBACK_TINT = 'linear-gradient(135deg,#1E4A3A,#2C6E55)';

function tintFor(code: string): string {
  const idx = parseInt(code.replace('apt-', ''), 10) - 1;
  return APT_TINTS[idx] ?? FALLBACK_TINT;
}

function seasonBadgeClass(seasonType: ApartmentAvailability['seasonType']): string {
  switch (seasonType) {
    case 'carnaval': return styles.badgeCarnaval ?? '';
    case 'alta': return styles.badgeAlta ?? '';
    case 'baja': return styles.badgeBaixa ?? '';
    default: return '';
  }
}
function SeasonLabel({ seasonType, t }: { seasonType: ApartmentAvailability['seasonType']; t: ReturnType<typeof useTranslations> }): React.ReactNode {
  switch (seasonType) {
    case 'carnaval': return <span className={styles.badgeInline}><PartyPopper size={12} /> {t('seasonCarnaval')}</span>;
    case 'alta': return <span className={styles.badgeInline}><Sun size={12} /> {t('seasonAltaShort')}</span>;
    default: return null;
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
  onContinue?: () => void;
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
  onContinue,
}) => {
  const t = useTranslations('apartments');
  const tc = useTranslations('common');
  const [calOpen, setCalOpen] = useState(false);
  const isSelectable = !disabledReason;
  const PhotoIcon = APT_ICONS[apartment.code] ?? Home;
  const seasonBadge = (apartment.seasonType === 'carnaval' || apartment.seasonType === 'alta')
    ? <span className={`${styles.cardSeasonBadge} ${seasonBadgeClass(apartment.seasonType)}`}><SeasonLabel seasonType={apartment.seasonType} t={t} /></span>
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
      <div className={styles.aptPhoto} style={{ background: tintFor(apartment.code) }}>
        <span className={styles.aptPhotoIcon}><PhotoIcon size={44} strokeWidth={1.25} /></span>
        <span className={styles.aptPhotoLabel}><Camera size={11} /> {t('illustrativePhoto')}</span>
        <span className={`${styles.availStripe} ${apartment.available ? styles.availStripeAvail : styles.availStripeUnavail}`}>
          {apartment.available ? t('available') : t('unavailable')}
        </span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardName}>{apartment.name}</div>
            {apartment.neighborhood && (
              <div className={styles.cardNeighborhood}>
                <MapPin size={12} /> {apartment.neighborhood}
              </div>
            )}
            <div className={styles.cardCapacity}>{t('cardCapacity', { count: apartment.capacity })}</div>
            {disabledReason === 'too-small' && (
              <div className={styles.cardCapacityWarn}><AlertTriangle size={12} /> {t('maxCapacity', { count: apartment.capacity })}</div>
            )}
          </div>
        </div>

        <div className={styles.cardPriceBox}>
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>{t('perNight')}</span>
            <span className={styles.pricePerNight}>{baseNote}R$ {nightPrice}{mulBadge}</span>
          </div>
          {nights > 0 && (
            <>
              <div className={styles.priceDivider} />
              <div className={styles.priceRow}>
                <span className={styles.nightsLabel}>{nights} {nights !== 1 ? t('nights') : t('night')}</span>
                <span className={styles.priceTotal}>R$ {apartment.priceTotal.toLocaleString('pt-BR')}</span>
              </div>
            </>
          )}
        </div>
        {seasonBadge}

        {/* Cuando está seleccionado: mini cal siempre visible + botón Continuar */}
        {selected ? (
          <>
            <ApartmentMiniCalendar
              apartmentId={apartment.id}
              globalCheckIn={globalCheckIn}
              globalCheckOut={globalCheckOut}
              onApply={(range) => { onApplyDates(range); }}
            />
            {onContinue && (
              <button
                type="button"
                className={styles.cardContinueBtn}
                onClick={onContinue}
              >
                {tc('continue')} →
              </button>
            )}
          </>
        ) : (
          <>
            {isSelectable && (
              <button
                type="button"
                className={styles.aptCalToggle}
                onClick={(e) => { e.stopPropagation(); setCalOpen((v) => !v); }}
              >
                <Calendar size={13} /> {t('adjustDates')}
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
              {!apartment.available ? t('unavailable') : disabledReason === 'too-small' ? t('insufficientCapacity') : t('select')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export { APT_ICONS };
