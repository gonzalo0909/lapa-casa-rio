// src/components/booking/pricing-calculator/pricing-calculator.tsx

'use client';

import React, { useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { PriceBreakdown } from './price-breakdown';
import { GroupDiscountDisplay } from './group-discount-display';
import { SeasonMultiplierDisplay } from './season-multiplier-display';
import { SavingsIndicator } from './savings-indicator';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { cn } from '@/lib/utils';

interface RoomSelection {
  roomId: string;
  bedsRequested: number;
}

interface PricingCalculatorProps {
  dateRange: {
    checkIn: Date | null;
    checkOut: Date | null;
  };
  selectedRooms: RoomSelection[];
  className?: string;
}

interface PricingBreakdown {
  basePrice: number;
  totalBeds: number;
  nights: number;
  subtotal: number;
  groupDiscount: number;
  groupDiscountAmount: number;
  seasonMultiplier: number;
  seasonMultiplierAmount: number;
  totalBeforeDeposit: number;
  depositPercentage: number;
  depositAmount: number;
  remainingAmount: number;
  totalSavings: number;
}

export function PricingCalculator({
  dateRange,
  selectedRooms,
  className
}: PricingCalculatorProps) {
  const basePrice = 60.00; // BRL por cama por noche - precio base Lapa Casa Hostel

  const pricingData: PricingBreakdown | null = useMemo(() => {
    if (!dateRange.checkIn || !dateRange.checkOut || selectedRooms.length === 0) {
      return null;
    }

    const nights = differenceInDays(dateRange.checkOut, dateRange.checkIn);
    const totalBeds = selectedRooms.reduce((sum, room) => sum + room.bedsRequested, 0);
    
    if (nights <= 0 || totalBeds <= 0) return null;

    // Subtotal base
    const subtotal = totalBeds * basePrice * nights;

    // Descuentos por grupo (lógica específica Lapa Casa Hostel)
    const groupDiscount = calculateGroupDiscount(totalBeds);
    const groupDiscountAmount = subtotal * groupDiscount;

    // Multiplicador de temporada
    const seasonMultiplier = calculateSeasonMultiplier(dateRange.checkIn, dateRange.checkOut);
    const seasonMultiplierAmount = (subtotal - groupDiscountAmount) * (seasonMultiplier - 1);

    // Total después de descuentos y multiplicadores
    const totalBeforeDeposit = subtotal - groupDiscountAmount + seasonMultiplierAmount;

    // Depósitos (30% estándar, 50% para grupos grandes)
    const depositPercentage = totalBeds >= 15 ? 0.50 : 0.30;
    const depositAmount = totalBeforeDeposit * depositPercentage;
    const remainingAmount = totalBeforeDeposit - depositAmount;

    // Ahorros totales
    const totalSavings = groupDiscountAmount;

    return {
      basePrice,
      totalBeds,
      nights,
      subtotal,
      groupDiscount,
      groupDiscountAmount,
      seasonMultiplier,
      seasonMultiplierAmount,
      totalBeforeDeposit,
      depositPercentage,
      depositAmount,
      remainingAmount,
      totalSavings
    };
  }, [dateRange, selectedRooms]);

  const calculateGroupDiscount = (totalBeds: number): number => {
    if (totalBeds >= 26) return 0.20; // 20% descuento para 26+ camas
    if (totalBeds >= 16) return 0.15; // 15% descuento para 16-25 camas
    if (totalBeds >= 7) return 0.10;  // 10% descuento para 7-15 camas
    return 0; // Sin descuento para menos de 7 camas
  };

  const calculateSeasonMultiplier = (checkIn: Date, checkOut: Date): number => {
    // Temporadas específicas para Rio de Janeiro
    const checkInMonth = checkIn.getMonth() + 1;
    const checkInDay = checkIn.getDate();
    
    // Carnaval (mediados de febrero) - +100%
    if (checkInMonth === 2 && checkInDay >= 10 && checkInDay <= 17) {
      return 2.0;
    }
    
    // Temporada alta (Dic-Mar) - +50%
    if (checkInMonth === 12 || checkInMonth <= 3) {
      return 1.5;
    }
    
    // Temporada baja (Jun-Sep) - -20%
    if (checkInMonth >= 6 && checkInMonth <= 9) {
      return 0.8;
    }
    
    // Temporada media (Abr-May, Oct-Nov) - precio estándar
    return 1.0;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  if (!pricingData) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">💰</div>
          <div className="font-medium mb-1">Calculadora de precios</div>
          <div className="text-sm">
            Selecciona fechas y habitaciones para ver el precio
          </div>
        </div>
      </Card>
    );
  }

  const hasGroupDiscount = pricingData.groupDiscount > 0;
  const hasSeasonMultiplier = pricingData.seasonMultiplier !== 1.0;
  const isCarnavalSeason = pricingData.seasonMultiplier === 2.0;
  const isHighSeason = pricingData.seasonMultiplier === 1.5;
  const isLowSeason = pricingData.seasonMultiplier === 0.8;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Resumen de precio</h3>
          <Badge variant="outline">
            {pricingData.totalBeds} {pricingData.totalBeds === 1 ? 'cama' : 'camas'}
          </Badge>
        </div>

        {/* Quick summary */}
        <div className="text-center py-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(pricingData.totalBeforeDeposit)}
          </div>
          <div className="text-sm text-blue-700">
            Total por {pricingData.nights} {pricingData.nights === 1 ? 'noche' : 'noches'}
          </div>
        </div>
      </Card>

      {/* Group Discount Display */}
      {hasGroupDiscount && (
        <GroupDiscountDisplay
          totalBeds={pricingData.totalBeds}
          discountPercentage={pricingData.groupDiscount}
          discountAmount={pricingData.groupDiscountAmount}
        />
      )}

      {/* Season Multiplier Display */}
      {hasSeasonMultiplier && (
        <SeasonMultiplierDisplay
          seasonMultiplier={pricingData.seasonMultiplier}
          multiplierAmount={pricingData.seasonMultiplierAmount}
          checkIn={dateRange.checkIn!}
          checkOut={dateRange.checkOut!}
        />
      )}

      {/* Savings Indicator */}
      {pricingData.totalSavings > 0 && (
        <SavingsIndicator
          originalPrice={pricingData.subtotal}
          finalPrice={pricingData.totalBeforeDeposit}
          totalSavings={pricingData.totalSavings}
        />
      )}

      {/* Detailed Price Breakdown */}
      <PriceBreakdown
        basePrice={pricingData.basePrice}
        totalBeds={pricingData.totalBeds}
        nights={pricingData.nights}
        subtotal={pricingData.subtotal}
        groupDiscount={pricingData.groupDiscount}
        groupDiscountAmount={pricingData.groupDiscountAmount}
        seasonMultiplier={pricingData.seasonMultiplier}
        seasonMultiplierAmount={pricingData.seasonMultiplierAmount}
        totalBeforeDeposit={pricingData.totalBeforeDeposit}
      />

      {/* Payment Structure */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">Estructura de pago</h4>
        
        <div className="space-y-3">
          {/* Deposit */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200">
            <div>
              <div className="font-medium text-green-800">
                Depósito ({Math.round(pricingData.depositPercentage * 100)}%)
              </div>
              <div className="text-sm text-green-700">
                A pagar ahora para confirmar reserva
              </div>
            </div>
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(pricingData.depositAmount)}
            </div>
          </div>

          {/* Remaining */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
            <div>
              <div className="font-medium text-blue-800">
                Saldo restante
              </div>
              <div className="text-sm text-blue-700">
                Se cobrará automáticamente 7 días antes del check-in
              </div>
            </div>
            <div className="text-lg font-bold text-blue-600">
              {formatCurrency(pricingData.remainingAmount)}
            </div>
          </div>
        </div>

        {/* Payment method notice */}
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
          Aceptamos: Tarjetas de crédito/débito, PIX, Mercado Pago
        </div>
      </Card>

      {/* Special notices */}
      {isCarnavalSeason && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="text-orange-800">
            <div className="font-semibold mb-1">🎭 Temporada de Carnaval</div>
            <div className="text-sm">
              Precios especiales aplicados. Estadía mínima de 5 noches requerida.
            </div>
          </div>
        </Card>
      )}

      {isHighSeason && !isCarnavalSeason && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-800">
            <div className="font-semibold mb-1">☀️ Temporada Alta</div>
            <div className="text-sm">
              Verano brasileño - precios incrementados por alta demanda.
            </div>
          </div>
        </Card>
      )}

      {isLowSeason && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="text-green-800">
            <div className="font-semibold mb-1">🌿 Temporada Baja</div>
            <div className="text-sm">
              ¡Aprovecha los mejores precios del año!
            </div>
          </div>
        </Card>
      )}

      {/* Large group benefits */}
      {pricingData.totalBeds >= 20 && (
        <Card className="p-4 bg-purple-50 border-purple-200">
          <div className="text-purple-800">
            <div className="font-semibold mb-2">🏨 Grupo Grande - Beneficios Especiales</div>
            <div className="text-sm space-y-1">
              <div>• Uso casi exclusivo del hostel</div>
              <div>• Contacto directo con management</div>
              <div>• Flexibilidad en horarios de check-in/out</div>
              <div>• Servicios adicionales disponibles</div>
            </div>
          </div>
        </Card>
      )}

      {/* Call to action */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="font-semibold mb-2">¿Listo para reservar?</div>
          <div className="text-sm text-gray-600 mb-3">
            Solo se requiere el depósito para confirmar tu reserva
          </div>
          <Button className="w-full" size="lg">
            Continuar con el depósito de {formatCurrency(pricingData.depositAmount)}
          </Button>
        </div>
      </Card>

      {/* Price guarantee */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <div>✓ Precios garantizados una vez confirmada la reserva</div>
        <div>✓ Cancelación gratuita hasta 24h antes del check-in</div>
        <div>✓ Soporte 24/7 via WhatsApp</div>
      </div>
    </div>
  );
}
