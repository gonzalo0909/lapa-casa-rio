// src/components/booking/booking-summary/price-summary.tsx

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calculator, 
  TrendingDown, 
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Calendar
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PriceSummaryProps {
  basePrice: number;
  beds: number;
  nights: number;
  groupDiscount?: number;
  seasonMultiplier?: number;
  additionalServices?: Array<{
    name: string;
    price: number;
    quantity?: number;
  }>;
  promoCode?: {
    code: string;
    discount: number;
  };
  showBreakdown?: boolean;
  className?: string;
}

export function PriceSummary({
  basePrice,
  beds,
  nights,
  groupDiscount = 0,
  seasonMultiplier = 1,
  additionalServices = [],
  promoCode,
  showBreakdown = true,
  className = ''
}: PriceSummaryProps) {
  const [expandedBreakdown, setExpandedBreakdown] = useState(false);

  // Cálculos principais
  const subtotal = basePrice * beds * nights;
  const groupDiscountAmount = subtotal * groupDiscount;
  const seasonAdjustment = subtotal * (seasonMultiplier - 1);
  const servicesTotal = additionalServices.reduce((sum, service) => {
    return sum + (service.price * (service.quantity || 1));
  }, 0);
  
  let totalBeforePromo = subtotal - groupDiscountAmount + seasonAdjustment + servicesTotal;
  const promoDiscountAmount = promoCode ? totalBeforePromo * promoCode.discount : 0;
  const finalTotal = totalBeforePromo - promoDiscountAmount;
  
  const depositAmount = finalTotal * 0.30;
  const remainingAmount = finalTotal - depositAmount;

  const getSeasonLabel = () => {
    if (seasonMultiplier > 1.8) return 'Carnaval';
    if (seasonMultiplier > 1.3) return 'Alta Temporada';
    if (seasonMultiplier < 0.9) return 'Baixa Temporada';
    return 'Temporada Regular';
  };

  const getDiscountLabel = (discount: number) => {
    if (discount >= 0.20) return 'Desconto Excelente!';
    if (discount >= 0.15) return 'Ótimo Desconto!';
    if (discount >= 0.10) return 'Bom Desconto!';
    return 'Desconto Aplicado';
  };

  return (
    <Card className={`${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-blue-600" />
            Resumo de Preços
          </h3>
          
          {showBreakdown && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedBreakdown(!expandedBreakdown)}
            >
              {expandedBreakdown ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>

        {/* Resumo Principal */}
        <div className="space-y-3">
          {/* Subtotal */}
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-700">
                Subtotal
              </span>
              {expandedBreakdown && (
                <div className="text-sm text-gray-500">
                  {beds} camas × {nights} {nights === 1 ? 'noite' : 'noites'} × R$ {basePrice}
                </div>
              )}
            </div>
            <span className="font-medium text-gray-900">
              {formatCurrency(subtotal)}
            </span>
          </div>

          {/* Desconto de Grupo */}
          {groupDiscount > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <TrendingDown className="w-4 h-4 text-emerald-600 mr-2" />
                <div>
                  <span className="text-emerald-700">
                    {getDiscountLabel(groupDiscount)}
                  </span>
                  {expandedBreakdown && (
                    <div className="text-sm text-emerald-600">
                      {beds} pessoas • {(groupDiscount * 100).toFixed(0)}% desconto
                    </div>
                  )}
                </div>
              </div>
              <span className="font-medium text-emerald-700">
                -{formatCurrency(groupDiscountAmount)}
              </span>
            </div>
          )}

          {/* Ajuste de Temporada */}
          {seasonMultiplier !== 1 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                {seasonMultiplier > 1 ? (
                  <TrendingUp className="w-4 h-4 text-orange-600 mr-2" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-blue-600 mr-2" />
                )}
                <div>
                  <span className={seasonMultiplier > 1 ? 'text-orange-700' : 'text-blue-700'}>
                    {getSeasonLabel()}
                  </span>
                  {expandedBreakdown && (
                    <div className={`text-sm ${seasonMultiplier > 1 ? 'text-orange-600' : 'text-blue-600'}`}>
                      {seasonMultiplier > 1 ? '+' : ''}{((seasonMultiplier - 1) * 100).toFixed(0)}% ajuste
                    </div>
                  )}
                </div>
              </div>
              <span className={`font-medium ${seasonMultiplier > 1 ? 'text-orange-700' : 'text-blue-700'}`}>
                {seasonAdjustment > 0 ? '+' : ''}{formatCurrency(Math.abs(seasonAdjustment))}
              </span>
            </div>
          )}

          {/* Serviços Adicionais */}
          {additionalServices.length > 0 && (
            <div className="space-y-2">
              {additionalServices.map((service, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <span className="text-gray-700">
                      {service.name}
                    </span>
                    {expandedBreakdown && service.quantity && service.quantity > 1 && (
                      <div className="text-sm text-gray-500">
                        {service.quantity}x R$ {service.price}
                      </div>
                    )}
                  </div>
                  <span className="font-medium text-gray-900">
                    +{formatCurrency(service.price * (service.quantity || 1))}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Código Promocional */}
          {promoCode && (
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Badge className="bg-purple-100 text-purple-800 mr-2">
                  {promoCode.code}
                </Badge>
                <span className="text-purple-700">
                  Código promocional
                </span>
                {expandedBreakdown && (
                  <div className="text-sm text-purple-600 ml-2">
                    {(promoCode.discount * 100).toFixed(0)}% desconto
                  </div>
                )}
              </div>
              <span className="font-medium text-purple-700">
                -{formatCurrency(promoDiscountAmount)}
              </span>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="border-t border-gray-200 mt-4 pt-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xl font-bold text-gray-900">
              Total
            </span>
            <span className="text-xl font-bold text-gray-900">
              {formatCurrency(finalTotal)}
            </span>
          </div>

          {/* Breakdown de Pagamento */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-gray-900 text-sm">
              Forma de Pagamento
            </h4>

            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <CreditCard className="w-4 h-4 text-emerald-600 mr-2" />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Depósito (30%)
                  </span>
                  <div className="text-xs text-gray-600">
                    Pago agora
                  </div>
                </div>
              </div>
              <span className="font-semibold text-emerald-700">
                {formatCurrency(depositAmount)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Saldo (70%)
                  </span>
                  <div className="text-xs text-gray-600">
                    Cobrança automática 7 dias antes
                  </div>
                </div>
              </div>
              <span className="font-semibold text-blue-700">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </div>

          {/* Economia Total */}
          {(groupDiscountAmount + promoDiscountAmount) > 0 && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <TrendingDown className="w-5 h-5 text-emerald-600 mr-2" />
                  <div>
                    <span className="font-medium text-emerald-900">
                      Você economizou!
                    </span>
                    <div className="text-sm text-emerald-700">
                      Comparado ao preço regular
                    </div>
                  </div>
                </div>
                <span className="text-lg font-bold text-emerald-700">
                  {formatCurrency(groupDiscountAmount + promoDiscountAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Informação Adicional */}
          {expandedBreakdown && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-1">Política de Preços:</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Preço base: R$ {basePrice} por cama/noite</li>
                    <li>• Descontos automáticos para grupos 7+ pessoas</li>
                    <li>• Ajustes sazonais aplicados conforme demanda</li>
                    <li>• Todos os preços em reais (BRL)</li>
                    <li>• Café da manhã incluso no preço</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
