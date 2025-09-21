// src/components/booking/pricing-calculator/group-discount-display.tsx

'use client';

import React from 'react';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { cn } from '@/lib/utils';

interface GroupDiscountDisplayProps {
  totalBeds: number;
  discountPercentage: number;
  discountAmount: number;
  className?: string;
}

export function GroupDiscountDisplay({
  totalBeds,
  discountPercentage,
  discountAmount,
  className
}: GroupDiscountDisplayProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getDiscountTier = () => {
    if (totalBeds >= 26) {
      return {
        tier: 'premium',
        name: 'Grupo Premium',
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-purple-50 border-purple-200',
        textColor: 'text-purple-800',
        badgeColor: 'bg-purple-100 text-purple-800',
        icon: '👑',
        benefits: [
          'Descuento máximo del 20%',
          'Uso casi exclusivo del hostel',
          'Atención personalizada',
          'Flexibilidad en horarios'
        ]
      };
    } else if (totalBeds >= 16) {
      return {
        tier: 'gold',
        name: 'Grupo Grande',
        color: 'from-yellow-500 to-yellow-600',
        bgColor: 'bg-yellow-50 border-yellow-200',
        textColor: 'text-yellow-800',
        badgeColor: 'bg-yellow-100 text-yellow-800',
        icon: '🥇',
        benefits: [
          'Descuento del 15%',
          'Prioridad en servicios',
          'Contacto directo',
          'Depósito del 50%'
        ]
      };
    } else {
      return {
        tier: 'bronze',
        name: 'Grupo Pequeño',
        color: 'from-green-500 to-green-600',
        bgColor: 'bg-green-50 border-green-200',
        textColor: 'text-green-800',
        badgeColor: 'bg-green-100 text-green-800',
        icon: '🥉',
        benefits: [
          'Descuento del 10%',
          'Ambiente de grupo',
          'Experiencia compartida',
          'Depósito estándar'
        ]
      };
    }
  };

  const tierInfo = getDiscountTier();

  // Calcular progreso hacia el siguiente tier
  const getProgressToNextTier = () => {
    if (totalBeds >= 26) {
      return { nextTier: null, progress: 100, bedsToNext: 0 };
    } else if (totalBeds >= 16) {
      const progress = ((totalBeds - 16) / (26 - 16)) * 100;
      return { nextTier: 'Premium', progress, bedsToNext: 26 - totalBeds };
    } else if (totalBeds >= 7) {
      const progress = ((totalBeds - 7) / (16 - 7)) * 100;
      return { nextTier: 'Grande', progress, bedsToNext: 16 - totalBeds };
    } else {
      const progress = (totalBeds / 7) * 100;
      return { nextTier: 'Pequeño', progress, bedsToNext: 7 - totalBeds };
    }
  };

  const progressInfo = getProgressToNextTier();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main discount card */}
      <Card className={cn('p-4', tierInfo.bgColor)}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">{tierInfo.icon}</span>
              <Badge className={tierInfo.badgeColor}>
                {tierInfo.name}
              </Badge>
              <Badge variant="outline" className="font-semibold">
                {Math.round(discountPercentage * 100)}% OFF
              </Badge>
            </div>
            
            <div className="mb-3">
              <div className={cn('text-2xl font-bold', tierInfo.textColor)}>
                {formatCurrency(discountAmount)}
              </div>
              <div className={cn('text-sm', tierInfo.textColor)}>
                ahorrado con descuento grupal
              </div>
            </div>

            <div className={cn('text-sm space-y-1', tierInfo.textColor)}>
              <div>Grupo de {totalBeds} personas</div>
              <div>Descuento automático aplicado</div>
            </div>
          </div>

          <div className="text-right">
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg',
              `bg-gradient-to-br ${tierInfo.color}`
            )}>
              {Math.round(discountPercentage * 100)}%
            </div>
          </div>
        </div>

        {/* Benefits list */}
        <div className="mt-4 pt-3 border-t border-current border-opacity-20">
          <div className={cn('font-medium mb-2', tierInfo.textColor)}>
            Beneficios incluidos:
          </div>
          <div className="grid grid-cols-2 gap-1">
            {tierInfo.benefits.map((benefit, index) => (
              <div key={index} className={cn('flex items-center text-xs', tierInfo.textColor)}>
                <span className="mr-1">✓</span>
                {benefit}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Progress to next tier */}
      {progressInfo.nextTier && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Progreso a Grupo {progressInfo.nextTier}
            </span>
            <span className="text-xs text-gray-600">
              {progressInfo.bedsToNext} camas más
            </span>
          </div>
          
          <Progress value={progressInfo.progress} className="h-2 mb-2" />
          
          <div className="text-xs text-gray-600">
            {progressInfo.nextTier === 'Premium' && (
              <>Agrega {progressInfo.bedsToNext} camas más para descuento del 20%</>
            )}
            {progressInfo.nextTier === 'Grande' && (
              <>Agrega {progressInfo.bedsToNext} camas más para descuento del 15%</>
            )}
            {progressInfo.nextTier === 'Pequeño' && (
              <>Agrega {progressInfo.bedsToNext} camas más para descuento del 10%</>
            )}
          </div>
        </Card>
      )}

      {/* Discount tiers comparison */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3 text-sm">Descuentos por tamaño de grupo</h4>
        <div className="space-y-3">
          {[
            { beds: '7-15', discount: '10%', name: 'Pequeño', current: totalBeds >= 7 && totalBeds < 16 },
            { beds: '16-25', discount: '15%', name: 'Grande', current: totalBeds >= 16 && totalBeds < 26 },
            { beds: '26+', discount: '20%', name: 'Premium', current: totalBeds >= 26 }
          ].map((tier, index) => (
            <div key={index} className={cn(
              'flex items-center justify-between p-2 rounded text-sm',
              tier.current 
                ? 'bg-blue-50 border border-blue-200 font-medium text-blue-800' 
                : 'text-gray-600'
            )}>
              <div className="flex items-center space-x-2">
                {tier.current && <span>👈</span>}
                <span>{tier.beds} personas</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>Grupo {tier.name}</span>
                <Badge variant={tier.current ? 'default' : 'outline'}>
                  {tier.discount}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Call to action for group expansion */}
      {totalBeds < 26 && progressInfo.bedsToNext <= 5 && (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="text-center">
            <div className="font-semibold text-blue-800 mb-1">
              ¡Casi llegas al siguiente nivel!
            </div>
            <div className="text-sm text-blue-700 mb-3">
              Solo {progressInfo.bedsToNext} camas más para {progressInfo.nextTier === 'Premium' ? '20%' : '15%'} de descuento
            </div>
            <div className="text-xs text-blue-600">
              ¿Tienes más amigos que quieran unirse?
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
