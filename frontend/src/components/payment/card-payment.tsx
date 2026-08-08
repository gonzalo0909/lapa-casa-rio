// lapa-casa-hostel/frontend/src/components/payment/card-payment.tsx

'use client';

import React, { useState } from 'react';
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import { paymentAPI, handleAPIError } from '@/lib/api';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Alert } from '../ui/alert';

/**
 * CardPayment Component
 *
 * El payment intent (clientSecret) ya viene creado por el padre via
 * POST /payments/deposit -- este componente solo confirma la tarjeta
 * contra Stripe con ese clientSecret y, si sale bien, avisa al backend
 * con POST /payments/confirm (mismo endpoint que confirm-payment.ts).
 *
 * @component
 */
interface CardPaymentProps {
  paymentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  onSuccess: (paymentData: { paymentId: string; amount: number; currency: string }) => void;
  onError: (error: Error) => void;
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

export function CardPayment({ paymentId, clientSecret, amount, currency, locale = 'pt', onSuccess, onError }: CardPaymentProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState('');
  const [cardErrors, setCardErrors] = useState({
    cardNumber: '',
    cardExpiry: '',
    cardCvc: ''
  });

  const handleCardChange = (field: string) => (event: { error?: { message: string } }) => {
    setCardErrors((prev) => ({ ...prev, [field]: event.error?.message || '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!cardholderName.trim()) {
      setError(T('errorName', locale));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const cardElement = elements.getElement(CardNumberElement);
      if (!cardElement) {
        throw new Error(T('errorCardElement', locale));
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: cardholderName }
        }
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        await paymentAPI.confirm(paymentId);
        onSuccess({ paymentId, amount, currency });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : handleAPIError(err, locale);
      setError(message);
      onError(err instanceof Error ? err : new Error(message));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cardholder-name" className="block text-sm font-medium text-gray-700 mb-2">
          {T('cardholderName', locale)}
        </label>
        <input
          id="cardholder-name"
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder={T('cardholderPlaceholder', locale)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isProcessing}
          required
          aria-required="true"
        />
      </div>

      <div>
        <label htmlFor="card-number" className="block text-sm font-medium text-gray-700 mb-2">
          {T('cardNumber', locale)}
        </label>
        <div className="px-4 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <CardNumberElement id="card-number" options={CARD_ELEMENT_OPTIONS} onChange={handleCardChange('cardNumber')} />
        </div>
        {cardErrors.cardNumber && <p className="mt-1 text-sm text-red-600" role="alert">{cardErrors.cardNumber}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="card-expiry" className="block text-sm font-medium text-gray-700 mb-2">
            {T('expiry', locale)}
          </label>
          <div className="px-4 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <CardExpiryElement id="card-expiry" options={CARD_ELEMENT_OPTIONS} onChange={handleCardChange('cardExpiry')} />
          </div>
          {cardErrors.cardExpiry && <p className="mt-1 text-sm text-red-600" role="alert">{cardErrors.cardExpiry}</p>}
        </div>

        <div>
          <label htmlFor="card-cvc" className="block text-sm font-medium text-gray-700 mb-2">
            {T('cvc', locale)}
          </label>
          <div className="px-4 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
            <CardCvcElement id="card-cvc" options={CARD_ELEMENT_OPTIONS} onChange={handleCardChange('cardCvc')} />
          </div>
          {cardErrors.cardCvc && <p className="mt-1 text-sm text-red-600" role="alert">{cardErrors.cardCvc}</p>}
        </div>
      </div>

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      <Button type="submit" disabled={!stripe || isProcessing} className="w-full" size="lg">
        {isProcessing ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            {T('processing', locale)}
          </>
        ) : (
          `${T('pay', locale)} ${currency} ${amount.toFixed(2)}`
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 pt-2">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span>{T('secure', locale)}</span>
      </div>
    </form>
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      cardholderName: 'Nome do Titular',
      cardholderPlaceholder: 'Nome como está no cartão',
      cardNumber: 'Número do Cartão',
      expiry: 'Validade',
      cvc: 'CVV',
      processing: 'Processando...',
      pay: 'Pagar',
      secure: 'Pagamento seguro PCI-DSS',
      errorName: 'Informe o nome do titular do cartão',
      errorCardElement: 'Elemento de cartão não encontrado'
    },
    es: {
      cardholderName: 'Nombre del Titular',
      cardholderPlaceholder: 'Nombre como figura en la tarjeta',
      cardNumber: 'Número de Tarjeta',
      expiry: 'Vencimiento',
      cvc: 'CVV',
      processing: 'Procesando...',
      pay: 'Pagar',
      secure: 'Pago seguro PCI-DSS',
      errorName: 'Ingresá el nombre del titular de la tarjeta',
      errorCardElement: 'No se encontró el campo de tarjeta'
    },
    en: {
      cardholderName: 'Cardholder Name',
      cardholderPlaceholder: 'Name as it appears on card',
      cardNumber: 'Card Number',
      expiry: 'Expiry',
      cvc: 'CVC',
      processing: 'Processing...',
      pay: 'Pay',
      secure: 'PCI-DSS secure payment',
      errorName: 'Please enter the cardholder name',
      errorCardElement: 'Card field not found'
    },
    fr: {
      cardholderName: 'Nom du Titulaire',
      cardholderPlaceholder: 'Nom tel qu’il figure sur la carte',
      cardNumber: 'Numéro de Carte',
      expiry: 'Expiration',
      cvc: 'CVV',
      processing: 'Traitement...',
      pay: 'Payer',
      secure: 'Paiement sécurisé PCI-DSS',
      errorName: 'Indiquez le nom du titulaire de la carte',
      errorCardElement: 'Champ de carte introuvable'
    },
    de: {
      cardholderName: 'Name des Karteninhabers',
      cardholderPlaceholder: 'Name wie auf der Karte',
      cardNumber: 'Kartennummer',
      expiry: 'Ablaufdatum',
      cvc: 'CVV',
      processing: 'Verarbeitung...',
      pay: 'Zahlen',
      secure: 'PCI-DSS sichere Zahlung',
      errorName: 'Bitte geben Sie den Namen des Karteninhabers ein',
      errorCardElement: 'Kartenfeld nicht gefunden'
    }
  };
  return t[locale]?.[key] || key;
}
