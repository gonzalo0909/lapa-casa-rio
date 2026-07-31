// lapa-casa-hostel/frontend/src/components/payment/deposit-info.tsx

'use client';

import React, { useMemo } from 'react';
import { Alert } from '../ui/alert';

interface DepositInfoProps {
  depositAmount: number;
  remainingAmount: number;
  checkInDate: string;
  currency: string;
}

export function DepositInfo({
  depositAmount,
  remainingAmount,
  checkInDate,
  currency
}: DepositInfoProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency === 'BRL' ? 'BRL' : 'USD'
    }).format(value);
  };

  const remainingPaymentDate = useMemo(() => {
    const checkIn = new Date(checkInDate);
    const paymentDate = new Date(checkIn);
    paymentDate.setDate(checkIn.getDate() - 7);
    
    return paymentDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }, [checkInDate]);

  const daysUntilCheckIn = useMemo(() => {
    const checkIn = new Date(checkInDate);
    const today = new Date();
    const diffTime = checkIn.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [checkInDate]);

  const isLongStay = daysUntilCheckIn > 30;

  return (
    <div className="space-y-4">
      <Alert variant="info">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 mb-2">
                Sistema de Pagamento em 2 Etapas
              </h4>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <div>
                    <p className="font-medium">Depósito agora: {formatCurrency(depositAmount)}</p>
                    <p className="text-blue-700">Confirma sua reserva imediatamente</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <div>
                    <p className="font-medium">Saldo em {remainingPaymentDate}: {formatCurrency(remainingAmount)}</p>
                    <p className="text-blue-700">Cobrança automática 7 dias antes do check-in</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isLongStay && (
            <div className="bg-blue-100 rounded-lg p-3 mt-3">
              <p className="text-sm text-blue-900">
                <strong>Reserva antecipada:</strong> Como seu check-in é em {daysUntilCheckIn} dias, 
                você tem mais tempo para se planejar. O saldo restante será cobrado automaticamente 
                uma semana antes da sua chegada.
              </p>
            </div>
          )}
        </div>
      </Alert>

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="bg-green-100 rounded-full p-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-green-900 mb-2">Garantias e Segurança</h4>
            <ul className="space-y-1 text-sm text-green-800">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Confirmação instantânea da reserva
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Política de cancelamento flexível
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Proteção contra fraudes
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Dados criptografados e seguros
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          Perguntas Frequentes
        </h4>
        <div className="space-y-3 text-sm">
          <details className="group">
            <summary className="cursor-pointer font-medium text-gray-900 hover:text-blue-600 transition-colors">
              O que acontece se eu cancelar?
            </summary>
            <p className="mt-2 text-gray-600 pl-4">
              Cancelamentos com mais de 7 dias de antecedência recebem reembolso total do depósito. 
              Para cancelamentos mais próximos da data, consulte nossa política completa.
            </p>
          </details>

          <details className="group">
            <summary className="cursor-pointer font-medium text-gray-900 hover:text-blue-600 transition-colors">
              Posso alterar a forma de pagamento do saldo?
            </summary>
            <p className="mt-2 text-gray-600 pl-4">
              Sim! Você pode atualizar os dados de pagamento até 10 dias antes do check-in através 
              do link que enviaremos por email.
            </p>
          </details>

          <details className="group">
            <summary className="cursor-pointer font-medium text-gray-900 hover:text-blue-600 transition-colors">
              O que acontece se o pagamento do saldo falhar?
            </summary>
            <p className="mt-2 text-gray-600 pl-4">
              Tentaremos processar novamente automaticamente. Se persistir, entraremos em contato 
              para regularizar antes do check-in. Sua reserva permanece garantida durante este período.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
