// lapa-casa-hostel/frontend/src/components/booking/apartment-card.tsx

"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ApartmentAvailability } from '@/types/global';

interface ApartmentCardProps {
  apartment: ApartmentAvailability;
  nights: number;
  selected: boolean;
  onSelect: (apt: ApartmentAvailability) => void;
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
}) => {
  const t = useTranslations('apartments');
  const icon = APARTMENT_ICONS[apartment.code] ?? '🏠';

  return (
    <Card
      className={`overflow-hidden transition-all ${
        !apartment.available ? 'opacity-50' : ''
      } ${selected ? 'ring-2 ring-primary' : ''}`}
    >
      {/* Franja de color por disponibilidad */}
      <div
        className={`h-1.5 w-full ${
          apartment.available ? 'bg-green-500' : 'bg-muted-foreground/30'
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
          <Badge variant={apartment.available ? 'success' : 'secondary'}>
            {apartment.available ? t('available') : t('unavailable')}
          </Badge>
        </div>

        <div className="bg-muted/50 rounded-lg p-3 mb-4">
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

        <Button
          variant={selected ? 'default' : 'outline'}
          className="w-full"
          disabled={!apartment.available}
          onClick={() => apartment.available && onSelect(apartment)}
        >
          {selected
            ? `✓ ${t('selected')}`
            : apartment.available
            ? t('select')
            : t('unavailable')}
        </Button>
      </div>
    </Card>
  );
};
