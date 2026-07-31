// lapa-casa-hostel/frontend/src/components/payment/card-payment.tsx

'use client';

import React, { useState } from 'react';
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import { InstallmentsSelector } from './installments-selector';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Alert } from '../ui/alert';

interface CardPaymentProps {
  bookingId: string;
  amount: number;
  currency: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: 'system-ui, sans-serif',
      '::placeholder': {
        color: '#9ca3af'
      }
    },
    invalid: {
      color: '#dc2626',
      iconColor: '#dc2626'
    }
  }
};

export function CardPayment({ bookingId, amount, currency, onSuccess, onError }: CardPaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState('');
  const [installments, setInstallments] = useState(1);
  const [cardErrors, setCardErrors] = useState({
    cardNumber: '',
    cardExpiry: '',
    cardCvc: ''
  });

  const handleCardChange = (field: string) => (event: any) => {
    if (event.error) {
      setCardErrors(prev => ({
        ...prev,
        [field]: event.error.message
      }));
    } else {
      setCardErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!cardholderName.trim()) {
      setError('Por favor, informe o nome do titular do cartão');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          amount,
          currency,
          installments
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao criar intenção de pagamento');
      }

      const { clientSecret, paymentIntentId } = await response.json();

      const cardElement = elements.getElement(CardNumberElement);
      
      if (!cardElement) {
        throw new Error('Elemento de cartão não encontrado');
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: cardholderName
          }
        }
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess({
          paymentId: paymentIntent.id,
          transactionId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
          status: 'succeeded',
          installments
        });
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento');
      onError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cardholder-name" className="block text-sm font-medium text-gray-700 mb-2">
          Nome do Titular
        </label>
        <input
          id="cardholder-name"
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="Nome como está no cartão"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isProcessing}
          required
          aria-required="true"
        />
      </div>

      <div>
        <label htmlFor="card-number" className="block text-sm font-medium text-gray-700 mb-2">
          Número do Cartão
        </label>
        <div className="px-4 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <CardNumberElement
            id="card-number"
            options={CARD_ELEMENT_OPTIONS}
            onChange={handleCardChange('cardNumber')}
          />
        </div>
        {cardErrors.cardNumber && (
          <p className="mt-1 text-sm text-red-600" role="alert">{cardErrors.cardNumber}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="card-expiry" className="block text-sm font-medium text-gray-700 mb-2">
            Validade
          </label>
          <div className="px-4 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <CardExpiryElement
              id="card-expiry"
              options={CARD_ELEMENT_OPTIONS}
              onChange={handleCardChange('cardExpiry')}
            />
          </div>
          {cardErrors.cardExpiry && (
            <p className="mt-1 text-sm text-red-600" role="alert">{cardErrors.cardExpiry}</p>
          )}
        </div>

        <div>
          <label htmlFor="card-cvc" className="block text-sm font-medium text-gray-700 mb-2">
            CVV
          </label>
          <div className="px-4 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <CardCvcElement
              id="card-cvc"
              options={CARD_ELEMENT_OPTIONS}
              onChange={handleCardChange('cardCvc')}
            />
          </div>
          {cardErrors.cardCvc && (
            <p className="mt-1 text-sm text-red-600" role="alert">{cardErrors.cardCvc}</p>
          )}
        </div>
      </div>

      {currency === 'BRL' && (
        <InstallmentsSelector
          amount={amount}
          onInstallmentsChange={setInstallments}
          disabled={isProcessing}
        />
      )}

      {error && (
        <Alert variant="destructive" role="alert">
          {error}
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Processando...
          </>
        ) : (
          `Pagar ${currency} ${amount.toFixed(2)}`
        )}
      </Button>

      <div className="flex items-center justify-center gap-4 pt-4">
        <img src="/stripe-badge.svg" alt="Secured by Stripe" className="h-8" />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          <span>Pagamento seguro PCI-DSS</span>
        </div>
      </div>
    </form>
  );
}
