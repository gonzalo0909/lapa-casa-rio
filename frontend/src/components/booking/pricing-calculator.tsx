// lapa-casa-hostel/frontend/src/components/booking/pricing-calculator.tsx

"use client";

import React, { useEffect, useState } from 'react';
import { PriceBreakdown } from './price-breakdown';
import { GroupDiscountDisplay } from './group-discount-display';
import { SeasonMultiplierDisplay } from './season-multiplier-display';
import { SavingsIndicator } from './savings-indicator';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { availabilityAPI, handleAPIError } from '@/lib/api';
import type { DateRange, GroupDiscountTier, Room } from '@/types/global';

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
  groupDiscountTiers: GroupDiscountTier[];
  locale?: 'pt' | 'es' | 'en';
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

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  dateRange,
  rooms,
  groupDiscountTiers,
  locale = 'pt',
  className = ''
}) => {
  const [pricing, setPricing] = useState<QuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalBeds = rooms.reduce((sum, room) => sum + room.bedsCount, 0);

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
          if (!cancelled) {
            setPricing(response.data as QuoteResponse);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(handleAPIError(err));
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
  }, [dateRange.checkIn, dateRange.checkOut, rooms]);

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
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (!pricing) {
    return null;
  }

  return (
    <Card className={`pricing-calculator p-6 ${className}`}>
      <h3 className="text-xl font-bold text-gray-900 mb-4">{T('title', locale)}</h3>

      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600">{T('nights', locale)}:</p>
              <p className="font-semibold text-gray-900">{pricing.nights}</p>
            </div>
            <div>
              <p className="text-gray-600">{T('beds', locale)}:</p>
              <p className="font-semibold text-gray-900">{totalBeds}</p>
            </div>
            <div>
              <p className="text-gray-600">{T('basePrice', locale)}:</p>
              <p className="font-semibold text-gray-900">R$ {pricing.breakdown.bedBasePrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">{T('subtotal', locale)}:</p>
              <p className="font-semibold text-gray-900">R$ {pricing.basePrice.toFixed(2)}</p>
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
            tiers={groupDiscountTiers}
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

        <div className="pt-4 border-t-2 border-gray-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-bold text-gray-900">{T('totalPrice', locale)}:</span>
            <span className="text-2xl font-bold text-blue-600">
              R$ {pricing.totalPrice.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-600 text-right">
            {T('pricePerBed', locale)}: R$ {pricing.pricePerBed.toFixed(2)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">{T('depositNow', locale)} (30%):</p>
            <p className="text-lg font-bold text-blue-600">R$ {pricing.depositAmount.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-gray-100 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">{T('payLater', locale)} (70%):</p>
            <p className="text-lg font-bold text-gray-900">R$ {pricing.remainingAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="text-xs text-gray-500 text-center">
          {T('paymentInfo', locale)}
        </div>
      </div>
    </Card>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Resumo de Preços',
      nights: 'Noites',
      beds: 'Camas',
      basePrice: 'Preço base',
      subtotal: 'Subtotal',
      totalPrice: 'Preço Total',
      pricePerBed: 'Por cama',
      depositNow: 'Depósito agora',
      payLater: 'Pagar depois',
      paymentInfo: 'Saldo restante cobrado automaticamente 7 dias antes do check-in'
    },
    es: {
      title: 'Resumen de Precios',
      nights: 'Noches',
      beds: 'Camas',
      basePrice: 'Precio base',
      subtotal: 'Subtotal',
      totalPrice: 'Precio Total',
      pricePerBed: 'Por cama',
      depositNow: 'Depósito ahora',
      payLater: 'Pagar después',
      paymentInfo: 'Saldo restante cobrado automáticamente 7 días antes del check-in'
    },
    en: {
      title: 'Price Summary',
      nights: 'Nights',
      beds: 'Beds',
      basePrice: 'Base price',
      subtotal: 'Subtotal',
      totalPrice: 'Total Price',
      pricePerBed: 'Per bed',
      depositNow: 'Deposit now',
      payLater: 'Pay later',
      paymentInfo: 'Remaining balance charged automatically 7 days before check-in'
    }
  };
  return t[locale]?.[key] || key;
}
