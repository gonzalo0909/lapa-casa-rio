// lapa-casa-hostel/frontend/src/components/payment/installments-selector.tsx

'use client';

import React, { useState, useMemo } from 'react';
import { Select } from '../ui/select';

interface InstallmentsSelectorProps {
  amount: number;
  onInstallmentsChange: (installments: number) => void;
  disabled?: boolean;
  maxInstallments?: number;
  minInstallmentAmount?: number;
  interestRate?: number;
}

interface InstallmentOption {
  value: number;
  label: string;
  totalAmount: number;
  installmentAmount: number;
  hasInterest: boolean;
}

export function InstallmentsSelector({
  amount,
  onInstallmentsChange,
  disabled = false,
  maxInstallments = 12,
  minInstallmentAmount = 50,
  interestRate = 0.0299
}: InstallmentsSelectorProps) {
  const [selectedInstallments, setSelectedInstallments] = useState(1);

  const installmentOptions = useMemo(() => {
    const options: InstallmentOption[] = [];
    const maxPossibleInstallments = Math.min(
      maxInstallments,
      Math.floor(amount / minInstallmentAmount)
    );

    for (let i = 1; i <= maxPossibleInstallments; i++) {
      const hasInterest = i > 1;
      let totalAmount = amount;
      let installmentAmount = amount / i;

      if (hasInterest) {
        const monthlyRate = interestRate;
        const factor = Math.pow(1 + monthlyRate, i);
        installmentAmount = (amount * monthlyRate * factor) / (factor - 1);
        totalAmount = installmentAmount * i;
      }

      const label = hasInterest
        ? `${i}x de R$ ${installmentAmount.toFixed(2)} (Total: R$ ${totalAmount.toFixed(2)})`
        : `${i}x de R$ ${installmentAmount.toFixed(2)} sem juros`;

      options.push({
        value: i,
        label,
        totalAmount,
        installmentAmount,
        hasInterest
      });
    }

    return options;
  }, [amount, maxInstallments, minInstallmentAmount, interestRate]);

  const handleChange = (value: string) => {
    const installments = parseInt(value, 10);
    setSelectedInstallments(installments);
    onInstallmentsChange(installments);
  };

  const selectedOption = installmentOptions.find(
    opt => opt.value === selectedInstallments
  );

  return (
    <div className="space-y-3">
      <label htmlFor="installments" className="block text-sm font-medium text-gray-700">
        Parcelamento
      </label>

      <Select
        id="installments"
        value={selectedInstallments.toString()}
        onValueChange={handleChange}
        disabled={disabled}
        aria-label="Selecionar número de parcelas"
      >
        {installmentOptions.map((option) => (
          <option key={option.value} value={option.value.toString()}>
            {option.label}
          </option>
        ))}
      </Select>

      {selectedOption && selectedOption.hasInterest && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Parcelamento com juros
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Taxa de {(interestRate * 100).toFixed(2)}% ao mês aplicada
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedOption && !selectedOption.hasInterest && selectedInstallments === 1 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <p className="text-sm text-green-800">
              Pagamento à vista - Sem juros
            </p>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>• Parcelamento disponível apenas para cartão de crédito</p>
        <p>• Parcela mínima de R$ {minInstallmentAmount.toFixed(2)}</p>
      </div>
    </div>
  );
}
