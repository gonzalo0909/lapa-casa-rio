// lapa-casa-hostel/frontend/src/components/payment/payment-intent.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Alert } from '../ui/alert';

interface PaymentIntentProps {
  bookingId: string;
  amount: number;
  currency: string;
  onIntentCreated: (clientSecret: string, paymentIntentId: string) => void;
  onError: (error: any) => void;
}

interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  status: string;
}

export function PaymentIntent({
  bookingId,
  amount,
  currency,
  onIntentCreated,
  onError
}: PaymentIntentProps) {
  const [isCreating, setIsCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    createPaymentIntent();
  }, [bookingId, amount, currency]);

  const createPaymentIntent = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId,
          amount: Math.round(amount * 100),
          currency: currency.toLowerCase(),
          metadata: {
            bookingId,
            source: 'web_booking_engine'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar intenção de pagamento');
      }

      const data: PaymentIntentResponse = await response.json();

      if (!data.clientSecret) {
        throw new Error('Client secret não retornado');
      }

      onIntentCreated(data.clientSecret, data.paymentIntentId);
      setIsCreating(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao inicializar pagamento';
      setError(errorMessage);
      onError(err);

      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          createPaymentIntent();
        }, 2000 * (retryCount + 1));
      } else {
        setIsCreating(false);
      }
    }
  };

  const handleRetry = () => {
    setRetryCount(0);
    createPaymentIntent();
  };

  if (isCreating) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Inicializando pagamento...</p>
        {retryCount > 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Tentativa {retryCount} de 3
          </p>
        )}
      </div>
    );
  }

  if (error && retryCount >= 3) {
    return (
      <div className="py-8">
        <Alert variant="destructive" role="alert">
          <div className="space-y-2">
            <p className="font-medium">Erro ao inicializar pagamento</p>
            <p className="text-sm">{error}</p>
          </div>
        </Alert>
        <button
          onClick={handleRetry}
          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return null;
}
