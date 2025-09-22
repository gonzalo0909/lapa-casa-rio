// lapa-casa-hostel-frontend/src/components/payment/stripe/payment-intent.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useBookingStore } from '@/stores/booking-store';
import { CreditCard, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface PaymentIntentProps {
  bookingId: string;
  amount: number;
  currency: string;
  onIntentCreated: (clientSecret: string) => void;
  onError: (error: string) => void;
  className?: string;
}

interface PaymentIntentStatus {
  id: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  clientSecret: string;
  amount: number;
  currency: string;
  created: number;
  lastPaymentError?: {
    message: string;
    type: string;
  };
}

const PaymentIntent: React.FC<PaymentIntentProps> = ({
  bookingId,
  amount,
  currency,
  onIntentCreated,
  onError,
  className
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [intentStatus, setIntentStatus] = useState<PaymentIntentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { bookingData } = useBookingStore();

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('pt-BR');
  };

  // Get status color and icon
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'requires_payment_method':
        return {
          color: 'bg-blue-100 text-blue-800',
          icon: CreditCard,
          text: 'Requiere método de pago'
        };
      case 'requires_confirmation':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: Clock,
          text: 'Requiere confirmación'
        };
      case 'requires_action':
        return {
          color: 'bg-orange-100 text-orange-800',
          icon: AlertCircle,
          text: 'Requiere acción'
        };
      case 'processing':
        return {
          color: 'bg-blue-100 text-blue-800',
          icon: LoadingSpinner,
          text: 'Procesando'
        };
      case 'succeeded':
        return {
          color: 'bg-green-100 text-green-800',
          icon: CheckCircle,
          text: 'Exitoso'
        };
      case 'canceled':
        return {
          color: 'bg-red-100 text-red-800',
          icon: AlertCircle,
          text: 'Cancelado'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800',
          icon: AlertCircle,
          text: status
        };
    }
  };

  // Create payment intent
  const createPaymentIntent = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await api.post('/payments/create-payment-intent', {
        bookingId,
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        paymentMethod: 'stripe',
        metadata: {
          bookingId,
          guestName: bookingData.guestName,
          guestEmail: bookingData.guestEmail,
          roomId: bookingData.roomId,
          bedsCount: bookingData.bedsCount?.toString(),
          checkInDate: bookingData.checkInDate?.toISOString(),
          checkOutDate: bookingData.checkOutDate?.toISOString()
        }
      });

      const { paymentIntent } = response.data;
      
      setIntentStatus({
        id: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        created: paymentIntent.created,
        lastPaymentError: paymentIntent.last_payment_error
      });

      onIntentCreated(paymentIntent.client_secret);
    } catch (err: any) {
      console.error('Error creating payment intent:', err);
      const errorMessage = err.response?.data?.message || 'Error creando intención de pago';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  // Refresh payment intent status
  const refreshPaymentIntent = async () => {
    if (!intentStatus) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const response = await api.get(`/payments/payment-intent/${intentStatus.id}`);
      const { paymentIntent } = response.data;

      setIntentStatus({
        id: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        created: paymentIntent.created,
        lastPaymentError: paymentIntent.last_payment_error
      });
    } catch (err: any) {
      console.error('Error refreshing payment intent:', err);
      const errorMessage = err.response?.data?.message || 'Error actualizando estado del pago';
      setError(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Create payment intent on mount
  useEffect(() => {
    createPaymentIntent();
  }, [bookingId, amount, currency]);

  // Auto-refresh status periodically if processing
  useEffect(() => {
    if (intentStatus?.status === 'processing') {
      const interval = setInterval(refreshPaymentIntent, 3000);
      return () => clearInterval(interval);
    }
  }, [intentStatus?.status]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Intención de Pago
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading State */}
        {isCreating && (
          <div className="flex items-center justify-center gap-2 py-8">
            <LoadingSpinner className="w-5 h-5" />
            <span>Creando intención de pago...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Payment Intent Details */}
        {intentStatus && (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const display = getStatusDisplay(intentStatus.status);
                  const IconComponent = display.icon;
                  return (
                    <>
                      <IconComponent className="w-4 h-4" />
                      <Badge className={display.color}>
                        {display.text}
                      </Badge>
                    </>
                  );
                })()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPaymentIntent}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <LoadingSpinner className="w-3 h-3" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </Button>
            </div>

            {/* Payment Details */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">ID del Pago:</span>
                <span className="font-mono text-xs">{intentStatus.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monto:</span>
                <span className="font-semibold">
                  {formatCurrency(intentStatus.amount / 100)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Moneda:</span>
                <span className="uppercase">{intentStatus.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Creado:</span>
                <span>{formatDate(intentStatus.created)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className="capitalize">{intentStatus.status.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Last Payment Error */}
            {intentStatus.lastPaymentError && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <strong>Último error:</strong> {intentStatus.lastPaymentError.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {intentStatus.status === 'requires_payment_method' && (
                <Button
                  onClick={() => onIntentCreated(intentStatus.clientSecret)}
                  className="flex-1"
                >
                  Continuar con el Pago
                </Button>
              )}

              {intentStatus.status === 'requires_action' && (
                <Button
                  onClick={() => onIntentCreated(intentStatus.clientSecret)}
                  variant="outline"
                  className="flex-1"
                >
                  Completar Autenticación
                </Button>
              )}

              {(intentStatus.status === 'canceled' || intentStatus.lastPaymentError) && (
                <Button
                  onClick={createPaymentIntent}
                  disabled={isCreating}
                  className="flex-1"
                >
                  {isCreating ? (
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                  ) : null}
                  Reintentar Pago
                </Button>
              )}
            </div>

            {/* Success Message */}
            {intentStatus.status === 'succeeded' && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  El pago ha sido procesado exitosamente. Tu reserva está confirmada.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Booking Information */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-sm mb-2">Información de la Reserva</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Reserva ID: <span className="font-mono">{bookingId}</span></div>
            <div>Huésped: {bookingData.guestName}</div>
            <div>Email: {bookingData.guestEmail}</div>
            {bookingData.checkInDate && bookingData.checkOutDate && (
              <div>
                Fechas: {bookingData.checkInDate.toLocaleDateString('pt-BR')} - {bookingData.checkOutDate.toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentIntent;
