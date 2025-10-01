// lapa-casa-hostel/frontend/src/components/booking/season-multiplier-display.tsx

"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * SeasonMultiplierDisplay Component
 * 
 * Visual display of seasonal pricing adjustments
 * Shows multiplier effect and adjustment amount
 * 
 * @component
 */
interface SeasonMultiplierDisplayProps {
  multiplier: number;
  adjustment: number;
  checkIn: Date;
  checkOut: Date;
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const SeasonMultiplierDisplay: React.FC<SeasonMultiplierDisplayProps> = ({
  multiplier,
  adjustment,
  checkIn,
  checkOut,
  locale = 'pt',
  className = ''
}) => {
  const getSeasonInfo = () => {
    if (multiplier === 2.0) {
      return {
        name: T('carnival', locale),
        icon: '🎭',
        color: 'purple',
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-800',
        borderColor: 'border-purple-300'
      };
    }
    if (multiplier === 1.5) {
      return {
        name: T('highSeason', locale),
        icon: '☀️',
        color: 'red',
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-300'
      };
    }
    if (multiplier === 0.8) {
      return {
        name: T('lowSeason', locale),
        icon: '❄️',
        color: 'green',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-300'
      };
    }
    return {
      name: T('mediumSeason', locale),
      icon: '🌤️',
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-300'
    };
  };

  const seasonInfo = getSeasonInfo();
  const isIncrease = adjustment > 0;
  const percentChange = Math.abs((multiplier - 1) * 100);

  return (
    <div className={`season-multiplier-display ${className}`}>
      <div className={`p-4 rounded-lg border-2 ${seasonInfo.bgColor} ${seasonInfo.borderColor}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{seasonInfo.icon}</span>
            <div>
              <h4 className={`font-bold ${seasonInfo.textColor}`}>
                {seasonInfo.name}
              </h4>
              <p className="text-xs text-gray-600">
                {formatDate(checkIn, locale)} → {formatDate(checkOut, locale)}
              </p>
            </div>
          </div>
          <Badge className={`${seasonInfo.bgColor} ${seasonInfo.textColor} border-0 font-bold`}>
            {isIncrease ? '+' : '-'}{percentChange.toFixed(0)}%
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-300">
          <span className="text-sm font-medium text-gray-700">
            {isIncrease ? T('increase', locale) : T('discount', locale)}:
          </span>
          <span className={`text-lg font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
            {isIncrease ? '+' : ''}R$ {adjustment.toFixed(2)}
          </span>
        </div>
      </div>

      {multiplier === 2.0 && (
        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>🎊 {T('carnivalSpecial', locale)}:</strong> {T('carnivalInfo', locale)}
          </p>
        </div>
      )}

      {multiplier === 1.5 && (
        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800">
            <strong>☀️ {T('summerPeak', locale)}:</strong> {T('summerInfo', locale)}
          </p>
        </div>
      )}

      {multiplier === 0.8 && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>💰 {T('winterDeal', locale)}:</strong> {T('winterInfo', locale)}
          </p>
        </div>
      )}
    </div>
  );
};

function formatDate(date: Date, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return date.toLocaleDateString(
    locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
    opts
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      carnival: 'Carnaval',
      highSeason: 'Alta Temporada',
      mediumSeason: 'Temporada Média',
      lowSeason: 'Baixa Temporada',
      increase: 'Acréscimo',
      discount: 'Desconto',
      carnivalSpecial: 'Especial Carnaval',
      carnivalInfo: 'Período de maior demanda. Mínimo 5 noites obrigatório.',
      summerPeak: 'Verão no Rio',
      summerInfo: 'Alta temporada: Dezembro a Março. Praias lotadas!',
      winterDeal: 'Oferta de Inverno',
      winterInfo: 'Baixa temporada: Junho a Setembro. Melhores preços!'
    },
    es: {
      carnival: 'Carnaval',
      highSeason: 'Temporada Alta',
      mediumSeason: 'Temporada Media',
      lowSeason: 'Temporada Baja',
      increase: 'Incremento',
      discount: 'Descuento',
      carnivalSpecial: 'Especial Carnaval',
      carnivalInfo: 'Período de mayor demanda. Mínimo 5 noches obligatorio.',
      summerPeak: 'Verano en Río',
      summerInfo: 'Temporada alta: Diciembre a Marzo. ¡Playas llenas!',
      winterDeal: 'Oferta de Invierno',
      winterInfo: 'Temporada baja: Junio a Septiembre. ¡Mejores precios!'
    },
    en: {
      carnival: 'Carnival',
      highSeason: 'High Season',
      mediumSeason: 'Medium Season',
      lowSeason: 'Low Season',
      increase: 'Increase',
      discount: 'Discount',
      carnivalSpecial: 'Carnival Special',
      carnivalInfo: 'Peak demand period. Minimum 5 nights required.',
      summerPeak: 'Rio Summer',
      summerInfo: 'High season: December to March. Crowded beaches!',
      winterDeal: 'Winter Deal',
      winterInfo: 'Low season: June to September. Best prices!'
    }
  };
  return t[locale]?.[key] || key;
}
