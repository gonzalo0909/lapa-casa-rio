// lapa-casa-hostel/frontend/src/components/booking/booking-summary.tsx

"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { PriceSummary } from './price-summary';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DateRange, Room, GuestDetails } from '@/types/global';

interface BookingSummaryProps {
  dateRange: DateRange;
  rooms: Room[];
  guestDetails: GuestDetails | null;
  totalPrice: number;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

/**
 * El Select de horário de chegada (contact-details.tsx) sempre manda um
 * horário único "HH:MM" (ex. "14:00", "14:30" ... "22:00") -- nunca um
 * intervalo "14-16". O `.replace('-', ':00 - ')` original assumia esse
 * formato antigo e quebrava o valor real ("14:00" virava "14:00:00").
 * Suporta os 3 formatos possíveis para não quebrar se o Select mudar.
 */
function formatArrivalTime(value: string): string {
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    return value;
  }
  if (/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(value)) {
    return value.replace(/\s*-\s*/, ' - ');
  }
  if (/^\d{1,2}-\d{1,2}$/.test(value)) {
    const [start, end] = value.split('-');
    return `${start}:00 - ${end}:00`;
  }
  return value;
}

export const BookingSummary: React.FC<BookingSummaryProps> = ({
  dateRange,
  rooms,
  guestDetails,
  totalPrice,
  locale = 'pt',
  className = ''
}) => {
  const t = useTranslations('bookingSummary');

  const nights = dateRange.checkIn && dateRange.checkOut
    ? Math.ceil((dateRange.checkOut.getTime() - dateRange.checkIn.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const totalBeds = rooms.reduce((sum, room) => sum + room.bedsCount, 0);

  return (
    <div className={`booking-summary ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card className="p-6 mb-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <span>📅</span> {t('dates')}
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('checkIn')}:</span>
            <span className="font-medium">{formatDate(dateRange.checkIn!, locale)} - 14:00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('checkOut')}:</span>
            <span className="font-medium">{formatDate(dateRange.checkOut!, locale)} - 12:00</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-muted-foreground">{t('totalNights')}:</span>
            <span className="font-semibold">{nights} {nights === 1 ? t('night') : t('nights')}</span>
          </div>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <span>🛏️</span> {t('rooms')}
        </h3>
        <div className="space-y-3">
          {rooms.map((room, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-foreground">{room.name}</p>
                <p className="text-sm text-muted-foreground">
                  {room.bedsCount} {room.bedsCount === 1 ? t('bed') : t('beds')}
                </p>
              </div>
              <Badge>{room.type === 'female' ? '👩' : room.isFlexible ? '🔄' : '👥'}</Badge>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-muted-foreground">{t('totalBeds')}:</span>
            <span className="font-semibold">{totalBeds} {totalBeds === 1 ? t('bed') : t('beds')}</span>
          </div>
        </div>
      </Card>

      {guestDetails?.fullName && (
        <Card className="p-6 mb-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <span>👤</span> {t('guest')}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('name')}:</span>
              <span className="font-medium">{guestDetails.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('email')}:</span>
              <span className="font-medium">{guestDetails.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('phone')}:</span>
              <span className="font-medium">{guestDetails.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('country')}:</span>
              <span className="font-medium">{guestDetails.country}</span>
            </div>
            {guestDetails.arrivalTime && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('arrivalTime')}:</span>
                <span className="font-medium">{formatArrivalTime(guestDetails.arrivalTime)}</span>
              </div>
            )}
          </div>
          {guestDetails.specialRequests && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-1">{t('specialRequests')}:</p>
              <p className="text-sm text-foreground">{guestDetails.specialRequests}</p>
            </div>
          )}
        </Card>
      )}

      <PriceSummary
        dateRange={dateRange}
        rooms={rooms}
        totalPrice={totalPrice}
        locale={locale}
      />

      <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg">
        <p className="text-sm text-green-800 dark:text-green-200 text-center">
          ✓ {t('confirmation')}
        </p>
      </div>
    </div>
  );
};

const BCP47: Record<string, string> = { pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE' };

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(
    BCP47[locale] ?? 'en-US',
    { day: '2-digit', month: 'long', year: 'numeric' }
  );
}
