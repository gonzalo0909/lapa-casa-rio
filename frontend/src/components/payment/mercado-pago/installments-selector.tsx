// lapa-casa-hostel-frontend/src/components/payment/mercado-pago/installments-selector.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { Clock, Calculator, TrendingDown, CheckCircle } from 'lucide-react';

interface InstallmentsSelectorProps {
  amount: number;
  currency: string;
  onInstallmentsChange: (installments: number) => void;
  className?: string;
}

interface InstallmentOption {
  installments: number;
  installmentAmount: number;
  totalAmount: number;
  interestRate: number;
  isRecommended?: boolean;
}

const InstallmentsSelector: React.FC<InstallmentsSelectorProps> = ({
  amount,
  currency,
  onInstallmentsChange,
  className
}) => {
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const [installmentOptions, setInstallmentOptions] = useState<InstallmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Generate installment options
  useEffect(() => {
    const generateOptions = async () => {
      setIsLoading(true);
      
      try {
        // For Mercado Pago, typically 1-12 installments with no interest for most cards
        const options: InstallmentOption[] = [];
        
        for (let i = 1; i <= 12; i++) {
          let interestRate = 0;
          let totalAmount = amount;
          
          // Usually first 12 installments are interest-free in Brazil
          // But can vary by card issuer and amount
          if (i > 12) {
            interestRate = 0.0299; // 2.99% per month typical
            totalAmount = amount * Math.pow(1 + interestRate, i);
          }
          
          const installmentAmount = totalAmount / i;
          
          options.push({
            installments: i,
            installmentAmount,
            totalAmount,
            interestRate: interestRate * 100,
            isRecommended: i === 3 || i === 6 // Common choices
          });
        }
        
        setInstallmentOptions(options);
      } catch (error) {
        console.error('Error generating installment options:', error);
        // Fallback to basic options
        const fallbackOptions = [1, 2, 3, 4, 5, 6, 10, 12].map(i => ({
          installments: i,
          installmentAmount: amount / i,
          totalAmount: amount,
          interestRate: 0
        }));
        setInstallmentOptions(fallbackOptions);
      } finally {
        setIsLoading(false);
      }
    };

    if (amount > 0) {
      generateOptions();
    }
  }, [amount]);

  // Handle installments selection
  const handleInstallmentsChange = (installments: string) => {
    const numInstallments = parseInt(installments);
    setSelectedInstallments(numInstallments);
    onInstallmentsChange(numInstallments);
  };

  // Get savings compared to maximum installments
  const getSavings = (option: InstallmentOption) => {
    const maxOption = installmentOptions[installmentOptions.length - 1];
    if (!maxOption || option.totalAmount >= maxOption.totalAmount) return 0;
    return maxOption.totalAmount - option.totalAmount;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin" />
            <span>Calculando opciones de pago...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Opciones de Parcelamiento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={selectedInstallments.toString()}
          onValueChange={handleInstallmentsChange}
          className="space-y-2"
        >
          {installmentOptions.map((option) => {
            const savings = getSavings(option);
            
            return (
              <div
                key={option.installments}
                className={`relative p-4 border rounded-lg transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  selectedInstallments === option.installments
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-gray-200'
                } ${option.isRecommended ? 'ring-2 ring-green-200 dark:ring-green-800' : ''}`}
                onClick={() => handleInstallmentsChange(option.installments.toString())}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value={option.installments.toString()}
                    id={`installment-${option.installments}`}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={`installment-${option.installments}`}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <span className="font-medium">
                        {option.installments}x de {formatCurrency(option.installmentAmount)}
                      </span>
                      
                      {option.isRecommended && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          Recomendado
                        </Badge>
                      )}
                      
                      {option.interestRate === 0 && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Sin interés
                        </Badge>
                      )}
                    </Label>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Total: {formatCurrency(option.totalAmount)}</span>
                      
                      {option.interestRate > 0 && (
                        <span className="text-orange-600">
                          Interés: {option.interestRate.toFixed(2)}% a.m.
                        </span>
                      )}
                      
                      {savings > 0 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <TrendingDown className="w-3 h-3" />
                          <span>Ahorra {formatCurrency(savings)}</span>
                        </div>
                      )}
                    </div>
                    
                    {option.installments === 1 && (
                      <p className="text-xs text-gray-500">
                        Pago inmediato - Confirmación instantánea
                      </p>
                    )}
                    
                    {option.installments > 1 && option.interestRate === 0 && (
                      <p className="text-xs text-gray-500">
                        Primera cuota hoy, siguientes cada 30 días
                      </p>
                    )}
                  </div>
                  
                  {selectedInstallments === option.installments && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </div>
            );
          })}
        </RadioGroup>

        {/* Selected Option Summary */}
        {selectedInstallments > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
              Opción Seleccionada
            </h4>
            <div className="space-y-1 text-sm">
              {selectedInstallments === 1 ? (
                <p className="text-blue-700 dark:text-blue-200">
                  <strong>Pago único:</strong> {formatCurrency(amount)}
                </p>
              ) : (
                <>
                  <p className="text-blue-700 dark:text-blue-200">
                    <strong>Cuotas:</strong> {selectedInstallments}x de{' '}
                    {formatCurrency(amount / selectedInstallments)}
                  </p>
                  <p className="text-blue-700 dark:text-blue-200">
                    <strong>Total:</strong> {formatCurrency(amount)}
                  </p>
                  <p className="text-blue-700 dark:text-blue-200">
                    <strong>Primera cuota:</strong> Hoy
                  </p>
                  <p className="text-blue-700 dark:text-blue-200">
                    <strong>Siguientes cuotas:</strong> Cada 30 días
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Benefits Notice */}
        <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 rounded-lg">
          <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              Parcelamiento sin interés hasta 12x
            </span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Disponible para la mayoría de tarjetas de crédito brasileñas
          </p>
        </div>

        {/* Payment Schedule Preview */}
        {selectedInstallments > 1 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Cronograma de Pagos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {Array.from({ length: Math.min(selectedInstallments, 3) }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() + i);
                  
                  return (
                    <div key={i} className="flex justify-between">
                      <span>
                        {i + 1}ª cuota ({date.toLocaleDateString('pt-BR', { 
                          month: 'short', 
                          year: 'numeric' 
                        })}):
                      </span>
                      <span className="font-medium">
                        {formatCurrency(amount / selectedInstallments)}
                      </span>
                    </div>
                  );
                })}
                
                {selectedInstallments > 3 && (
                  <div className="flex justify-between text-gray-500">
                    <span>... y {selectedInstallments - 3} cuotas más</span>
                    <span>
                      {formatCurrency((amount / selectedInstallments) * (selectedInstallments - 3))}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Important Notes */}
        <div className="text-xs text-gray-600 space-y-1">
          <p>• Las cuotas son cobradas automáticamente en tu tarjeta</p>
          <p>• En caso de rechazo, intentaremos nuevamente por 3 días</p>
          <p>• Puedes cambiar la tarjeta de cobro contactando soporte</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default InstallmentsSelector;
