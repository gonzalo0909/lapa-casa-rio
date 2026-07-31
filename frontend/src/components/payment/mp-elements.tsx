// lapa-casa-hostel/frontend/src/components/payment/mp-elements.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { CardPayment as MPCardPayment } from '@mercadopago/sdk-react';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Alert } from '../ui/alert';

interface MercadoPagoElementsProps {
  bookingId: string;
  amount: number;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

export function MercadoPagoElements({
  bookingId,
  amount,
  onSuccess,
  onError
}: MercadoPagoElementsProps) {
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createPreference();
  }, [bookingId, amount]);

  const createPreference = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/mercadopago/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId,
          amount,
          items: [
            {
              title: `Depósito Reserva - ${bookingId}`,
              quantity: 1,
              unit_price: amount,
              currency_id: 'BRL'
            }
          ],
          back_urls: {
            success: `${window.location.origin}/booking/success`,
            failure: `${window.location.origin}/booking/failure`,
            pending: `${window.location.origin}/booking/pending`
          },
          auto_return: 'approved',
          notification_url: `${process.env.NEXT_PUBLIC_API_URL}/webhooks/mercadopago`,
          metadata: {
            bookingId
          }
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao criar preferência de pagamento');
      }

      const data = await response.json();
      setPreferenceId(data.preferenceId);
    } catch (err: any) {
      setError(err.message || 'Erro ao inicializar Mercado Pago');
      onError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    try {
      const response = await fetch('/api/payments/mercadopago/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId,
          ...formData
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao processar pagamento');
      }

      const result = await response.json();
      onSuccess(result);
    } catch (err: any) {
      onError(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        {error}
      </Alert>
    );
  }

  if (!preferenceId) {
    return null;
  }

  return (
    <div className="mercadopago-payment-wrapper">
      <MPCardPayment
        initialization={{
          amount,
          preferenceId
        }}
        customization={{
          visual: {
            style: {
              theme: 'default',
              customVariables: {
                baseColor: '#2563eb',
                textPrimaryColor: '#1f2937',
                textSecondaryColor: '#6b7280',
                inputBackgroundColor: '#ffffff',
                formBackgroundColor: '#f9fafb',
                borderRadiusSmall: '4px',
                borderRadiusMedium: '8px',
                borderRadiusLarge: '12px',
                fontSizeSmall: '14px',
                fontSizeMedium: '16px',
                fontSizeLarge: '18px'
              }
            }
          },
          paymentMethods: {
            maxInstallments: 12,
            minInstallments: 1,
            creditCard: 'all',
            debitCard: 'all'
          }
        }}
        onSubmit={handleSubmit}
        onReady={() => console.log('Mercado Pago ready')}
        onError={(error) => {
          console.error('Mercado Pago error:', error);
          onError(error);
        }}
      />

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
        </svg>
        <span>Pagamento seguro pelo Mercado Pago</span>
      </div>
    </div>
  );
}
