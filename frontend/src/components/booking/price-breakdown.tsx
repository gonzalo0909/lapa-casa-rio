// lapa-casa-hostel/frontend/src/components/booking/price-breakdown.tsx

"use client";

import React from 'react';

/**
 * PriceBreakdown Component
 * 
 * Detailed line-by-line price breakdown
 * Shows all pricing components transparently
 * 
 * @component
 */
interface PriceBreakdownProps {
  subtotal: number;
  seasonAdjustment: number;
  discountAmount: number;
  total: number;
  depositAmount: number;
  remainingAmount: number;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  showDeposit?: boolean;
  className?: string;
}

export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  subtotal,
  seasonAdjustment,
  discountAmount,
  total,
  depositAmount,
  remainingAmount,
  locale = 'pt',
  showDeposit = true,
  className = ''
}) => {
  const hasSeasonAdjustment = seasonAdjustment !== 0;
  const hasDiscount = discountAmount > 0;
  const subtotalWithSeason = subtotal + seasonAdjustment;

  return (
    <div className={`price-breakdown space-y-3 ${className}`}>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">{T('subtotal', locale)}:</span>
          <span className="font-medium text-gray-900">R$ {subtotal.toFixed(2)}</span>
        </div>

        {hasSeasonAdjustment && (
          <div className="flex items-center justify-between">
            <span className={`text-gray-600 ${seasonAdjustment > 0 ? '' : 'text-green-600'}`}>
              {seasonAdjustment > 0 ? T('seasonIncrease', locale) : T('seasonDiscount', locale)}:
            </span>
            <span className={`font-medium ${seasonAdjustment > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {seasonAdjustment > 0 ? '+' : ''}R$ {seasonAdjustment.toFixed(2)}
            </span>
          </div>
        )}

        {hasSeasonAdjustment && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <span className="text-gray-700 font-medium">{T('subtotalAfterSeason', locale)}:</span>
            <span className="font-semibold text-gray-900">R$ {subtotalWithSeason.toFixed(2)}</span>
          </div>
        )}

        {hasDiscount && (
          <div className="flex items-center justify-between">
            <span className="text-green-600 font-medium">
              {T('groupDiscount', locale)}:
            </span>
            <span className="font-semibold text-green-600">
              -R$ {discountAmount.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t-2 border-gray-300">
          <span className="text-lg font-bold text-gray-900">{T('total', locale)}:</span>
          <span className="text-xl font-bold text-blue-600">R$ {total.toFixed(2)}</span>
        </div>
      </div>

      {showDeposit && (
        <div className="pt-3 border-t border-gray-200 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-700">{T('deposit', locale)} (30%):</span>
              <span className="text-xs text-gray-500">{T('payNow', locale)}</span>
            </div>
            <span className="font-semibold text-blue-600">R$ {depositAmount.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-700">{T('remaining', locale)} (70%):</span>
              <span className="text-xs text-gray-500">{T('payLater', locale)}</span>
            </div>
            <span className="font-semibold text-gray-900">R$ {remainingAmount.toFixed(2)}</span>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              ℹ️ {T('autoChargeInfo', locale)}
            </p>
          </div>
        </div>
      )}

      {(hasDiscount || hasSeasonAdjustment) && (
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>💡</span>
            <span>{T('transparentPricing', locale)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      subtotal: 'Subtotal',
      seasonIncrease: 'Ajuste de temporada',
      seasonDiscount: 'Desconto de temporada',
      subtotalAfterSeason: 'Subtotal após temporada',
      groupDiscount: 'Desconto para grupos',
      total: 'Total',
      deposit: 'Depósito',
      remaining: 'Saldo restante',
      payNow: 'agora',
      payLater: 'depois',
      autoChargeInfo: 'Saldo cobrado automaticamente 7 dias antes do check-in',
      transparentPricing: 'Preços transparentes, sem taxas ocultas'
    },
    es: {
      subtotal: 'Subtotal',
      seasonIncrease: 'Ajuste de temporada',
      seasonDiscount: 'Descuento de temporada',
      subtotalAfterSeason: 'Subtotal después de temporada',
      groupDiscount: 'Descuento para grupos',
      total: 'Total',
      deposit: 'Depósito',
      remaining: 'Saldo restante',
      payNow: 'ahora',
      payLater: 'después',
      autoChargeInfo: 'Saldo cobrado automáticamente 7 días antes del check-in',
      transparentPricing: 'Precios transparentes, sin tarifas ocultas'
    },
    en: {
      subtotal: 'Subtotal',
      seasonIncrease: 'Season adjustment',
      seasonDiscount: 'Season discount',
      subtotalAfterSeason: 'Subtotal after season',
      groupDiscount: 'Group discount',
      total: 'Total',
      deposit: 'Deposit',
      remaining: 'Remaining balance',
      payNow: 'now',
      payLater: 'later',
      autoChargeInfo: 'Balance charged automatically 7 days before check-in',
      transparentPricing: 'Transparent pricing, no hidden fees'
    },
    fr: {
      subtotal: 'Sous-total',
      seasonIncrease: 'Ajustement saisonnier',
      seasonDiscount: 'Remise saisonnière',
      subtotalAfterSeason: 'Sous-total après saison',
      groupDiscount: 'Remise de groupe',
      total: 'Total',
      deposit: 'Acompte',
      remaining: 'Solde restant',
      payNow: 'maintenant',
      payLater: 'plus tard',
      autoChargeInfo: 'Solde débité automatiquement 7 jours avant l’arrivée',
      transparentPricing: 'Tarifs transparents, sans frais cachés'
    },
    de: {
      subtotal: 'Zwischensumme',
      seasonIncrease: 'Saisonaler Aufschlag',
      seasonDiscount: 'Saisonrabatt',
      subtotalAfterSeason: 'Zwischensumme nach Saison',
      groupDiscount: 'Gruppenrabatt',
      total: 'Gesamt',
      deposit: 'Anzahlung',
      remaining: 'Restbetrag',
      payNow: 'jetzt',
      payLater: 'später',
      autoChargeInfo: 'Restbetrag wird automatisch 7 Tage vor Check-in abgebucht',
      transparentPricing: 'Transparente Preise, keine versteckten Gebühren'
    }
  };
  return t[locale]?.[key] || key;
}
