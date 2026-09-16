// lapa-casa-hostel/frontend/src/components/booking/apartment-card.tsx

'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useCurrency, convertBRL } from '@/hooks/use-currency';
import {
  Building2, Landmark, Home, Palette, Mountain, Music, Leaf, Building,
  Sparkles, Clapperboard, Calendar, AlertTriangle, Clock,
  MapPin, ChevronLeft, ChevronRight, type LucideIcon,
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
  guestCount?: number;
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
  guestCount,
}) => {
  const t = useTranslations('apartments');
  const tc = useTranslations('common');
  const currency = useCurrency();
  const pathname = usePathname();
  const [calOpen, setCalOpen] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);

  // WhatsApp share — construye el link al cargar (client-side), incluye URL de la página
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const pageUrl = `${siteUrl}${pathname}`;
  const waText = `${apartment.name} — Lapa Casa Rio\n${pageUrl}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;
  const isSelectable = !disabledReason;
  const PhotoIcon = APT_ICONS[apartment.code] ?? Home;
  const nightPrice = nights > 0 ? Math.round(apartment.priceTotal / nights) : Math.round(apartment.basePrice * apartment.seasonMultiplier);
  const photos = apartment.photos ?? [];
  const hasPhotos = photos.length > 0;
  const currentPhoto = photos[photoIdx];

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIdx((i) => (i - 1 + photos.length) % photos.length);
  };
  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIdx((i) => (i + 1) % photos.length);
  };

  return (
    <div
      className={`${styles.aptCard} ${disabledReason ? styles.aptCardUnavailable : ''} ${selected ? styles.aptCardSelected : ''}`}
    >
      <div
        className={styles.aptPhoto}
        style={hasPhotos ? undefined : { background: tintFor(apartment.code) }}
      >
        {hasPhotos ? (
          <>
            <Image
              src={currentPhoto?.url ?? ''}
              alt={currentPhoto?.altText ?? apartment.name}
              className={styles.aptPhotoImg}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 350px"
              draggable={false}
            />
            {photos.length > 1 && (
              <>
                <button type="button" className={`${styles.photoNav} ${styles.photoNavPrev}`} onClick={prevPhoto} aria-label="Foto anterior">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className={`${styles.photoNav} ${styles.photoNavNext}`} onClick={nextPhoto} aria-label="Foto siguiente">
                  <ChevronRight size={16} />
                </button>
                <div className={styles.photoDots}>
                  {photos.map((_, i) => (
                    <span
                      key={i}
                      role="button"
                      tabIndex={0}
                      className={`${styles.photoDot} ${i === photoIdx ? styles.photoDotActive : ''}`}
                      onClick={(e) => { e.stopPropagation(); setPhotoIdx(i); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setPhotoIdx(i); } }}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <span className={styles.aptPhotoIcon}><PhotoIcon size={24} strokeWidth={1.25} /></span>
        )}
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
            {apartment.externalRating !== null && apartment.externalRating !== undefined && (
              <div className={styles.cardExternalRating}>
                ⭐ {apartment.externalRating.toFixed(1)}
                {apartment.externalReviewCount !== null && apartment.externalReviewCount !== undefined && (
                  <span> · {apartment.externalReviewCount} reseñas</span>
                )}
                <span> · {apartment.externalRatingLabel ?? 'plataformas internacionales'}</span>
              </div>
            )}
            {disabledReason === 'too-small' && (
              <div className={styles.cardCapacityWarn}><AlertTriangle size={12} /> {t('maxCapacity', { count: apartment.capacity })}</div>
            )}
          </div>
        </div>

        <div className={styles.cardPriceBox}>
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>{t('perNight')}</span>
            <span className={styles.pricePerNight}>R$ {nightPrice}</span>
          </div>
          {nights > 0 && (
            <>
              <div className={styles.priceDivider} />
              <div className={styles.priceRow}>
                <span className={styles.nightsLabel}>{nights} {nights !== 1 ? t('nights') : t('night')}</span>
                <span className={styles.priceTotal}>
                  R$ {apartment.priceTotal.toLocaleString('pt-BR')}
                  {currency && (
                    <span className={styles.priceConv}>{convertBRL(apartment.priceTotal, currency)}</span>
                  )}
                </span>
              </div>
            </>
          )}
          {apartment.fullPaymentRequired && (
            <div className={styles.fullPaymentNotice}>
              <Clock size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              {t('fullPaymentRequired48h')}
            </div>
          )}
        </div>
        {/* Cuando está seleccionado: mini cal siempre visible + botón Continuar */}
        {selected ? (
          <>
            <ApartmentMiniCalendar
              apartmentId={apartment.id}
              globalCheckIn={globalCheckIn}
              globalCheckOut={globalCheckOut}
              onApply={(range) => { onApplyDates(range); }}
              guestCount={guestCount}
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
                guestCount={guestCount}
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

        {/* Compartir por WhatsApp — siempre visible */}
        <a
          className={styles.cardBtnWa}
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          {t('shareWhatsApp')}
        </a>
      </div>
    </div>
  );
};

export { APT_ICONS };
