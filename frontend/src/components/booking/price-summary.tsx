// lapa-casa-hostel/frontend/src/components/booking/price-summary.tsx

"use client";

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { availabilityAPI } from '@/lib/api';
import type { DateRange, Room } from '@/types/global';

interface PriceSummaryProps {
  dateRange: DateRange;
  rooms: Room[];
  totalPrice: number;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

interface Breakdown {
  subtotal: number;
  seasonAdjustment: number;
  discountAmount: number;
  depositAmount: number;
  remainingAmount: number;
}

export const PriceSummary: React.FC<PriceSummaryProps> = ({
  dateRange,
  rooms,
  totalPrice,
  locale = 'pt',
  className = ''
}) => {
  const [breakdown, setBreakdown] = useState<Breakdown>({
    subtotal: 0, seasonAdjustment: 0, discountAmount: 0, depositAmount: 0, remainingAmount: 0
  });

  useEffect(() => {
    if (!dateRange.checkIn || !dateRange.checkOut || rooms.length === 0) {
      return;
    }

    let cancelled = false;
    availabilityAPI
      .quote({
        checkIn: dateRange.checkIn.toISOString().slice(0, 10),
        checkOut: dateRange.checkOut.toISOString().slice(0, 10),
        rooms: rooms.map((r) => ({ roomId: r.id, bedsCount: r.bedsCount })),
      })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const p = response.data as {
          basePrice: number;
          discountAmount: number;
          depositAmount: number;
          remainingAmount: number;
          breakdown: { seasonAdjustment: number };
        };
        setBreakdown({
          subtotal: p.basePrice,
          seasonAdjustment: p.breakdown.seasonAdjustment,
          discountAmount: p.discountAmount,
          depositAmount: p.depositAmount,
          remainingAmount: p.remainingAmount,
        });
      })
      .catch(() => {
        // El error se muestra en PricingCalculator, un paso antes; acá no repetimos el mensaje.
      });

    return () => {
      cancelled = true;
    };
  }, [dateRange.checkIn, dateRange.checkOut, rooms]);

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
      paymentInfo: 'Lembramos você por email para pagar o saldo 7 dias antes do check-in'
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
      paymentInfo: 'Te recordamos por email para pagar el saldo 7 días antes del check-in'
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
      paymentInfo: 'We\'ll remind you by email to pay the balance 7 days before check-in'
    },
    fr: {
      title: 'Résumé du Paiement',
      subtotal: 'Sous-total',
      seasonIncrease: 'Ajustement saisonnier',
      seasonDiscount: 'Remise saisonnière',
      groupDiscount: 'Remise de groupe',
      total: 'Total',
      depositNow: 'Acompte Maintenant',
      payNow: 'maintenant',
      remaining: 'Solde Restant',
      payLater: 'dans 7 jours',
      paymentInfo: 'Nous vous rappellerons par e-mail de payer le solde 7 jours avant l’arrivée'
    },
    de: {
      title: 'Zahlungsübersicht',
      subtotal: 'Zwischensumme',
      seasonIncrease: 'Saisonaler Aufschlag',
      seasonDiscount: 'Saisonrabatt',
      groupDiscount: 'Gruppenrabatt',
      total: 'Gesamt',
      depositNow: 'Anzahlung Jetzt',
      payNow: 'jetzt',
      remaining: 'Restbetrag',
      payLater: 'in 7 Tagen',
      paymentInfo: 'Wir erinnern Sie per E-Mail, den Restbetrag 7 Tage vor Check-in zu zahlen'
    }
  };
  return t[locale]?.[key] || key;
}
