// lapa-casa-hostel/frontend/src/components/payment/payment-processor.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { initMercadoPago } from '@mercadopago/sdk-react';
import { CardPayment } from './card-payment';
import { PixPayment } from './pix-payment';
import { PaymentBreakdown } from './payment-breakdown';
import { DepositInfo } from './deposit-info';
import { Alert } from '../ui/alert';
import { LoadingSpinner } from '../ui/loading-spinner';
import { usePaymentStore } from '@/stores/payment-store';

/**
 * PaymentProcessor Component
 * 
 * Main payment orchestrator handling Stripe and Mercado Pago integrations.
 * Manages payment method selection, initialization, and processing flow.
 * 
 * Features:
 * - Multi-gateway support (Stripe + Mercado Pago)
 * - PIX and credit card payments
 * - Deposit + remaining balance handling
 * - Multi-currency support (BRL/USD)
 * - PCI-compliant iframe integration
 * - Real-time payment status tracking
 * - Automatic gateway selection based on currency
 * - Error handling and retry logic
 * 
 * @component
 * @example
 * ```tsx
 * <PaymentProcessor
 *   bookingId="bk_123"
 *   amount={1500.00}
 *   currency="BRL"
 *   depositAmount={450.00}
 *   remainingAmount={1050.00}
 *   guestEmail="guest@example.com"
 *   guestName="João Silva"
 *   checkInDate="2025-12-01"
 *   onSuccess={(data) => console.log('Payment successful', data)}
 *   onError={(error) => console.error('Payment failed', error)}
 * />
 * ```
 */

interface PaymentProcessorProps {
  bookingId: string;
  amount: number;
  currency: 'BRL' | 'USD';
  depositAmount: number;
  remainingAmount: number;
  guestEmail: string;
  guestName: string;
  checkInDate: string;
  onSuccess: (paymentData: PaymentSuccessData) => void;
  onError: (error: PaymentError) => void;
  onCancel?: () => void;
}

interface PaymentSuccessData {
  paymentId: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  installments?: number;
}

interface PaymentError {
  code: string;
  message: string;
  details?: any;
}

type PaymentMethod = 'credit_card' | 'pix' | null;
type PaymentGateway = 'stripe' | 'mercadopago';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function PaymentProcessor({
  bookingId,
  amount,
  currency,
  depositAmount,
  remainingAmount,
  guestEmail,
  guestName,
  checkInDate,
  onSuccess,
  onError,
  onCancel
}: PaymentProcessorProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [gateway, setGateway] = useState<PaymentGateway>('stripe');
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { setPaymentData, clearPaymentData } = usePaymentStore();

  useEffect(() => {
    const initializePaymentGateways = async () => {
      try {
        if (currency === 'BRL') {
          await initMercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY!, {
            locale: 'pt-BR'
          });
          setGateway('mercadopago');
        } else {
          setGateway('stripe');
        }
        setIsInitialized(true);
      } catch (err) {
        console.error('Error initializing payment gateway:', err);
        setError('Erro ao inicializar sistema de pagamento');
        setIsInitialized(true);
      }
    };

    initializePaymentGateways();
  }, [currency]);

  useEffect(() => {
    setPaymentData({
      bookingId,
      amount,
      currency,
      depositAmount,
      remainingAmount,
      guestEmail,
      guestName,
      checkInDate
    });

    return () => clearPaymentData();
  }, [bookingId, amount, currency, depositAmount, remainingAmount, guestEmail, guestName, checkInDate]);

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setError(null);
  };

  const handlePaymentSuccess = (paymentData: PaymentSuccessData) => {
    setIsProcessing(false);
    onSuccess(paymentData);
  };

  const handlePaymentError = (err: any) => {
    setIsProcessing(false);
    const errorMessage = err.message || 'Erro ao processar pagamento';
    setError(errorMessage);
    
    onError({
      code: err.code || 'PAYMENT_ERROR',
      message: errorMessage,
      details: err
    });
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Inicializando sistema de pagamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <DepositInfo
        depositAmount={depositAmount}
        remainingAmount={remainingAmount}
        checkInDate={checkInDate}
        currency={currency}
      />

      <PaymentBreakdown
        amount={amount}
        depositAmount={depositAmount}
        remainingAmount={remainingAmount}
        currency={currency}
      />

      {error && (
        <Alert variant="destructive" role="alert">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-medium">Erro no pagamento</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </Alert>
      )}

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Método de Pagamento</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => handlePaymentMethodSelect('credit_card')}
            className={`p-4 border-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              paymentMethod === 'credit_card'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            aria-pressed={paymentMethod === 'credit_card'}
            aria-label="Selecionar pagamento com cartão de crédito"
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-8 h-8 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
              </svg>
            </div>
            <p className="font-medium text-gray-900">Cartão de Crédito</p>
            <p className="text-sm text-gray-500">Parcelamento disponível</p>
          </button>

          {currency === 'BRL' && (
            <button
              type="button"
              onClick={() => handlePaymentMethodSelect('pix')}
              className={`p-4 border-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                paymentMethod === 'pix'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              aria-pressed={paymentMethod === 'pix'}
              aria-label="Selecionar pagamento com PIX"
            >
              <div className="flex items-center justify-center mb-2">
                <svg className="w-8 h-8 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                </svg>
              </div>
              <p className="font-medium text-gray-900">PIX</p>
              <p className="text-sm text-gray-500">Aprovação imediata</p>
            </button>
          )}
        </div>

        {paymentMethod === 'credit_card' && gateway === 'stripe' && (
          <Elements stripe={stripePromise}>
            <CardPayment
              bookingId={bookingId}
              amount={depositAmount}
              currency={currency}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </Elements>
        )}

        {paymentMethod === 'credit_card' && gateway === 'mercadopago' && (
          <CardPayment
            bookingId={bookingId}
            amount={depositAmount}
            currency={currency}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        )}

        {paymentMethod === 'pix' && currency === 'BRL' && (
          <PixPayment
            bookingId={bookingId}
            amount={depositAmount}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        )}

        {!paymentMethod && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
            </svg>
            <p>Selecione um método de pagamento acima</p>
          </div>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            disabled={isProcessing}
            aria-label="Cancelar processo de pagamento"
          >
            Cancelar
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          <span>Conexão segura SSL/TLS</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <span>PCI-DSS Compliant</span>
        </div>
      </div>
    </div>
  );
}
