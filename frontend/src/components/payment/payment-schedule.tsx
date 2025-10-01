// lapa-casa-hostel/frontend/src/components/payment/payment-schedule.tsx

'use client';

import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

interface PaymentScheduleProps {
  depositAmount: number;
  remainingAmount: number;
  currency: string;
  depositDate: string;
  remainingDate: string;
  checkInDate: string;
  depositStatus?: 'pending' | 'paid' | 'failed';
  remainingStatus?: 'pending' | 'paid' | 'scheduled' | 'failed';
}

export function PaymentSchedule({
  depositAmount,
  remainingAmount,
  currency,
  depositDate,
  remainingDate,
  checkInDate,
  depositStatus = 'pending',
  remainingStatus = 'pending'
}: PaymentScheduleProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency === 'BRL' ? 'BRL' : 'USD'
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: <Badge variant="warning">Pendente</Badge>,
      paid: <Badge variant="success">Pago</Badge>,
      scheduled: <Badge variant="info">Agendado</Badge>,
      failed: <Badge variant="destructive">Falhou</Badge>
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'paid') {
      return (
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
        </div>
      );
    }
    if (status === 'scheduled') {
      return (
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
          </svg>
        </div>
      );
    }
    if (status === 'failed') {
      return (
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
          </svg>
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
        </svg>
      </div>
    );
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">Cronograma de Pagamentos</h3>

      <div className="space-y-8">
        <div className="relative">
          <div className="flex items-start gap-4">
            {getStatusIcon(depositStatus)}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">Depósito Inicial</h4>
                {getStatusBadge(depositStatus)}
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {formatCurrency(depositAmount)}
              </p>
              <p className="text-sm text-gray-600">
                {depositStatus === 'paid' ? 'Pago em' : 'Vencimento em'} {formatDate(depositDate)}
              </p>
              {depositStatus === 'paid' && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    ✓ Pagamento confirmado. Sua reserva está garantida!
                  </p>
                </div>
              )}
              {depositStatus === 'failed' && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">
                    ✗ Pagamento falhou. Por favor, tente novamente ou use outro método.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200" 
               style={{ height: 'calc(100% + 2rem)' }}></div>
        </div>

        <div className="relative">
          <div className="flex items-start gap-4">
            {getStatusIcon(remainingStatus)}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">Saldo Restante</h4>
                {getStatusBadge(remainingStatus)}
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {formatCurrency(remainingAmount)}
              </p>
              <p className="text-sm text-gray-600">
                {remainingStatus === 'paid' ? 'Pago em' : 'Cobrança automática em'} {formatDate(remainingDate)}
              </p>
              {remainingStatus === 'scheduled' && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    ⓘ Cobrança agendada para 7 dias antes do check-in no mesmo cartão usado no depósito.
                  </p>
                </div>
              )}
              {remainingStatus === 'paid' && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    ✓ Pagamento total concluído. Aguardamos você!
                  </p>
                </div>
              )}
              {remainingStatus === 'failed' && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">
                    ✗ Não foi possível processar o pagamento. Entraremos em contato.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200" 
               style={{ height: 'calc(100% + 2rem)' }}></div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-1">Check-in</h4>
            <p className="text-lg font-medium text-gray-700">
              {formatDate(checkInDate)}
            </p>
            <p className="text-sm text-gray-600">
              Lapa Casa Hostel • Santa Teresa, Rio de Janeiro
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t">
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 mb-3">Informações Importantes</h5>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              O saldo restante será cobrado automaticamente no cartão usado no depósito
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              Você receberá lembretes por email antes de cada cobrança
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              Você pode atualizar os dados de pagamento até 10 dias antes do check-in
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              Cancelamentos com mais de 7 dias recebem reembolso total do depósito
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
