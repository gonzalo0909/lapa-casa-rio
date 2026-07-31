// lapa-casa-hostel/frontend/src/components/booking/pricing-calculator.tsx

"use client";

import React, { useMemo } from 'react';
import { PriceBreakdown } from './price-breakdown';
import { GroupDiscountDisplay } from './group-discount-display';
import { SeasonMultiplierDisplay } from './season-multiplier-display';
import { SavingsIndicator } from './savings-indicator';
import { Card } from '@/components/ui/card';
import { calculateTotalPrice, getSeasonMultiplier, getGroupDiscount } from '@/lib/pricing';
import type { DateRange, Room } from '@/types/global';

/**
 * PricingCalculator Component
 * 
 * Comprehensive pricing display with breakdowns
 * Shows base price, discounts, multipliers, and total
 * 
 * @component
 */
interface PricingCalculatorProps {
  dateRange: DateRange;
  rooms: Room[];
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  dateRange,
  rooms,
  locale = 'pt',
  className = ''
}) => {
  const pricing = useMemo(() => {
    if (!dateRange.checkIn || !dateRange.checkOut || rooms.length === 0) {
      return null;
    }

    const nights = Math.ceil(
      (dateRange.checkOut.getTime() - dateRange.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    const totalBeds = rooms.reduce((sum, room) => sum + room.bedsCount, 0);
    const basePrice = 60.0;
    const subtotal = totalBeds * nights * basePrice;

    const seasonMultiplier = getSeasonMultiplier(dateRange.checkIn, dateRange.checkOut);
    const groupDiscountPercent = getGroupDiscount(totalBeds);

    const seasonAdjustment = subtotal * (seasonMultiplier - 1);
    const subtotalWithSeason = subtotal + seasonAdjustment;

    const discountAmount = subtotalWithSeason * (groupDiscountPercent / 100);
    const total = subtotalWithSeason - discountAmount;

    const depositAmount = total * 0.3;
    const remainingAmount = total - depositAmount;

    return {
      nights,
      totalBeds,
      basePrice,
      subtotal,
      seasonMultiplier,
      seasonAdjustment,
      subtotalWithSeason,
      groupDiscountPercent,
      discountAmount,
      total,
      depositAmount,
      remainingAmount,
      totalSavings: discountAmount
    };
  }, [dateRange, rooms]);

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
              <p className="font-semibold text-gray-900">{pricing.totalBeds}</p>
            </div>
            <div>
              <p className="text-gray-600">{T('basePrice', locale)}:</p>
              <p className="font-semibold text-gray-900">R$ {pricing.basePrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">{T('subtotal', locale)}:</p>
              <p className="font-semibold text-gray-900">R$ {pricing.subtotal.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {pricing.seasonMultiplier !== 1.0 && (
          <SeasonMultiplierDisplay
            multiplier={pricing.seasonMultiplier}
            adjustment={pricing.seasonAdjustment}
            checkIn={dateRange.checkIn!}
            checkOut={dateRange.checkOut!}
            locale={locale}
          />
        )}

        {pricing.groupDiscountPercent > 0 && (
          <GroupDiscountDisplay
            totalBeds={pricing.totalBeds}
            discountPercent={pricing.groupDiscountPercent}
            discountAmount={pricing.discountAmount}
            locale={locale}
          />
        )}

        {pricing.totalSavings > 0 && (
          <SavingsIndicator
            savings={pricing.totalSavings}
            originalPrice={pricing.subtotalWithSeason}
            locale={locale}
          />
        )}

        <PriceBreakdown
          subtotal={pricing.subtotal}
          seasonAdjustment={pricing.seasonAdjustment}
          discountAmount={pricing.discountAmount}
          total={pricing.total}
          depositAmount={pricing.depositAmount}
          remainingAmount={pricing.remainingAmount}
          locale={locale}
        />

        <div className="pt-4 border-t-2 border-gray-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-bold text-gray-900">{T('totalPrice', locale)}:</span>
            <span className="text-2xl font-bold text-blue-600">
              R$ {pricing.total.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-600 text-right">
            {T('pricePerBed', locale)}: R$ {(pricing.total / pricing.totalBeds).toFixed(2)}
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
