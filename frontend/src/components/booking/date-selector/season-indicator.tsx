// src/components/booking/date-selector/season-indicator.tsx

'use client';

import React from 'react';
import { format, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Alert, AlertDescription } from '../../ui/alert';
import { cn } from '@/lib/utils';

interface SeasonIndicatorProps {
  checkIn: Date;
  checkOut: Date;
  className?: string;
}

interface SeasonPeriod {
  name: string;
  type: 'high' | 'medium' | 'low' | 'carnival';
  start: { month: number; day: number };
  end: { month: number; day: number };
  multiplier: number;
  description: string;
  color: string;
  bgColor: string;
  minStay?: number;
}

export function SeasonIndicator({ checkIn, checkOut, className }: SeasonIndicatorProps) {
  // Definir temporadas para Rio de Janeiro
  const seasonPeriods: SeasonPeriod[] = [
    {
      name: 'Carnaval',
      type: 'carnival',
      start: { month: 2, day: 10 }, // Aproximado: mediados de febrero
      end: { month: 2, day: 17 },
      multiplier: 2.0,
      description: 'Temporada especial de Carnaval con precios premium',
      color: 'text-orange-700',
      bgColor: 'bg-orange-50 border-orange-200',
      minStay: 5
    },
    {
      name: 'Temporada Alta',
      type: 'high',
      start: { month: 12, day: 15 }, // Diciembre 15 - Marzo 31
      end: { month: 3, day: 31 },
      multiplier: 1.5,
      description: 'Verano brasileño - alta demanda turística',
      color: 'text-red-700',
      bgColor: 'bg-red-50 border-red-200'
    },
    {
      name: 'Temporada Media',
      type: 'medium',
      start: { month: 4, day: 1 }, // Abril - Mayo
      end: { month: 5, day: 31 },
      multiplier: 1.0,
      description: 'Clima agradable, precios estándar',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-200'
    },
    {
      name: 'Temporada Media',
      type: 'medium',
      start: { month: 10, day: 1 }, // Octubre - Noviembre
      end: { month: 11, day: 30 },
      multiplier: 1.0,
      description: 'Primavera, clima agradable',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-200'
    },
    {
      name: 'Temporada Baja',
      type: 'low',
      start: { month: 6, day: 1 }, // Junio - Septiembre
      end: { month: 9, day: 30 },
      multiplier: 0.8,
      description: 'Invierno suave - mejores precios',
      color: 'text-green-700',
      bgColor: 'bg-green-50 border-green-200'
    }
  ];

  const getSeasonForDate = (date: Date): SeasonPeriod | null => {
    const year = date.getFullYear();
    
    for (const season of seasonPeriods) {
      let seasonStart: Date;
      let seasonEnd: Date;
      
      // Manejar el cambio de año para temporada alta (dic-mar)
      if (season.start.month > season.end.month) {
        if (date.getMonth() + 1 >= season.start.month) {
          seasonStart = new Date(year, season.start.month - 1, season.start.day);
          seasonEnd = new Date(year + 1, season.end.month - 1, season.end.day);
        } else {
          seasonStart = new Date(year - 1, season.start.month - 1, season.start.day);
          seasonEnd = new Date(year, season.end.month - 1, season.end.day);
        }
      } else {
        seasonStart = new Date(year, season.start.month - 1, season.start.day);
        seasonEnd = new Date(year, season.end.month - 1, season.end.day);
      }
      
      if (isWithinInterval(date, { start: seasonStart, end: seasonEnd })) {
        return season;
      }
    }
    
    return null;
  };

  // Determinar la temporada dominante para la estadía
  const checkInSeason = getSeasonForDate(checkIn);
  const checkOutSeason = getSeasonForDate(checkOut);
  
  // Si cruza temporadas, mostrar la más restrictiva/cara
  let dominantSeason = checkInSeason;
  if (checkInSeason && checkOutSeason && checkInSeason !== checkOutSeason) {
    if (checkOutSeason.multiplier > checkInSeason.multiplier) {
      dominantSeason = checkOutSeason;
    }
  }

  if (!dominantSeason) {
    return null;
  }

  const getSeasonBadgeVariant = (type: string) => {
    switch (type) {
      case 'carnival': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getMultiplierText = (multiplier: number) => {
    if (multiplier > 1) {
      return `+${Math.round((multiplier - 1) * 100)}%`;
    } else if (multiplier < 1) {
      return `-${Math.round((1 - multiplier) * 100)}%`;
    }
    return 'Precio estándar';
  };

  const isCarnaval = dominantSeason.type === 'carnival';
  const isHighSeason = dominantSeason.type === 'high';

  return (
    <div className={cn('space-y-3', className)}>
      {/* Indicador principal de temporada */}
      <Card className={cn('p-4', dominantSeason.bgColor)}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <Badge variant={getSeasonBadgeVariant(dominantSeason.type)}>
                {dominantSeason.name}
              </Badge>
              <span className={cn('text-sm font-medium', dominantSeason.color)}>
                {getMultiplierText(dominantSeason.multiplier)}
              </span>
            </div>
            
            <p className={cn('text-sm', dominantSeason.color)}>
              {dominantSeason.description}
            </p>
            
            <div className="mt-2 text-xs text-gray-600">
              Estadía: {format(checkIn, 'dd MMM', { locale: es })} - {format(checkOut, 'dd MMM yyyy', { locale: es })}
            </div>
          </div>
          
          {/* Icono de temporada */}
          <div className="text-2xl">
            {dominantSeason.type === 'carnival' && '🎭'}
            {dominantSeason.type === 'high' && '☀️'}
            {dominantSeason.type === 'medium' && '🌤️'}
            {dominantSeason.type === 'low' && '🌿'}
          </div>
        </div>
      </Card>

      {/* Alertas especiales */}
      {isCarnaval && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertDescription className="text-orange-800">
            <div className="font-semibold mb-1">🎭 Temporada de Carnaval</div>
            <ul className="text-sm space-y-1">
              <li>• Estadía mínima: {dominantSeason.minStay} noches</li>
              <li>• Precios especiales (+100%)</li>
              <li>• Ambiente festivo garantizado</li>
              <li>• Reserva con anticipación recomendada</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {isHighSeason && !isCarnaval && (
        <Alert className="border-red-300 bg-red-50">
          <AlertDescription className="text-red-800">
            <div className="font-semibold mb-1">☀️ Temporada Alta</div>
            <ul className="text-sm space-y-1">
              <li>• Verano brasileño - alta demanda</li>
              <li>• Precios incrementados (+50%)</li>
              <li>• Playas de Rio en su mejor momento</li>
              <li>• Reserva temprana recomendada</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {dominantSeason.type === 'low' && (
        <Alert className="border-green-300 bg-green-50">
          <AlertDescription className="text-green-800">
            <div className="font-semibold mb-1">🌿 Temporada Baja</div>
            <ul className="text-sm space-y-1">
              <li>• Mejores precios del año (-20%)</li>
              <li>• Clima suave y agradable</li>
              <li>• Menos multitudes</li>
              <li>• Ideal para explorar Rio con calma</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Calendario de temporadas */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3 text-sm">Calendario de temporadas 2024</h4>
        <div className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
              <span>Dic-Mar: Temporada Alta (+50%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
              <span>Feb 10-17: Carnaval (+100%)</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <span>Abr-May, Oct-Nov: Media (estándar)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span>Jun-Sep: Baja (-20%)</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
