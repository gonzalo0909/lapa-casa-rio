// lapa-casa-hostel/frontend/src/components/booking/apartment-card.tsx

"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApartmentMiniCalendar } from './apartment-mini-calendar';
import type { ApartmentAvailability } from '@/types/global';

interface ApartmentCardProps {
  apartment: ApartmentAvailability;
  nights: number;
  selected: boolean;
  onSelect: (apt: ApartmentAvailability) => void;
  /** 'too-small': no aparece deshabilitado por falta de disponibilidad sino
   * porque no entran los huéspedes elegidos -- distinto mensaje/estilo. */
  disabledReason?: 'unavailable' | 'too-small';
  guestCount?: number;
  globalCheckIn?: Date | null;
  globalCheckOut?: Date | null;
  onApplyDates?: (range: { checkIn: Date; checkOut: Date }) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

const APARTMENT_ICONS: Record<string, string> = {
  'apt-01': '🏙️',
  'apt-02': '🌉',
  'apt-03': '🏡',
  'apt-04': '🎨',
  'apt-05': '⛰️',
  'apt-06': '🎶',
  'apt-07': '🌿',
  'apt-08': '🏢',
  'apt-09': '✨',
  'apt-10': '🎬',
};

export const ApartmentCard: React.FC<ApartmentCardProps> = ({
  apartment,
  nights,
  selected,
  onSelect,
  disabledReason,
  guestCount,
  globalCheckIn,
  globalCheckOut,
  onApplyDates,
  locale = 'pt',
}) => {
  const t = useTranslations('apartments');
  const icon = APARTMENT_ICONS[apartment.code] ?? '🏠';
  const [calOpen, setCalOpen] = useState(false);
  const isSelectable = !disabledReason;

  return (
    <Card
      className={`overflow-hidden transition-all ${
        disabledReason ? 'opacity-50' : ''
      } ${selected ? 'ring-2 ring-primary' : ''}`}
    >
      {/* Franja de color por disponibilidad */}
      <div
        className={`h-1.5 w-full ${
          isSelectable ? 'bg-green-500' : 'bg-muted-foreground/30'
        }`}
      />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-bold text-foreground text-base leading-tight">
                {apartment.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('upToGuests', { count: apartment.capacity })}
              </p>
            </div>
          </div>
          <Badge variant={isSelectable ? 'success' : 'secondary'}>
            {apartment.available ? t('available') : t('unavailable')}
          </Badge>
        </div>

        {apartment.seasonType && apartment.seasonMultiplier !== 1 && (
          <div className="mb-3">
            <span
              className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${
                apartment.seasonType === 'carnaval'
                  ? 'bg-amber-100 text-amber-800'
                  : apartment.seasonMultiplier > 1
                  ? 'bg-primary/10 text-primary'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {seasonLabel(apartment.seasonType, t)} ×{apartment.seasonMultiplier.toFixed(1)}
            </span>
          </div>
        )}

        {disabledReason === 'too-small' && guestCount && (
          <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded px-2 py-1 mb-3">
            ⚠️ {t('maxCapacity', { count: apartment.capacity })}
          </p>
        )}

        <div className="bg-muted/50 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('perNight')}</span>
            <span className="font-bold text-foreground">
              R$ {apartment.basePrice.toFixed(0)}
            </span>
          </div>
          {nights > 0 && (
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {nights} {nights === 1 ? t('night') : t('nights')}
              </span>
              <span className="font-bold text-primary text-lg">
                R$ {(apartment.priceTotal ?? apartment.basePrice * nights).toFixed(0)}
              </span>
            </div>
          )}
        </div>

        {onApplyDates && globalCheckIn !== undefined && globalCheckOut !== undefined && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setCalOpen((v) => !v)}
              className="text-xs text-primary underline underline-offset-2"
            >
              📅 {t('adjustDates')}
            </button>
            {calOpen && (
              <div className="mt-2">
                <ApartmentMiniCalendar
                  apartmentId={apartment.id}
                  globalCheckIn={globalCheckIn}
                  globalCheckOut={globalCheckOut}
                  onApply={(range) => {
                    onApplyDates(range);
                    setCalOpen(false);
                  }}
                  locale={locale}
                />
              </div>
            )}
          </div>
        )}

        <Button
          variant={selected ? 'primary' : 'outline'}
          className="w-full"
          disabled={!isSelectable}
          onClick={() => isSelectable && onSelect(apartment)}
        >
          {selected
            ? `✓ ${t('selected')}`
            : isSelectable
            ? t('select')
            : t('unavailable')}
        </Button>
      </div>
    </Card>
  );
};

function seasonLabel(type: string, t: ReturnType<typeof useTranslations>): string {
  switch (type) {
    case 'carnaval': return `🎊 ${t('seasonCarnaval')}`;
    case 'alta': return `☀️ ${t('seasonAlta')}`;
    case 'baja': return `🌿 ${t('seasonBaja')}`;
    default: return t('seasonMedia');
  }
}
