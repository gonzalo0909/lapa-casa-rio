// lapa-casa-hostel-frontend/src/components/payment/payment-processor.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { usePaymentStore } from '@/stores/payment-store';
import { useBookingStore } from '@/stores/booking-store';
import StripeElements from './stripe/stripe-elements';
import MPElements from './mercado-pago/mp-elements';
import PaymentSummary from './payment-summary/payment-breakdown';
import { CreditCard, Smartphone, Shield, Clock } from 'lucide-react';

interface PaymentProcessorProps {
  bookingId?: string;
  amount: number;
  currency: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  className?: string;
}

type PaymentMethod = 'stripe' | 'mercadopago';
type PaymentType = 'card' | 'pix' | 'installments';

const PaymentProcessor: React.FC<PaymentProcessorProps> = ({
  bookingId,
  amount,
  currency = 'BRL',
  onSuccess,
  onError,
  className
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('stripe');
  const [selectedType, setSelectedType] = useState<PaymentType>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [mpPreferenceId, setMpPreferenceId] = useState<string | null>(null);

  const { paymentStatus, createPaymentIntent, clearPaymentData } = usePaymentStore();
  const { bookingData } = useBookingStore();

  // Initialize payment intent
  useEffect(() => {
    const initializePayment = async () => {
      try {
        if (selectedMethod === 'stripe') {
          const result = await createPaymentIntent({
            amount,
            currency,
            paymentMethod: 'stripe',
            bookingId,
            metadata: {
              guestName: bookingData.guestName || '',
              guestEmail: bookingData.guestEmail || '',
              roomId: bookingData.roomId || '',
              bedsCount: bookingData.bedsCount?.toString() || '1'
            }
          });

          if (result.success) {
            setClientSecret(result.clientSecret);
          } else {
            onError(result.error || 'Error inicializando pago');
          }
        } else if (selectedMethod === 'mercadopago') {
          const result = await createPaymentIntent({
            amount,
            currency,
            paymentMethod: 'mercadopago',
            bookingId,
            metadata: {
              guestName: bookingData.guestName || '',
              guestEmail: bookingData.guestEmail || '',
              roomId: bookingData.roomId || '',
              bedsCount: bookingData.bedsCount?.toString() || '1'
            }
          });

          if (result.success) {
            setMpPreferenceId(result.preferenceId);
          } else {
            onError(result.error || 'Error inicializando pago');
          }
        }
      } catch (error) {
        console.error('Error initializing payment:', error);
        onError('Error inicializando método de pago');
      }
    };

    if (amount > 0) {
      initializePayment();
    }
  }, [selectedMethod, amount, currency, bookingId, createPaymentIntent, bookingData, onError]);

  // Handle payment method selection
  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setSelectedType('card'); // Reset to default type
    setClientSecret(null);
    setMpPreferenceId(null);
    clearPaymentData();
  };

  // Handle payment type selection
  const handleTypeChange = (type: PaymentType) => {
    setSelectedType(type);
  };

  // Handle payment success
  const handlePaymentSuccess = (paymentId: string) => {
    setIsProcessing(false);
    onSuccess(paymentId);
  };

  // Handle payment error
  const handlePaymentError = (error: string) => {
    setIsProcessing(false);
    onError(error);
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Payment Summary */}
      <PaymentSummary
        amount={amount}
        currency={currency}
        type="deposit"
        bookingData={bookingData}
      />

      {/* Payment Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Método de Pago
          </CardTitle>
          <CardDescription>
            Elige cómo prefieres pagar tu reserva
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Payment Method Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stripe Option */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedMethod === 'stripe'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleMethodChange('stripe')}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Tarjeta de Crédito/Débito</h3>
                <Badge variant={selectedMethod === 'stripe' ? 'default' : 'secondary'}>
                  Internacional
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Visa, Mastercard, American Express
              </p>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Shield className="w-4 h-4" />
                Procesamiento seguro con Stripe
              </div>
            </div>

            {/* Mercado Pago Option */}
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedMethod === 'mercadopago'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleMethodChange('mercadopago')}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Mercado Pago</h3>
                <Badge variant={selectedMethod === 'mercadopago' ? 'default' : 'secondary'}>
                  Brasil
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                PIX, Tarjeta, Parcelado hasta 12x
              </p>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Smartphone className="w-4 h-4" />
                Pago local optimizado
              </div>
            </div>
          </div>

          {/* Mercado Pago Payment Types */}
          {selectedMethod === 'mercadopago' && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Selecciona tipo de pago:</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  variant={selectedType === 'pix' ? 'default' : 'outline'}
                  onClick={() => handleTypeChange('pix')}
                  className="justify-start"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  PIX (Instantáneo)
                </Button>
                <Button
                  variant={selectedType === 'card' ? 'default' : 'outline'}
                  onClick={() => handleTypeChange('card')}
                  className="justify-start"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Tarjeta de Crédito
                </Button>
                <Button
                  variant={selectedType === 'installments' ? 'default' : 'outline'}
                  onClick={() => handleTypeChange('installments')}
                  className="justify-start"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Parcelado 12x
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Form */}
      {selectedMethod === 'stripe' && clientSecret && (
        <StripeElements
          clientSecret={clientSecret}
          amount={amount}
          currency={currency}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      )}

      {selectedMethod === 'mercadopago' && mpPreferenceId && (
        <MPElements
          preferenceId={mpPreferenceId}
          paymentType={selectedType}
          amount={amount}
          currency={currency}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      )}

      {/* Payment Status */}
      {paymentStatus.isProcessing && (
        <Alert>
          <LoadingSpinner className="w-4 h-4" />
          <AlertDescription>
            Procesando pago... Por favor espera.
          </AlertDescription>
        </Alert>
      )}

      {paymentStatus.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {paymentStatus.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Security Notice */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
        <Shield className="w-4 h-4" />
        <span>
          Todos los pagos son procesados de forma segura con encriptación SSL
        </span>
      </div>

      {/* Payment Information */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
        <CardContent className="p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Monto del depósito:</span>
              <span className="font-semibold">{formatCurrency(amount)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Saldo restante:</span>
              <span>{formatCurrency((bookingData.totalPrice || 0) - amount)}</span>
            </div>
            <div className="pt-2 border-t border-blue-200 flex justify-between">
              <span>Total de la reserva:</span>
              <span className="font-semibold">
                {formatCurrency(bookingData.totalPrice || amount)}
              </span>
            </div>
          </div>
          
          <Alert className="mt-4">
            <Clock className="w-4 h-4" />
            <AlertDescription>
              El saldo restante será cobrado automáticamente 7 días antes de tu check-in
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentProcessor;
