// src/components/booking/pricing-calculator/savings-indicator.tsx

'use client';

import React from 'react';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Progress } from '../../ui/progress';
import { cn } from '@/lib/utils';

interface SavingsIndicatorProps {
  originalPrice: number;
  finalPrice: number;
  totalSavings: number;
  className?: string;
}

export function SavingsIndicator({
  originalPrice,
  finalPrice,
  totalSavings,
  className
}: SavingsIndicatorProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const savingsPercentage = (totalSavings / originalPrice) * 100;
  const effectiveDiscount = ((originalPrice - finalPrice) / originalPrice) * 100;

  // Calcular el nivel de ahorro
  const getSavingsLevel = () => {
    if (savingsPercentage >= 20) {
      return {
        level: 'excellent',
        name: 'Excelente',
        color: 'from-green-500 to-emerald-600',
        bgColor: 'bg-green-50 border-green-200',
        textColor: 'text-green-800',
        badgeColor: 'bg-green-100 text-green-800',
        icon: '🎉',
        message: '¡Ahorros increíbles!'
      };
    } else if (savingsPercentage >= 15) {
      return {
        level: 'great',
        name: 'Muy Bueno',
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-50 border-blue-200',
        textColor: 'text-blue-800',
        badgeColor: 'bg-blue-100 text-blue-800',
        icon: '💰',
        message: 'Excelentes ahorros'
      };
    } else if (savingsPercentage >= 10) {
      return {
        level: 'good',
        name: 'Bueno',
        color: 'from-cyan-500 to-cyan-600',
        bgColor: 'bg-cyan-50 border-cyan-200',
        textColor: 'text-cyan-800',
        badgeColor: 'bg-cyan-100 text-cyan-800',
        icon: '💡',
        message: 'Buenos ahorros'
      };
    } else {
      return {
        level: 'basic',
        name: 'Básico',
        color: 'from-gray-500 to-gray-600',
        bgColor: 'bg-gray-50 border-gray-200',
        textColor: 'text-gray-800',
        badgeColor: 'bg-gray-100 text-gray-800',
        icon: '💵',
        message: 'Ahorros aplicados'
      };
    }
  };

  const savingsInfo = getSavingsLevel();

  if (totalSavings <= 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main savings card */}
      <Card className={cn('p-4', savingsInfo.bgColor)}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-2xl">{savingsInfo.icon}</span>
              <Badge className={savingsInfo.badgeColor}>
                {savingsInfo.name}
              </Badge>
              <Badge variant="outline" className="font-semibold text-green-700">
                {savingsPercentage.toFixed(1)}% OFF
              </Badge>
            </div>
            
            <div className="mb-3">
              <div className={cn('text-3xl font-bold', savingsInfo.textColor)}>
                {formatCurrency(totalSavings)}
              </div>
              <div className={cn('text-sm', savingsInfo.textColor)}>
                {savingsInfo.message}
              </div>
            </div>

            <div className={cn('text-sm space-y-1', savingsInfo.textColor)}>
              <div>Precio original: {formatCurrency(originalPrice)}</div>
              <div>Precio final: {formatCurrency(finalPrice)}</div>
            </div>
          </div>

          <div className="text-right">
            <div className={cn(
              'w-20 h-20 rounded-full flex flex-col items-center justify-center text-white font-bold',
              `bg-gradient-to-br ${savingsInfo.color}`
            )}>
              <div className="text-lg">-{savingsPercentage.toFixed(0)}%</div>
              <div className="text-xs">AHORRO</div>
            </div>
          </div>
        </div>

        {/* Savings breakdown */}
        <div className="mt-4 pt-3 border-t border-current border-opacity-20">
          <div className={cn('text-sm space-y-2', savingsInfo.textColor)}>
            <div className="flex justify-between">
              <span>Descuento grupal:</span>
              <span className="font-medium">{formatCurrency(totalSavings)}</span>
            </div>
            <div className="flex justify-between">
              <span>Porcentaje de ahorro:</span>
              <span className="font-medium">{savingsPercentage.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Savings progress visual */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Nivel de ahorro</span>
          <span className="text-xs text-gray-600">
            {savingsPercentage.toFixed(1)}% de descuento
          </span>
        </div>
        
        <Progress value={Math.min(savingsPercentage, 25) * 4} className="h-3 mb-2" />
        
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>10%</span>
          <span>15%</span>
          <span>20%+</span>
        </div>
      </Card>

      {/* Comparison with other booking methods */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3 text-sm">Comparación de precios</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span className="text-sm font-medium">Lapa Casa Hostel (Directo)</span>
            </div>
            <div className="text-sm font-semibold text-green-600">
              {formatCurrency(finalPrice)}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">○</span>
              <span className="text-sm text-gray-600">Booking.com (estimado)</span>
            </div>
            <div className="text-sm text-gray-600 line-through">
              {formatCurrency(originalPrice * 1.15)}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded">
            <div className="flex items-center space-x-2">
              <span className="text-gray-400">○</span>
              <span className="text-sm text-gray-600">Hostelworld (estimado)</span>
            </div>
            <div className="text-sm text-gray-600 line-through">
              {formatCurrency(originalPrice * 1.12)}
            </div>
          </div>
        </div>
        
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          Reserva directa = Sin comisiones + Descuentos exclusivos + Atención personalizada
        </div>
      </Card>

      {/* What you can do with the savings */}
      <Card className="p-4 bg-gradient-to-r from-green-50 to-blue-50">
        <h4 className="font-semibold mb-3 text-sm">¿Qué puedes hacer con tus ahorros?</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span>🍕</span>
            <span>Pizza para todo el grupo</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>🚠</span>
            <span>Boletos al Pan de Azúcar</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>🏖️</span>
            <span>Día completo en Copacabana</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>🎵</span>
            <span>Shows de samba en Lapa</span>
          </div>
        </div>
        
        <div className="mt-3 text-center text-xs text-gray-600">
          Tu ahorro de {formatCurrency(totalSavings)} te permite disfrutar más de Rio de Janeiro
        </div>
      </Card>

      {/* Social proof */}
      <Card className="p-3 bg-gray-50">
        <div className="text-xs text-gray-600 text-center space-y-1">
          <div className="font-medium">¿Sabías que...?</div>
          <div>Los huéspedes que reservan directamente ahorran en promedio 15% vs plataformas terceras</div>
          <div>96% de nuestros grupos recomiendan reservar directamente</div>
        </div>
      </Card>
    </div>
  );
}
