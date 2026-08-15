// lapa-casa-hostel/frontend/src/components/booking/pricing-calculator.tsx

"use client";

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PriceBreakdown } from './price-breakdown';
import { GroupDiscountDisplay } from './group-discount-display';
import { SeasonMultiplierDisplay } from './season-multiplier-display';
import { SavingsIndicator } from './savings-indicator';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { availabilityAPI, handleAPIError } from '@/lib/api';
import type { DateRange, Room } from '@/types/global';

/**
 * PricingCalculator Component
 *
 * Pide el precio real a POST /api/v1/availability/quote (temporada +
 * descuento de grupo reales, calculados por el backend) en vez de
 * recalcularlo en el navegador con constantes -- lo que se muestra acá
 * coincide con lo que create-booking.ts termina cobrando de verdad.
 *
 * @component
 */
interface PricingCalculatorProps {
  dateRange: DateRange;
  rooms: Room[];
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

interface QuoteResponse {
  basePrice: number;
  groupDiscountPercent: number;
  discountAmount: number;
  seasonMultiplier: number;
  priceAfterSeason: number;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  nights: number;
  pricePerBed: number;
  breakdown: {
    bedBasePrice: number;
    seasonAdjustment: number;
  };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Chequeo mínimo de forma antes de aceptar la respuesta como QuoteResponse -- evita mostrar precios inventados por un `as` sin validar si el backend cambia de forma. */
function isQuoteResponse(data: unknown): data is QuoteResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const d = data as Record<string, unknown>;
  return (
    typeof d.totalPrice === 'number' &&
    typeof d.basePrice === 'number' &&
    typeof d.depositAmount === 'number' &&
    typeof d.remainingAmount === 'number' &&
    typeof d.nights === 'number' &&
    typeof d.pricePerBed === 'number' &&
    !!d.breakdown &&
    typeof (d.breakdown as Record<string, unknown>).bedBasePrice === 'number' &&
    typeof (d.breakdown as Record<string, unknown>).seasonAdjustment === 'number'
  );
}

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  dateRange,
  rooms,
  locale = 'pt',
  className = ''
}) => {
  const t = useTranslations('pricingCalculator');
  const [pricing, setPricing] = useState<QuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalBeds = rooms.reduce((sum, room) => sum + room.bedsCount, 0);

  // El padre puede recrear el array `rooms` en cada render (nueva
  // referencia con el mismo contenido) -- dependemos de esta huella
  // derivada (solo los campos que realmente afectan la cotización) en
  // vez de `rooms` directamente, para no disparar POST /availability/quote
  // en loop cuando el contenido no cambió.
  const roomsKey = rooms.map((r) => `${r.id}:${r.bedsCount}`).join('|');

  useEffect(() => {
    if (!dateRange.checkIn || !dateRange.checkOut || rooms.length === 0) {
      setPricing(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Debounced: el huésped suele hacer varios clics de +1/-1 seguidos en el
    // selector de camas -- sin esto se dispara una consulta por cada clic.
    const timeoutId = setTimeout(() => {
      if (!dateRange.checkIn || !dateRange.checkOut) {
        return;
      }
      availabilityAPI
        .quote({
          checkIn: toDateOnly(dateRange.checkIn),
          checkOut: toDateOnly(dateRange.checkOut),
          rooms: rooms.map((r) => ({ roomId: r.id, bedsCount: r.bedsCount })),
        })
        .then((response) => {
          if (cancelled) {
            return;
          }
          if (isQuoteResponse(response.data)) {
            setPricing(response.data);
          } else {
            setPricing(null);
            setError(t('invalidQuote'));
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(handleAPIError(err, locale));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // `rooms`, `locale` y `t` se omiten a propósito: `rooms` ya está
    // representado por `roomsKey` (ver comentario arriba) y a `locale`/`t`
    // no hace falta reaccionar (solo se leen para traducir el mensaje de
    // error, no para decidir si hay que volver a pedir la cotización).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.checkIn, dateRange.checkOut, roomsKey]);

  if (isLoading && !pricing) {
    return (
      <Card className={`pricing-calculator p-6 flex justify-center ${className}`}>
        <LoadingSpinner size="md" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`pricing-calculator p-6 ${className}`}>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!pricing) {
    return null;
  }

  return (
    <Card className={`pricing-calculator p-6 ${className}`}>
      <h3 className="text-xl font-bold text-foreground mb-4">{t('title')}</h3>

      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t('nights')}:</p>
              <p className="font-semibold text-foreground">{pricing.nights}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('beds')}:</p>
              <p className="font-semibold text-foreground">{totalBeds}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('basePrice')}:</p>
              <p className="font-semibold text-foreground">R$ {pricing.breakdown.bedBasePrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('subtotal')}:</p>
              <p className="font-semibold text-foreground">R$ {pricing.basePrice.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {pricing.seasonMultiplier !== 1.0 && dateRange.checkIn && dateRange.checkOut && (
          <SeasonMultiplierDisplay
            multiplier={pricing.seasonMultiplier}
            adjustment={pricing.breakdown.seasonAdjustment}
            checkIn={dateRange.checkIn}
            checkOut={dateRange.checkOut}
            locale={locale}
          />
        )}

        {pricing.groupDiscountPercent > 0 && (
          <GroupDiscountDisplay
            totalBeds={totalBeds}
            discountPercent={pricing.groupDiscountPercent}
            discountAmount={pricing.discountAmount}
            locale={locale}
          />
        )}

        {pricing.discountAmount > 0 && (
          <SavingsIndicator
            savings={pricing.discountAmount}
            originalPrice={pricing.priceAfterSeason}
            locale={locale}
          />
        )}

        <PriceBreakdown
          subtotal={pricing.basePrice}
          seasonAdjustment={pricing.breakdown.seasonAdjustment}
          discountAmount={pricing.discountAmount}
          total={pricing.totalPrice}
          depositAmount={pricing.depositAmount}
          remainingAmount={pricing.remainingAmount}
          locale={locale}
        />

        <div className="pt-4 border-t-2 border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-bold text-foreground">{t('totalPrice')}:</span>
            <span className="text-2xl font-bold text-primary">
              R$ {pricing.totalPrice.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {t('pricePerBed')}: R$ {pricing.pricePerBed.toFixed(2)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">{t('depositNow')} (30%):</p>
            <p className="text-lg font-bold text-primary">R$ {pricing.depositAmount.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">{t('payLater')} (70%):</p>
            <p className="text-lg font-bold text-foreground">R$ {pricing.remainingAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-200 text-center">
          ✉️ {t('paymentInfo')}
        </div>
      </div>
    </Card>
  );
};
