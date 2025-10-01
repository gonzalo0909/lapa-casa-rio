// lapa-casa-hostel/frontend/src/components/booking/season-indicator.tsx

"use client";

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * SeasonIndicator Component
 * 
 * Displays season information and price multipliers for date range
 * Shows high/medium/low season and carnival periods
 * 
 * @component
 */
interface SeasonIndicatorProps {
  checkIn: Date;
  checkOut: Date;
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

type Season = 'high' | 'medium' | 'low' | 'carnival';

interface SeasonInfo {
  season: Season;
  multiplier: number;
  label: string;
  color: string;
  bgColor: string;
}

export const SeasonIndicator: React.FC<SeasonIndicatorProps> = ({
  checkIn,
  checkOut,
  locale = 'pt',
  className = ''
}) => {
  const seasonInfo = useMemo(() => {
    return getSeasonForDateRange(checkIn, checkOut, locale);
  }, [checkIn, checkOut, locale]);

  const isCarnival = useMemo(() => {
    return checkIsCarnivalPeriod(checkIn, checkOut);
  }, [checkIn, checkOut]);

  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className={`season-indicator ${className}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge
            className={`${seasonInfo.bgColor} ${seasonInfo.color} border-0 font-semibold`}
          >
            {seasonInfo.label}
          </Badge>
          {seasonInfo.multiplier !== 1.0 && (
            <span className="text-sm font-medium text-gray-700">
              {seasonInfo.multiplier > 1
                ? `+${((seasonInfo.multiplier - 1) * 100).toFixed(0)}%`
                : `-${((1 - seasonInfo.multiplier) * 100).toFixed(0)}%`}
            </span>
          )}
        </div>

        {isCarnival && (
          <Badge className="bg-purple-100 text-purple-800 border-0 font-semibold">
            🎭 {T('carnival', locale)}
          </Badge>
        )}
      </div>

      <div className="mt-3 text-sm text-gray-600">
        <p>{getSeasonDescription(seasonInfo.season, locale)}</p>
        {isCarnival && nights < 5 && (
          <p className="text-orange-600 font-medium mt-1">
            ⚠️ {T('carnivalMinimum', locale)}
          </p>
        )}
      </div>
    </div>
  );
};

function getSeasonForDateRange(checkIn: Date, checkOut: Date, locale: string): SeasonInfo {
  const isCarnival = checkIsCarnivalPeriod(checkIn, checkOut);
  
  if (isCarnival) {
    return {
      season: 'carnival',
      multiplier: 2.0,
      label: T('seasonCarnival', locale),
      color: 'text-purple-800',
      bgColor: 'bg-purple-100'
    };
  }

  const checkInMonth = checkIn.getMonth() + 1;
  const checkOutMonth = checkOut.getMonth() + 1;

  const isHighSeason = (month: number) => month === 12 || month === 1 || month === 2 || month === 3;
  const isMediumSeason = (month: number) => month === 4 || month === 5 || month === 10 || month === 11;
  const isLowSeason = (month: number) => month === 6 || month === 7 || month === 8 || month === 9;

  if (isHighSeason(checkInMonth) && isHighSeason(checkOutMonth)) {
    return {
      season: 'high',
      multiplier: 1.5,
      label: T('seasonHigh', locale),
      color: 'text-red-800',
      bgColor: 'bg-red-100'
    };
  }

  if (isLowSeason(checkInMonth) && isLowSeason(checkOutMonth)) {
    return {
      season: 'low',
      multiplier: 0.8,
      label: T('seasonLow', locale),
      color: 'text-green-800',
      bgColor: 'bg-green-100'
    };
  }

  return {
    season: 'medium',
    multiplier: 1.0,
    label: T('seasonMedium', locale),
    color: 'text-blue-800',
    bgColor: 'bg-blue-100'
  };
}

function checkIsCarnivalPeriod(checkIn: Date, checkOut: Date): boolean {
  const year = checkIn.getFullYear();
  const carnivalDate = getCarnivalDate(year);
  
  const carnivalStart = new Date(carnivalDate);
  carnivalStart.setDate(carnivalStart.getDate() - 2);
  
  const carnivalEnd = new Date(carnivalDate);
  carnivalEnd.setDate(carnivalEnd.getDate() + 1);

  return (
    (checkIn >= carnivalStart && checkIn <= carnivalEnd) ||
    (checkOut >= carnivalStart && checkOut <= carnivalEnd) ||
    (checkIn < carnivalStart && checkOut > carnivalEnd)
  );
}

function getCarnivalDate(year: number): Date {
  const easterSunday = getEasterDate(year);
  const carnival = new Date(easterSunday);
  carnival.setDate(carnival.getDate() - 47);
  return carnival;
}

function getEasterDate(year: number): Date {
  const f = Math.floor;
  const G = year % 19;
  const C = f(year / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const month = 3 + f((L + 40) / 44);
  const day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

function getSeasonDescription(season: Season, locale: string): string {
  const descriptions: Record<string, Record<Season, string>> = {
    pt: {
      high: 'Alta temporada - Verão no Rio de Janeiro',
      medium: 'Temporada média - Clima ameno',
      low: 'Baixa temporada - Inverno, melhores preços',
      carnival: 'Carnaval - Maior evento do ano'
    },
    es: {
      high: 'Temporada alta - Verano en Río de Janeiro',
      medium: 'Temporada media - Clima templado',
      low: 'Temporada baja - Invierno, mejores precios',
      carnival: 'Carnaval - Mayor evento del año'
    },
    en: {
      high: 'High season - Summer in Rio de Janeiro',
      medium: 'Medium season - Mild weather',
      low: 'Low season - Winter, best prices',
      carnival: 'Carnival - Biggest event of the year'
    }
  };
  return descriptions[locale]?.[season] || '';
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      seasonHigh: 'Alta Temporada',
      seasonMedium: 'Temporada Média',
      seasonLow: 'Baixa Temporada',
      seasonCarnival: 'Carnaval',
      carnival: 'Carnaval',
      carnivalMinimum: 'Carnaval requer mínimo 5 noites'
    },
    es: {
      seasonHigh: 'Temporada Alta',
      seasonMedium: 'Temporada Media',
      seasonLow: 'Temporada Baja',
      seasonCarnival: 'Carnaval',
      carnival: 'Carnaval',
      carnivalMinimum: 'Carnaval requiere mínimo 5 noches'
    },
    en: {
      seasonHigh: 'High Season',
      seasonMedium: 'Medium Season',
      seasonLow: 'Low Season',
      seasonCarnival: 'Carnival',
      carnival: 'Carnival',
      carnivalMinimum: 'Carnival requires minimum 5 nights'
    }
  };
  return t[locale]?.[key] || key;
}
