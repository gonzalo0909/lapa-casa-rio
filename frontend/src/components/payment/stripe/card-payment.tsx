// lapa-casa-hostel-frontend/src/components/payment/stripe/card-payment.tsx

'use client';

import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useBookingStore } from '@/stores/booking-store';
import { CreditCard, Shield, Lock } from 'lucide-react';

interface CardPaymentProps {
  clientSecret: string;
  amount: number;
  currency: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

const CardPayment: React.FC<CardPaymentProps> = ({
  clientSecret,
  amount,
  currency,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { bookingData } = useBookingStore();

  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [billingDetails, setBillingDetails] = useState({
    name: bookingData.guestName || '',
    email: bookingData.guestEmail || '',
    phone: bookingData.guestPhone || ''
  });

  // Card element options
  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        fontFamily: 'system-ui, sans-serif',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: true
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Handle card element changes
  const handleCardChange = (event: any) => {
    setCardComplete(event.complete);
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };

  // Handle billing details change
  const handleBillingChange = (field: string, value: string) => {
    setBillingDetails(prev => ({ ...prev, [field]: value }));
  };

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe no está disponible');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Elemento de tarjeta no encontrado');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Confirm payment with card
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: billingDetails.name,
              email: billingDetails.email,
              phone: billingDetails.phone,
            }
          }
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      } else {
        throw new Error('El pago no pudo ser procesado');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      const errorMessage = err.message || 'Error procesando el pago';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Información de la Tarjeta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Billing Details */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Datos de Facturación</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre Completo
                </label>
                <Input
                  type="text"
                  value={billingDetails.name}
                  onChange={(e) => handleBillingChange('name', e.target.value)}
                  placeholder="Nombre en la tarjeta"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={billingDetails.email}
                  onChange={(e) => handleBillingChange('email', e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Teléfono
              </label>
              <Input
                type="tel"
                value={billingDetails.phone}
                onChange={(e) => handleBillingChange('phone', e.target.value)}
                placeholder="+55 11 99999-9999"
              />
            </div>
          </div>

          {/* Card Element */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Información de la Tarjeta
            </label>
            <div className="p-3 border rounded-md">
              <CardElement
                options={cardElementOptions}
                onChange={handleCardChange}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Lock className="w-3 h-3" />
              <span>Tu información está protegida con encriptación SSL</span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Payment Summary */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monto a pagar:</span>
              <span className="font-semibold">{formatCurrency(amount)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Método de pago:</span>
              <span>Tarjeta de crédito/débito</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Procesado por:</span>
              <span>Stripe (Seguro)</span>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={
              !stripe || 
              !elements || 
              isProcessing || 
              !cardComplete ||
              !billingDetails.name ||
              !billingDetails.email
            }
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner className="w-4 h-4" />
                Procesando pago...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Pagar {formatCurrency(amount)}
              </div>
            )}
          </Button>

          {/* Security Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center text-sm text-gray-600">
            <div className="flex items-center justify-center gap-1">
              <Shield className="w-4 h-4" />
              <span>SSL Seguro</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <Lock className="w-4 h-4" />
              <span>PCI Compliance</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <CreditCard className="w-4 h-4" />
              <span>Stripe Verified</span>
            </div>
          </div>

          {/* Accepted Cards */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Tarjetas Aceptadas:</p>
            <div className="flex justify-center gap-2">
              <div className="px-3 py-1 bg-blue-600 text-white text-xs rounded">VISA</div>
              <div className="px-3 py-1 bg-red-600 text-white text-xs rounded">Mastercard</div>
              <div className="px-3 py-1 bg-blue-700 text-white text-xs rounded">American Express</div>
              <div className="px-3 py-1 bg-orange-600 text-white text-xs rounded">Discover</div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CardPayment;
