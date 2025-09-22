// lapa-casa-hostel-frontend/src/components/payment/payment-summary/payment-breakdown.tsx

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Receipt, Calendar, Users, Percent, TrendingDown } from 'lucide-react';

interface PaymentBreakdownProps {
  amount: number;
  currency: string;
  type: 'deposit' | 'remaining' | 'full';
  bookingData: any;
  className?: string;
}

const PaymentBreakdown: React.FC<PaymentBreakdownProps> = ({
  amount,
  currency,
  type,
  bookingData,
  className
}) => {
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Calculate booking details
  const calculateDetails = () => {
    const checkInDate = bookingData.checkInDate ? new Date(bookingData.checkInDate) : new Date();
    const checkOutDate = bookingData.checkOutDate ? new Date(bookingData.checkOutDate) : new Date();
    const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
    const beds = bookingData.bedsCount || 1;
    const basePrice = 60; // BRL per bed per night

    const subtotal = basePrice * beds * nights;

    // Group discount
    let groupDiscount = 0;
    let groupDiscountPercent = 0;
    if (beds >= 26) {
      groupDiscountPercent = 20;
      groupDiscount = subtotal * 0.20;
    } else if (beds >= 16) {
      groupDiscountPercent = 15;
      groupDiscount = subtotal * 0.15;
    } else if (beds >= 7) {
      groupDiscountPercent = 10;
      groupDiscount = subtotal * 0.10;
    }

    // Season multiplier
    const month = checkInDate.getMonth() + 1;
    let seasonMultiplier = 1.0;
    let seasonType = 'normal';
    
    if (month >= 12 || month <= 3) {
      seasonMultiplier = 1.5;
      seasonType = 'alta';
    } else if (month >= 6 && month <= 9) {
      seasonMultiplier = 0.8;
      seasonType = 'baja';
    }
    
    if (month === 2) {
      seasonMultiplier = 2.0;
      seasonType = 'carnaval';
    }

    const afterDiscount = subtotal - groupDiscount;
    const seasonAdjustment = afterDiscount * (seasonMultiplier - 1);
    const totalPrice = afterDiscount + seasonAdjustment;

    // Deposit calculation
    const isLargeGroup = beds >= 15;
    const depositPercent = isLargeGroup ? 50 : 30;
    const depositAmount = totalPrice * (depositPercent / 100);
    const remainingAmount = totalPrice - depositAmount;

    return {
      basePrice,
      nights,
      beds,
      subtotal,
      groupDiscount,
      groupDiscountPercent,
      seasonMultiplier,
      seasonType,
      seasonAdjustment,
      totalPrice,
      depositPercent,
      depositAmount,
      remainingAmount
    };
  };

  const details = calculateDetails();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Desglose del Pago
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking Summary */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <div>
              <p className="text-xs text-gray-600">Camas</p>
              <p className="font-medium">{details.beds}</p>
            </div>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">Precio base ({details.beds} camas × {details.nights} noches)</span>
            <span className="font-medium">{formatCurrency(details.subtotal)}</span>
          </div>

          {/* Group Discount */}
          {details.groupDiscount > 0 && (
            <div className="flex justify-between items-center text-green-600">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm">
                  Descuento grupo ({details.groupDiscountPercent}% - {details.beds}+ camas)
                </span>
              </div>
              <span className="font-medium">-{formatCurrency(details.groupDiscount)}</span>
            </div>
          )}

          {/* Season Adjustment */}
          {details.seasonMultiplier !== 1.0 && (
            <div className={`flex justify-between items-center ${details.seasonAdjustment > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                <span className="text-sm">
                  Temporada {details.seasonType} ({details.seasonMultiplier}x)
                </span>
              </div>
              <span className="font-medium">
                {details.seasonAdjustment > 0 ? '+' : ''}{formatCurrency(details.seasonAdjustment)}
              </span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total de la reserva</span>
            <span>{formatCurrency(details.totalPrice)}</span>
          </div>
        </div>

        {/* Payment Type Information */}
        <div className="space-y-3">
          <Separator />
          
          {type === 'deposit' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-600">Depósito ({details.depositPercent}%)</span>
                <span className="font-semibold text-blue-600">{formatCurrency(details.depositAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Saldo restante</span>
                <span>{formatCurrency(details.remainingAmount)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                El saldo será cobrado automáticamente 7 días antes del check-in
              </div>
            </div>
          )}

          {type === 'remaining' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Depósito pagado</span>
                <span>{formatCurrency(details.depositAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-600">Saldo restante</span>
                <span className="font-semibold text-blue-600">{formatCurrency(details.remainingAmount)}</span>
              </div>
            </div>
          )}

          {type === 'full' && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-600">Pago completo</span>
              <span className="font-semibold text-blue-600">{formatCurrency(details.totalPrice)}</span>
            </div>
          )}
        </div>

        {/* Payment Badges */}
        <div className="flex flex-wrap gap-2">
          {details.groupDiscount > 0 && (
            <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
              Descuento aplicado: {details.groupDiscountPercent}%
            </Badge>
          )}
          
          {details.seasonType === 'baja' && (
            <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
              Temporada baja: 20% off
            </Badge>
          )}
          
          {details.seasonType === 'alta' && (
            <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200">
              Temporada alta: +50%
            </Badge>
          )}
          
          {details.seasonType === 'carnaval' && (
            <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200">
              Carnaval: +100%
            </Badge>
          )}

          {details.beds >= 15 && (
            <Badge variant="outline" className="text-indigo-700 bg-indigo-50 border-indigo-200">
              Grupo grande: Depósito 50%
            </Badge>
          )}
        </div>

        {/* Savings Highlight */}
        {details.groupDiscount > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <TrendingDown className="w-4 h-4" />
              <span className="font-medium">
                ¡Ahorras {formatCurrency(details.groupDiscount)} con descuento de grupo!
              </span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Reservas de {details.beds}+ camas obtienen {details.groupDiscountPercent}% de descuento automático
            </p>
          </div>
        )}

        {/* Additional Information */}
        <div className="text-xs text-gray-600 space-y-1 mt-4">
          <p>• Precios en Reales Brasileños (BRL)</p>
          <p>• Tasas e impuestos incluidos</p>
          <p>• Política de cancelación: 48h antes sin costo</p>
          {type === 'deposit' && (
            <p>• El depósito confirma tu reserva inmediatamente</p>
          )}
        </div>

        {/* Contact Information */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 text-center">
            ¿Preguntas sobre precios? Contacta: reservas@lapacasahostel.com
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentBreakdown;-gray-600">Noches</p>
              <p className="font-medium">{details.nights}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-600" />
            <div>
              <p className="text-xs text
