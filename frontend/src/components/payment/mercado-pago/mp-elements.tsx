// lapa-casa-hostel-frontend/src/components/payment/mercado-pago/mp-elements.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useBookingStore } from '@/stores/booking-store';
import PixPayment from './pix-payment';
import CardPaymentMP from './card-payment';
import InstallmentsSelector from './installments-selector';
import { Smartphone, CreditCard, Clock, Shield } from 'lucide-react';

interface MPElementsProps {
  preferenceId: string;
  paymentType: 'card' | 'pix' | 'installments';
  amount: number;
  currency: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

const MPElements: React.FC<MPElementsProps> = ({
  preferenceId,
  paymentType,
  amount,
  currency,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing
}) => {
  const [mpSDKLoaded, setMpSDKLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  
  const { bookingData } = useBookingStore();

  // Load Mercado Pago SDK
  useEffect(() => {
    const loadMPSDK = async () => {
      try {
        // Check if SDK is already loaded
        if (window.MercadoPago) {
          setMpSDKLoaded(true);
          return;
        }

        // Load SDK script
        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;
        
        script.onload = () => {
          setMpSDKLoaded(true);
        };
        
        script.onerror = () => {
          setError('Error cargando SDK de Mercado Pago');
        };

        document.head.appendChild(script);
      } catch (err) {
        console.error('Error loading MP SDK:', err);
        setError('Error inicializando Mercado Pago');
      }
    };

    loadMPSDK();
  }, []);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Get payment type icon and description
  const getPaymentTypeInfo = (type: string) => {
    switch (type) {
      case 'pix':
        return {
          icon: Smartphone,
          title: 'PIX',
          description: 'Pago instantáneo con PIX',
          benefits: ['Inmediato', 'Sin tasas extra', 'Disponible 24/7']
        };
      case 'card':
        return {
          icon: CreditCard,
          title: 'Tarjeta de Crédito',
          description: 'Pago con tarjeta de crédito',
          benefits: ['Seguro', 'Inmediato', 'Acepta internacionales']
        };
      case 'installments':
        return {
          icon: Clock,
          title: 'Parcelado',
          description: `Pague en ${selectedInstallments}x sin interés`,
          benefits: ['Sin interés', 'Hasta 12 cuotas', 'Aprobación rápida']
        };
      default:
        return {
          icon: CreditCard,
          title: 'Pago',
          description: 'Método de pago',
          benefits: []
        };
    }
  };

  // Handle installments change
  const handleInstallmentsChange = (installments: number) => {
    setSelectedInstallments(installments);
  };

  // Render loading state
  if (!mpSDKLoaded) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <LoadingSpinner className="w-4 h-4" />
            <span>Cargando Mercado Pago...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const paymentInfo = getPaymentTypeInfo(paymentType);
  const IconComponent = paymentInfo.icon;

  return (
    <div className="space-y-6">
      {/* Payment Type Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="w-5 h-5" />
            {paymentInfo.title}
          </CardTitle>
          <p className="text-sm text-gray-600">{paymentInfo.description}</p>
        </CardHeader>
        <CardContent>
          {/* Benefits */}
          <div className="flex flex-wrap gap-2 mb-4">
            {paymentInfo.benefits.map((benefit, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
              >
                {benefit}
              </span>
            ))}
          </div>

          {/* Payment Summary */}
          <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Monto a pagar:</span>
              <span className="font-semibold">{formatCurrency(amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Método:</span>
              <span>{paymentInfo.title}</span>
            </div>
            {paymentType === 'installments' && (
              <div className="flex justify-between">
                <span>Cuotas:</span>
                <span>{selectedInstallments}x de {formatCurrency(amount / selectedInstallments)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Installments Selector for installments payment */}
      {paymentType === 'installments' && (
        <InstallmentsSelector
          amount={amount}
          currency={currency}
          onInstallmentsChange={handleInstallmentsChange}
        />
      )}

      {/* Payment Component */}
      {paymentType === 'pix' && (
        <PixPayment
          preferenceId={preferenceId}
          amount={amount}
          currency={currency}
          onSuccess={onSuccess}
          onError={onError}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      )}

      {(paymentType === 'card' || paymentType === 'installments') && (
        <CardPaymentMP
          preferenceId={preferenceId}
          amount={amount}
          currency={currency}
          installments={paymentType === 'installments' ? selectedInstallments : 1}
          onSuccess={onSuccess}
          onError={onError}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      )}

      {/* Security Notice */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
        <Shield className="w-4 h-4" />
        <span>Pagos seguros procesados por Mercado Pago</span>
      </div>

      {/* Additional Information */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-medium text-sm mb-2">Información Importante</h4>
          <div className="text-sm space-y-1">
            {paymentType === 'pix' && (
              <>
                <p>• El código PIX expira en 24 horas</p>
                <p>• El pago es confirmado inmediatamente</p>
                <p>• Guarda el comprobante de pago</p>
              </>
            )}
            {paymentType === 'card' && (
              <>
                <p>• Pago procesado instantáneamente</p>
                <p>• Recibirás confirmación por email</p>
                <p>• Tarjetas nacionales e internacionales</p>
              </>
            )}
            {paymentType === 'installments' && (
              <>
                <p>• Sin interés para pagos parcelados</p>
                <p>• Primera cuota cobrada hoy</p>
                <p>• Siguientes cuotas mensuales</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MPElements;
