// src/components/booking/pricing-calculator/price-breakdown.tsx

'use client';

import React, { useState } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { cn } from '@/lib/utils';

interface PriceBreakdownProps {
  basePrice: number;
  totalBeds: number;
  nights: number;
  subtotal: number;
  groupDiscount: number;
  groupDiscountAmount: number;
  seasonMultiplier: number;
  seasonMultiplierAmount: number;
  totalBeforeDeposit: number;
  className?: string;
}

export function PriceBreakdown({
  basePrice,
  totalBeds,
  nights,
  subtotal,
  groupDiscount,
  groupDiscountAmount,
  seasonMultiplier,
  seasonMultiplierAmount,
  totalBeforeDeposit,
  className
}: PriceBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    if (value > 1) {
      return `+${Math.round((value - 1) * 100)}%`;
    } else if (value < 1) {
      return `-${Math.round((1 - value) * 100)}%`;
    }
    return '0%';
  };

  const hasDiscounts = groupDiscount > 0;
  const hasSeasonAdjustment = seasonMultiplier !== 1.0;

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">Desglose de precio</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs"
        >
          {isExpanded ? 'Ocultar' : 'Ver detalle'}
        </Button>
      </div>

      <div className="space-y-2">
        {/* Base calculation */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {totalBeds} {totalBeds === 1 ? 'cama' : 'camas'} × {nights} {nights === 1 ? 'noche' : 'noches'} × {formatCurrency(basePrice)}
          </span>
          <span className="font-medium">
            {formatCurrency(subtotal)}
          </span>
        </div>

        {isExpanded && (
          <div className="pl-4 space-y-2 border-l-2 border-gray-200">
            <div className="text-xs text-gray-500">
              Precio base por cama por noche: {formatCurrency(basePrice)}
            </div>
            <div className="text-xs text-gray-500">
              Total de camas: {totalBeds}
            </div>
            <div className="text-xs text-gray-500">
              Número de noches: {nights}
            </div>
          </div>
        )}

        {/* Group discount */}
        {hasDiscounts && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600">
                Descuento grupal ({Math.round(groupDiscount * 100)}%)
              </span>
              <span className="font-medium text-green-600">
                -{formatCurrency(groupDiscountAmount)}
              </span>
            </div>

            {isExpanded && (
              <div className="pl-4 space-y-1 border-l-2 border-green-200">
                <div className="text-xs text-green-600">
                  {totalBeds >= 26 && 'Grupo grande (26+ camas): 20% descuento'}
                  {totalBeds >= 16 && totalBeds < 26 && 'Grupo mediano (16-25 camas): 15% descuento'}
                  {totalBeds >= 7 && totalBeds < 16 && 'Grupo pequeño (7-15 camas): 10% descuento'}
                </div>
                <div className="text-xs text-green-600">
                  Aplicado sobre el subtotal: {formatCurrency(subtotal)} × {Math.round(groupDiscount * 100)}%
                </div>
              </div>
            )}
          </>
        )}

        {/* Subtotal after discounts */}
        {hasDiscounts && (
          <div className="flex items-center justify-between text-sm py-1 border-t border-gray-200">
            <span className="font-medium">Subtotal con descuentos</span>
            <span className="font-medium">
              {formatCurrency(subtotal - groupDiscountAmount)}
            </span>
          </div>
        )}

        {/* Season multiplier */}
        {hasSeasonAdjustment && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className={cn(
                seasonMultiplier > 1 ? 'text-orange-600' : 'text-green-600'
              )}>
                Ajuste temporal ({formatPercentage(seasonMultiplier)})
              </span>
              <span className={cn(
                'font-medium',
                seasonMultiplier > 1 ? 'text-orange-600' : 'text-green-600'
              )}>
                {seasonMultiplierAmount > 0 ? '+' : ''}{formatCurrency(seasonMultiplierAmount)}
              </span>
            </div>

            {isExpanded && (
              <div className={cn(
                'pl-4 space-y-1 border-l-2',
                seasonMultiplier > 1 ? 'border-orange-200' : 'border-green-200'
              )}>
                <div className={cn(
                  'text-xs',
                  seasonMultiplier > 1 ? 'text-orange-600' : 'text-green-600'
                )}>
                  {seasonMultiplier === 2.0 && 'Temporada Carnaval: precios especiales (+100%)'}
                  {seasonMultiplier === 1.5 && 'Temporada Alta (Dic-Mar): demanda alta (+50%)'}
                  {seasonMultiplier === 0.8 && 'Temporada Baja (Jun-Sep): mejores precios (-20%)'}
                  {seasonMultiplier === 1.0 && 'Temporada Media: precio estándar'}
                </div>
                <div className={cn(
                  'text-xs',
                  seasonMultiplier > 1 ? 'text-orange-600' : 'text-green-600'
                )}>
                  Base: {formatCurrency(subtotal - groupDiscountAmount)} × {formatPercentage(seasonMultiplier)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Final total */}
        <div className="flex items-center justify-between pt-2 border-t-2 border-gray-300">
          <span className="font-semibold text-lg">Total</span>
          <span className="font-bold text-lg text-blue-600">
            {formatCurrency(totalBeforeDeposit)}
          </span>
        </div>

        {/* Per person breakdown */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Por persona ({totalBeds} personas)</span>
          <span>{formatCurrency(totalBeforeDeposit / totalBeds)}</span>
        </div>

        {/* Per night breakdown */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Por noche ({nights} {nights === 1 ? 'noche' : 'noches'})</span>
          <span>{formatCurrency(totalBeforeDeposit / nights)}</span>
        </div>
      </div>

      {/* Summary cards */}
      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Savings summary */}
          {hasDiscounts && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="text-sm font-medium text-green-800">Ahorros totales</div>
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(groupDiscountAmount)}
              </div>
              <div className="text-xs text-green-700">
                {((groupDiscountAmount / subtotal) * 100).toFixed(1)}% de descuento
              </div>
            </div>
          )}

          {/* Season impact */}
          {hasSeasonAdjustment && (
            <div className={cn(
              'p-3 border rounded',
              seasonMultiplier > 1 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-green-50 border-green-200'
            )}>
              <div className={cn(
                'text-sm font-medium',
                seasonMultiplier > 1 ? 'text-orange-800' : 'text-green-800'
              )}>
                Impacto temporal
              </div>
              <div className={cn(
                'text-lg font-bold',
                seasonMultiplier > 1 ? 'text-orange-600' : 'text-green-600'
              )}>
                {seasonMultiplierAmount > 0 ? '+' : ''}{formatCurrency(seasonMultiplierAmount)}
              </div>
              <div className={cn(
                'text-xs',
                seasonMultiplier > 1 ? 'text-orange-700' : 'text-green-700'
              )}>
                {formatPercentage(seasonMultiplier)} ajuste
              </div>
            </div>
          )}
        </div>
      )}

      {/* Price comparison */}
      {(hasDiscounts || hasSeasonAdjustment) && isExpanded && (
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Precio original:</span>
              <span className="line-through text-gray-500">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Precio final:</span>
              <span className="text-blue-600">{formatCurrency(totalBeforeDeposit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Diferencia:</span>
              <span className={cn(
                totalBeforeDeposit < subtotal ? 'text-green-600' : 'text-orange-600'
              )}>
                {totalBeforeDeposit < subtotal ? '-' : '+'}{formatCurrency(Math.abs(totalBeforeDeposit - subtotal))}
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
