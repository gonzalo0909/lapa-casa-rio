// lapa-casa-hostel/frontend/src/components/booking/price-summary.tsx

"use client";

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { calculateTotalPrice, getSeasonMultiplier, getGroupDiscount } from '@/lib/pricing';
import type { DateRange, Room } from '@/types/global';

interface PriceSummaryProps {
  dateRange: DateRange;
  rooms: Room[];
  totalPrice: number;
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const PriceSummary: React.FC<PriceSummaryProps> = ({
  dateRange,
  rooms,
  totalPrice,
  locale = 'pt',
  className = ''
}) => {
  const breakdown = useMemo(() => {
    const nights = Math.ceil(
      (dateRange.checkOut!.getTime() - dateRange.checkIn!.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalBeds = rooms.reduce((sum, r) => sum + r.bedsCount, 0);
    const basePrice = 60.0;
    const subtotal = totalBeds * nights * basePrice;
    const seasonMultiplier = getSeasonMultiplier(dateRange.checkIn!, dateRange.checkOut!);
    const groupDiscountPercent = getGroupDiscount(totalBeds);
    const seasonAdjustment = subtotal * (seasonMultiplier - 1);
    const subtotalWithSeason = subtotal + seasonAdjustment;
    const discountAmount = subtotalWithSeason * (groupDiscountPercent / 100);
    const depositAmount = totalPrice * 0.3;
    const remainingAmount = totalPrice - depositAmount;

    return {
      subtotal,
      seasonAdjustment,
      discountAmount,
      depositAmount,
      remainingAmount
    };
  }, [dateRange, rooms, totalPrice]);

  return (
    <Card className={`price-summary p-6 ${className}`}>
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span>💰</span> {T('title', locale)}
      </h3>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-gray-600">{T('subtotal', locale)}:</span>
          <span className="font-medium">R$ {breakdown.subtotal.toFixed(2)}</span>
        </div>

        {breakdown.seasonAdjustment !== 0 && (
          <div className="flex justify-between">
            <span className={breakdown.seasonAdjustment > 0 ? 'text-red-600' : 'text-green-600'}>
              {breakdown.seasonAdjustment > 0 ? T('seasonIncrease', locale) : T('seasonDiscount', locale)}:
            </span>
            <span className={breakdown.seasonAdjustment > 0 ? 'text-red-600' : 'text-green-600'}>
              {breakdown.seasonAdjustment > 0 ? '+' : ''}R$ {breakdown.seasonAdjustment.toFixed(2)}
            </span>
          </div>
        )}

        {breakdown.discountAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-green-600">{T('groupDiscount', locale)}:</span>
            <span className="text-green-600">-R$ {breakdown.discountAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="pt-4 mb-4 border-t-2 border-gray-300">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-900">{T('total', locale)}:</span>
          <span className="text-2xl font-bold text-blue-600">R$ {totalPrice.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t">
        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-blue-900">{T('depositNow', locale)}</p>
            <p className="text-xs text-blue-700">30% {T('payNow', locale)}</p>
          </div>
          <p className="text-xl font-bold text-blue-600">R$ {breakdown.depositAmount.toFixed(2)}</p>
        </div>

        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-semibold text-gray-900">{T('remaining', locale)}</p>
            <p className="text-xs text-gray-600">70% {T('payLater', locale)}</p>
          </div>
          <p className="text-xl font-bold text-gray-900">R$ {breakdown.remainingAmount.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          💳 {T('paymentInfo', locale)}
        </p>
      </div>
    </Card>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Resumo de Pagamento',
      subtotal: 'Subtotal',
      seasonIncrease: 'Ajuste de temporada',
      seasonDiscount: 'Desconto de temporada',
      groupDiscount: 'Desconto para grupos',
      total: 'Total',
      depositNow: 'Depósito Agora',
      payNow: 'agora',
      remaining: 'Saldo Restante',
      payLater: 'em 7 dias',
      paymentInfo: 'Saldo cobrado automaticamente 7 dias antes do check-in'
    },
    es: {
      title: 'Resumen de Pago',
      subtotal: 'Subtotal',
      seasonIncrease: 'Ajuste de temporada',
      seasonDiscount: 'Descuento de temporada',
      groupDiscount: 'Descuento para grupos',
      total: 'Total',
      depositNow: 'Depósito Ahora',
      payNow: 'ahora',
      remaining: 'Saldo Restante',
      payLater: 'en 7 días',
      paymentInfo: 'Saldo cobrado automáticamente 7 días antes del check-in'
    },
    en: {
      title: 'Payment Summary',
      subtotal: 'Subtotal',
      seasonIncrease: 'Season adjustment',
      seasonDiscount: 'Season discount',
      groupDiscount: 'Group discount',
      total: 'Total',
      depositNow: 'Deposit Now',
      payNow: 'now',
      remaining: 'Remaining Balance',
      payLater: 'in 7 days',
      paymentInfo: 'Balance charged automatically 7 days before check-in'
    }
  };
  return t[locale]?.[key] || key;
}
