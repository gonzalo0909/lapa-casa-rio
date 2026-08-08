// lapa-casa-hostel/frontend/src/components/payment/payment-processor.tsx

'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { CardPayment } from './card-payment';
import { PixPayment } from './pix-payment';
import { PaymentBreakdown } from './payment-breakdown';
import { DepositInfo } from './deposit-info';
import { paymentAPI, handleAPIError } from '@/lib/api';
import { Alert } from '../ui/alert';
import { LoadingSpinner } from '../ui/loading-spinner';

/**
 * PaymentProcessor Component
 *
 * Orquesta el pago del depósito real: el huésped elige tarjeta (Stripe)
 * o PIX (Mercado Pago), se crea el intent con POST /payments/deposit
 * (una sola vez por elección) y se renderiza el componente que
 * corresponde con los datos reales que devolvió el backend.
 *
 * @component
 */
interface PaymentProcessorProps {
  reservationId: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  checkInDate: string;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  onSuccess: (data: { paymentId: string; amount: number }) => void;
}

type PaymentMethod = 'card' | 'pix' | null;

interface DepositIntent {
  paymentId: string;
  clientSecret?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  provider: 'stripe' | 'mercadopago';
  /** Monto real que se cobra -- con tarjeta incluye el recargo por comisión de Stripe (ver process-deposit.ts), con PIX es igual al depósito base. Nunca mostrar depositAmount en el botón de pago: tiene que coincidir con lo que de verdad se cobra. */
  amount: number;
  cardSurchargePercent: number;
}

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export function PaymentProcessor({
  reservationId,
  totalAmount,
  depositAmount,
  remainingAmount,
  checkInDate,
  locale = 'pt',
  onSuccess
}: PaymentProcessorProps) {
  const [method, setMethod] = useState<PaymentMethod>(null);
  const [intent, setIntent] = useState<DepositIntent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectMethod = async (selected: 'card' | 'pix') => {
    setMethod(selected);
    setError(null);

    if (intent && intent.provider === (selected === 'card' ? 'stripe' : 'mercadopago')) {
      return;
    }

    setIsCreating(true);
    try {
      const provider = selected === 'card' ? 'stripe' : 'mercadopago';
      const response = await paymentAPI.processDeposit(reservationId, provider);
      const payment = response.data.payment;
      setIntent({
        paymentId: payment.paymentId,
        clientSecret: payment.clientSecret,
        qrCode: payment.qrCode,
        qrCodeBase64: payment.qrCodeBase64,
        provider,
        amount: payment.amount ?? depositAmount,
        cardSurchargePercent: payment.cardSurchargePercent ?? 0
      });
    } catch (err) {
      // No se deselecciona el método al fallar: si lo hiciéramos, ninguno
      // de los dos botones queda marcado y el huésped no sabe qué tocó ni
      // qué reintentar -- se deja marcado y "Reintentar" vuelve a llamar
      // a handleSelectMethod con el mismo método.
      setError(handleAPIError(err, locale));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <DepositInfo depositAmount={depositAmount} remainingAmount={remainingAmount} checkInDate={checkInDate} currency="BRL" locale={locale} />
      <PaymentBreakdown amount={totalAmount} depositAmount={depositAmount} remainingAmount={remainingAmount} currency="BRL" locale={locale} />

      {error && (
        <Alert variant="danger" role="alert">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            {method && (
              <button
                type="button"
                onClick={() => handleSelectMethod(method)}
                className="text-sm font-semibold underline whitespace-nowrap"
              >
                {T('retry', locale)}
              </button>
            )}
          </div>
        </Alert>
      )}

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">{T('methodTitle', locale)}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => handleSelectMethod('card')}
            className={`p-4 border-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              method === 'card' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            aria-pressed={method === 'card'}
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900">{T('card', locale)}</p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMethod('pix')}
            className={`p-4 border-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              method === 'pix' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            aria-pressed={method === 'pix'}
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900">PIX</p>
            <p className="text-sm text-gray-500">{T('pixInstant', locale)}</p>
          </button>
        </div>

        {isCreating && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {!isCreating && method === 'card' && intent?.clientSecret && (
          stripePromise ? (
            <>
              {intent.cardSurchargePercent > 0 && (
                <p className="text-xs text-gray-600 mb-3">
                  {T('surchargeNote', locale).replace('{pct}', intent.cardSurchargePercent.toString())}
                </p>
              )}
              <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret }}>
                <CardPayment
                  paymentId={intent.paymentId}
                  clientSecret={intent.clientSecret}
                  amount={intent.amount}
                  currency="BRL"
                  locale={locale}
                  onSuccess={onSuccess}
                  onError={(err) => setError(err.message)}
                />
              </Elements>
            </>
          ) : (
            <Alert variant="danger">{T('stripeMisconfigured', locale)}</Alert>
          )
        )}

        {!isCreating && method === 'pix' && intent?.qrCode && (
          <PixPayment
            paymentId={intent.paymentId}
            qrCode={intent.qrCode}
            qrCodeBase64={intent.qrCodeBase64}
            amount={intent.amount}
            locale={locale}
            onSuccess={onSuccess}
            onError={(err) => setError(err.message)}
          />
        )}

        {!method && (
          <div className="text-center py-8 text-gray-500">
            <p>{T('selectPrompt', locale)}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <span>{T('sslNote', locale)}</span>
        </div>
      </div>
    </div>
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      methodTitle: 'Método de Pagamento',
      card: 'Cartão de Crédito',
      pixInstant: 'Aprovação imediata',
      selectPrompt: 'Selecione um método de pagamento acima',
      sslNote: 'Conexão segura SSL/TLS',
      stripeMisconfigured: 'Pagamento com cartão indisponível no momento. Tente PIX ou fale conosco.',
      retry: 'Tentar novamente',
      surchargeNote: 'O total já inclui um recargo de {pct}% pela comissão do pagamento com cartão. Via PIX não há esse recargo.'
    },
    es: {
      methodTitle: 'Método de Pago',
      card: 'Tarjeta de Crédito',
      pixInstant: 'Aprobación inmediata',
      selectPrompt: 'Seleccioná un método de pago arriba',
      sslNote: 'Conexión segura SSL/TLS',
      stripeMisconfigured: 'El pago con tarjeta no está disponible en este momento. Probá con PIX o contactanos.',
      retry: 'Reintentar',
      surchargeNote: 'El total ya incluye un recargo del {pct}% por la comisión del pago con tarjeta. Por PIX no aplica ese recargo.'
    },
    en: {
      methodTitle: 'Payment Method',
      card: 'Credit Card',
      pixInstant: 'Instant approval',
      selectPrompt: 'Select a payment method above',
      sslNote: 'Secure SSL/TLS connection',
      stripeMisconfigured: 'Card payment is unavailable right now. Try PIX or contact us.',
      retry: 'Retry',
      surchargeNote: 'The total already includes a {pct}% surcharge for the card payment fee. Paying via PIX has no surcharge.'
    },
    fr: {
      methodTitle: 'Mode de Paiement',
      card: 'Carte de Crédit',
      pixInstant: 'Approbation immédiate',
      selectPrompt: 'Sélectionnez un mode de paiement ci-dessus',
      sslNote: 'Connexion sécurisée SSL/TLS',
      stripeMisconfigured: 'Le paiement par carte est indisponible pour le moment. Essayez PIX ou contactez-nous.',
      retry: 'Réessayer',
      surchargeNote: 'Le total inclut déjà des frais de {pct}% pour la commission du paiement par carte. Via PIX, ces frais ne s\'appliquent pas.'
    },
    de: {
      methodTitle: 'Zahlungsmethode',
      card: 'Kreditkarte',
      pixInstant: 'Sofortige Genehmigung',
      selectPrompt: 'Wählen Sie oben eine Zahlungsmethode',
      sslNote: 'Sichere SSL/TLS-Verbindung',
      stripeMisconfigured: 'Kartenzahlung ist momentan nicht verfügbar. Versuchen Sie PIX oder kontaktieren Sie uns.',
      retry: 'Erneut versuchen',
      surchargeNote: 'Der Gesamtbetrag enthält bereits einen Aufschlag von {pct}% für die Kartenzahlungsgebühr. Bei PIX entfällt dieser Aufschlag.'
    }
  };
  return t[locale]?.[key] || key;
}
