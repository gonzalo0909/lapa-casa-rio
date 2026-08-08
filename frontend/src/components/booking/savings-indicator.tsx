// lapa-casa-hostel/frontend/src/components/booking/savings-indicator.tsx

"use client";

import React from 'react';

/**
 * SavingsIndicator Component
 * 
 * Highlights total savings from discounts
 * Emphasizes value proposition for group bookings
 * 
 * @component
 */
interface SavingsIndicatorProps {
  savings: number;
  originalPrice: number;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

export const SavingsIndicator: React.FC<SavingsIndicatorProps> = ({
  savings,
  originalPrice,
  locale = 'pt',
  className = ''
}) => {
  const savingsPercent = Math.round((savings / originalPrice) * 100);

  if (savings <= 0) {return null;}

  return (
    <div className={`savings-indicator ${className}`}>
      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">🎉</span>
          <div className="flex-1">
            <h4 className="font-bold text-green-900 text-lg">
              {T('title', locale)}
            </h4>
            <p className="text-sm text-green-700">
              {T('subtitle', locale)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
          <div>
            <p className="text-sm text-gray-600 mb-1">{T('totalSavings', locale)}:</p>
            <p className="text-3xl font-bold text-green-600">
              R$ {savings.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block px-4 py-2 bg-green-100 rounded-full">
              <p className="text-2xl font-bold text-green-800">
                {savingsPercent}%
              </p>
              <p className="text-xs text-green-700">{T('off', locale)}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-600">{T('originalPrice', locale)}:</span>
          <span className="font-medium text-gray-400 line-through">
            R$ {originalPrice.toFixed(2)}
          </span>
        </div>

        <div className="mt-3 p-3 bg-green-100 rounded-lg">
          <p className="text-sm text-green-800 font-medium text-center">
            ✓ {T('message', locale)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 bg-green-50 rounded">
          <span className="block text-green-800 font-semibold">💰</span>
          <span className="text-gray-600">{T('benefit1', locale)}</span>
        </div>
        <div className="p-2 bg-green-50 rounded">
          <span className="block text-green-800 font-semibold">👥</span>
          <span className="text-gray-600">{T('benefit2', locale)}</span>
        </div>
        <div className="p-2 bg-green-50 rounded">
          <span className="block text-green-800 font-semibold">🎯</span>
          <span className="text-gray-600">{T('benefit3', locale)}</span>
        </div>
      </div>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Você Está Economizando!',
      subtitle: 'Desconto para grupos aplicado',
      totalSavings: 'Economia total',
      off: 'OFF',
      originalPrice: 'Preço sem desconto',
      message: 'Reserva inteligente = mais economia',
      benefit1: 'Melhor preço',
      benefit2: 'Grupo ideal',
      benefit3: 'Valor garantido'
    },
    es: {
      title: '¡Estás Ahorrando!',
      subtitle: 'Descuento para grupos aplicado',
      totalSavings: 'Ahorro total',
      off: 'OFF',
      originalPrice: 'Precio sin descuento',
      message: 'Reserva inteligente = más ahorro',
      benefit1: 'Mejor precio',
      benefit2: 'Grupo ideal',
      benefit3: 'Valor garantizado'
    },
    en: {
      title: 'You Are Saving!',
      subtitle: 'Group discount applied',
      totalSavings: 'Total savings',
      off: 'OFF',
      originalPrice: 'Price without discount',
      message: 'Smart booking = more savings',
      benefit1: 'Best price',
      benefit2: 'Ideal group',
      benefit3: 'Value guaranteed'
    },
    fr: {
      title: 'Vous Économisez !',
      subtitle: 'Remise de groupe appliquée',
      totalSavings: 'Économies totales',
      off: 'DE RÉDUCTION',
      originalPrice: 'Prix sans remise',
      message: 'Réservation intelligente = plus d’économies',
      benefit1: 'Meilleur prix',
      benefit2: 'Groupe idéal',
      benefit3: 'Valeur garantie'
    },
    de: {
      title: 'Sie sparen!',
      subtitle: 'Gruppenrabatt angewendet',
      totalSavings: 'Gesamtersparnis',
      off: 'RABATT',
      originalPrice: 'Preis ohne Rabatt',
      message: 'Clevere Buchung = mehr Ersparnis',
      benefit1: 'Bester Preis',
      benefit2: 'Ideale Gruppe',
      benefit3: 'Garantierter Wert'
    }
  };
  return t[locale]?.[key] || key;
}
