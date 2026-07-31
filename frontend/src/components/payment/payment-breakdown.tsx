// lapa-casa-hostel/frontend/src/components/payment/payment-breakdown.tsx

'use client';

import React from 'react';
import { Card } from '../ui/card';

interface PaymentBreakdownProps {
  amount: number;
  depositAmount: number;
  remainingAmount: number;
  currency: string;
  groupDiscount?: number;
  seasonMultiplier?: number;
  baseAmount?: number;
}

export function PaymentBreakdown({
  amount,
  depositAmount,
  remainingAmount,
  currency,
  groupDiscount = 0,
  seasonMultiplier = 1,
  baseAmount
}: PaymentBreakdownProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency === 'BRL' ? 'BRL' : 'USD'
    }).format(value);
  };

  const depositPercentage = (depositAmount / amount) * 100;
  const hasDiscount = groupDiscount > 0;
  const hasSurcharge = seasonMultiplier > 1;

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Resumo do Pagamento</h3>

      <div className="space-y-3">
        {baseAmount && baseAmount !== amount && (
          <>
            <div className="flex justify-between items-center text-gray-600">
              <span>Valor base</span>
              <span>{formatCurrency(baseAmount)}</span>
            </div>

            {hasDiscount && (
              <div className="flex justify-between items-center text-green-600">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/>
                  </svg>
                  Desconto grupo ({(groupDiscount * 100).toFixed(0)}%)
                </span>
                <span>-{formatCurrency(baseAmount * groupDiscount)}</span>
              </div>
            )}

            {hasSurcharge && (
              <div className="flex justify-between items-center text-amber-600">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd"/>
                  </svg>
                  Alta temporada (+{((seasonMultiplier - 1) * 100).toFixed(0)}%)
                </span>
                <span>+{formatCurrency(baseAmount * (seasonMultiplier - 1))}</span>
              </div>
            )}

            <div className="border-t pt-3"></div>
          </>
        )}

        <div className="flex justify-between items-center font-semibold text-lg">
          <span>Valor total</span>
          <span>{formatCurrency(amount)}</span>
        </div>

        <div className="border-t pt-3 mt-3"></div>

        <div className="bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-blue-900">Depósito inicial</p>
              <p className="text-sm text-blue-700">
                {depositPercentage.toFixed(0)}% do valor total
              </p>
            </div>
            <span className="text-xl font-bold text-blue-900">
              {formatCurrency(depositAmount)}
            </span>
          </div>

          <div className="text-xs text-blue-700 space-y-1">
            <p>• Pague agora para confirmar sua reserva</p>
            <p>• Reembolsável conforme política de cancelamento</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">Saldo restante</p>
              <p className="text-sm text-gray-600">
                {(100 - depositPercentage).toFixed(0)}% do valor total
              </p>
            </div>
            <span className="text-xl font-bold text-gray-900">
              {formatCurrency(remainingAmount)}
            </span>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p>• Será cobrado 7 dias antes do check-in</p>
            <p>• Mesmo cartão usado no depósito</p>
          </div>
        </div>

        <div className="border-t pt-3 mt-3"></div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          <span>Pagamento 100% seguro e criptografado</span>
        </div>
      </div>
    </Card>
  );
}
