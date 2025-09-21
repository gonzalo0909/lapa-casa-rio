// src/components/booking/pricing-calculator/season-multiplier-display.tsx

'use client';

import React from 'react';
import { format, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { cn } from '@/lib/utils';

interface SeasonMultiplierDisplayProps {
  seasonMultiplier: number;
  multiplierAmount: number;
  checkIn: Date;
  checkOut: Date;
  className?: string;
}

export function SeasonMultiplierDisplay({
  seasonMultiplier,
  multiplierAmount,
  checkIn,
  checkOut,
  className
}: SeasonMultiplierDisplayProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getSeasonInfo = () => {
    if (seasonMultiplier === 2.0) {
      return {
        name: 'Carnaval',
        description: 'Temporada especial de Carnaval con precios premium',
        icon: '🎭',
        color: 'from-orange-500 to-red-500',
        bgColor: 'bg-orange-50 border-orange-200',
        textColor: 'text-orange-800',
        badgeColor: 'bg-orange-100 text-orange-800',
        type: 'premium',
        features: [
          'Precios especiales +100%',
          'Ambiente festivo único',
          'Estadía mínima 5 noches',
          'Experiencia de Carnaval'
        ]
      };
    } else if (seasonMultiplier === 1.5) {
      return {
        name: 'Temporada Alta',
        description: 'Verano brasileño con alta demanda turística',
        icon: '☀️',
        color: 'from-red-500 to-pink-500',
        bgColor: 'bg-red-50 border-red-200',
        textColor: 'text-red-800',
        badgeColor: 'bg-red-100 text-red-800',
        type: 'high',
        features: [
          'Incremento del 50%',
          'Verano en Rio',
          'Playas en su mejor momento',
          'Alta demanda turística'
        ]
      };
    } else if (seasonMultiplier === 0.8) {
      return {
        name: 'Temporada Baja',
        description: 'Invierno suave con los mejores precios del año',
        icon: '🌿',
        color: 'from-green-500 to-emerald-500',
        bgColor: 'bg-green-50 border-green-200',
        textColor: 'text-green-800',
        badgeColor: 'bg-green-100 text-green-800',
        type: 'low',
        features: [
          'Descuento del 20%',
          'Clima suave y agradable',
          'Menos multitudes',
          'Mejores precios'
        ]
      };
    } else {
      return {
        name: 'Temporada Media',
        description: 'Clima agradable con precios estándar',
        icon: '🌤️',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-50 border-blue-200',
        textColor: 'text-blue-800',
        badgeColor: 'bg-blue-100 text-blue-800',
        type: 'medium',
        features: [
          'Precios estándar',
          'Clima primaveral',
          'Buena disponibilidad',
          'Equilibrio perfecto'
        ]
      };
    }
  };

  const seasonInfo = getSeasonInfo();
  const isIncrease = seasonMultiplier > 1;
  const isDecrease = seasonMultiplier < 1;

  const getSeasonDates = () => {
    const year = checkIn.getFullYear();
    
    if (seasonInfo.type === 'premium') {
      return `10-17 Febrero ${year}`;
    } else if (seasonInfo.type === 'high') {
      return `Diciembre ${year-1} - Marzo ${year}`;
    } else if (seasonInfo.type === 'low') {
      return `Junio - Septiembre ${year}`;
    } else {
      return `Abril-Mayo, Octubre-Noviembre ${year}`;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main season card */}
      <Card className={cn('p-4', seasonInfo.bgColor)}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">{seasonInfo.icon}</span>
              <Badge className={seasonInfo.badgeColor}>
                {seasonInfo.name}
              </Badge>
              <Badge variant="outline" className={cn(
                'font-semibold',
                isIncrease && 'border-orange-300 text-orange-700',
                isDecrease && 'border-green-300 text-green-700'
              )}>
                {isIncrease && '+'}
                {Math.round(Math.abs(seasonMultiplier - 1) * 100)}%
              </Badge>
            </div>
            
            <div className="mb-3">
              <div className={cn('text-2xl font-bold', seasonInfo.textColor)}>
                {isIncrease && '+'}{formatCurrency(multiplierAmount)}
              </div>
              <div className={cn('text-sm', seasonInfo.textColor)}>
                {isIncrease ? 'incremento' : 'descuento'} por temporada
              </div>
            </div>

            <p className={cn('text-sm mb-3', seasonInfo.textColor)}>
              {seasonInfo.description}
            </p>

            <div className={cn('text-xs', seasonInfo.textColor)}>
              <div>Fechas: {getSeasonDates()}</div>
              <div>Estadía: {format(checkIn, 'dd MMM', { locale: es })} - {format(checkOut, 'dd MMM yyyy', { locale: es })}</div>
            </div>
          </div>

          <div className="text-right">
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-sm',
              `bg-gradient-to-br ${seasonInfo.color}`
            )}>
              {isIncrease && '+'}
              {Math.round(Math.abs(seasonMultiplier - 1) * 100)}%
            </div>
          </div>
        </div>

        {/* Features list */}
        <div className="mt-4 pt-3 border-t border-current border-opacity-20">
          <div className={cn('font-medium mb-2', seasonInfo.textColor)}>
            Características de la temporada:
          </div>
          <div className="grid grid-cols-2 gap-1">
            {seasonInfo.features.map((feature, index) => (
              <div key={index} className={cn('flex items-center text-xs', seasonInfo.textColor)}>
                <span className="mr-1">•</span>
                {feature}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Seasonal calendar */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3 text-sm">Calendario de temporadas Rio de Janeiro</h4>
        <div className="space-y-2">
          {[
            { 
              period: 'Dic-Mar', 
              name: 'Alta', 
              multiplier: '+50%', 
              current: seasonInfo.type === 'high',
              color: 'bg-red-100 border-red-300 text-red-800'
            },
            { 
              period: 'Feb 10-17', 
              name: 'Carnaval', 
              multiplier: '+100%', 
              current: seasonInfo.type === 'premium',
              color: 'bg-orange-100 border-orange-300 text-orange-800'
            },
            { 
              period: 'Abr-May', 
              name: 'Media', 
              multiplier: 'Estándar', 
              current: seasonInfo.type === 'medium',
              color: 'bg-blue-100 border-blue-300 text-blue-800'
            },
            { 
              period: 'Jun-Sep', 
              name: 'Baja', 
              multiplier: '-20%', 
              current: seasonInfo.type === 'low',
              color: 'bg-green-100 border-green-300 text-green-800'
            },
            { 
              period: 'Oct-Nov', 
              name: 'Media', 
              multiplier: 'Estándar', 
              current: seasonInfo.type === 'medium',
              color: 'bg-blue-100 border-blue-300 text-blue-800'
            }
          ].map((season, index) => (
            <div key={index} className={cn(
              'flex items-center justify-between p-2 rounded text-sm border',
              season.current 
                ? cn(season.color, 'font-medium border-2') 
                : 'text-gray-600 border-gray-200'
            )}>
              <div className="flex items-center space-x-2">
                {season.current && <span>👈</span>}
                <span>{season.period}</span>
                <span className="font-medium">{season.name}</span>
              </div>
              <Badge variant={season.current ? 'default' : 'outline'}>
                {season.multiplier}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {/* Special notices */}
      {seasonInfo.type === 'premium' && (
        <Card className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
          <div className="text-center">
            <div className="text-lg font-bold text-orange-800 mb-1">
              ¡Temporada de Carnaval!
            </div>
            <div className="text-sm text-orange-700 mb-2">
              Vive el evento más importante de Brasil
            </div>
            <div className="text-xs text-orange-600 space-y-1">
              <div>• Blocos de rua en Santa Teresa</div>
              <div>• Fácil acceso al Sambódromo</div>
              <div>• Ambiente festivo garantizado</div>
              <div>• Experiencia única en la vida</div>
            </div>
          </div>
        </Card>
      )}

      {seasonInfo.type === 'low' && (
        <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <div className="text-center">
            <div className="text-lg font-bold text-green-800 mb-1">
              ¡Mejor época para ahorrar!
            </div>
            <div className="text-sm text-green-700 mb-2">
              Descubre Rio sin multitudes
            </div>
            <div className="text-xs text-green-600 space-y-1">
              <div>• Clima agradable (18-25°C)</div>
              <div>• Museos y atracciones sin colas</div>
              <div>• Experiencia más auténtica</div>
              <div>• Presupuesto optimizado</div>
            </div>
          </div>
        </Card>
      )}

      {/* Weather info */}
      <Card className="p-3 bg-gray-50">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="font-medium">Clima esperado para tu estadía:</div>
          {seasonInfo.type === 'high' && <div>• 25-35°C, soleado, lluvias ocasionales</div>}
          {seasonInfo.type === 'premium' && <div>• 25-35°C, caluroso, posibles lluvias</div>}
          {seasonInfo.type === 'low' && <div>• 18-25°C, suave, seco, cielos claros</div>}
          {seasonInfo.type === 'medium' && <div>• 20-28°C, agradable, pocas lluvias</div>}
        </div>
      </Card>
    </div>
  );
}
