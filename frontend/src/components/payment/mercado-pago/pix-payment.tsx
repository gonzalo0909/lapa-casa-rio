// lapa-casa-hostel-frontend/src/components/payment/mercado-pago/pix-payment.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useBookingStore } from '@/stores/booking-store';
import { QrCode, Smartphone, Copy, CheckCircle, Clock, RefreshCw } from 'lucide-react';

interface PixPaymentProps {
  preferenceId: string;
  amount: number;
  currency: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

interface PixData {
  qrCode: string;
  qrCodeBase64: string;
  pixCopyPaste: string;
  expirationDate: string;
  paymentId: string;
}

const PixPayment: React.FC<PixPaymentProps> = ({
  preferenceId,
  amount,
  currency,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing
}) => {
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected' | 'cancelled'>('pending');
  const [error, setError] = useState<string | null>(null);
  
  const { bookingData } = useBookingStore();

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  // Generate PIX payment
  const generatePixPayment = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await api.post('/payments/mercado-pago/create-pix', {
        preferenceId,
        amount: amount,
        currency,
        description: `Depósito reserva Lapa Casa Hostel`,
        payerEmail: bookingData.guestEmail,
        payerName: bookingData.guestName,
        payerPhone: bookingData.guestPhone,
        metadata: {
          bookingId: preferenceId,
          roomId: bookingData.roomId,
          checkInDate: bookingData.checkInDate?.toISOString(),
          checkOutDate: bookingData.checkOutDate?.toISOString()
        }
      });

      const { pixPayment } = response.data;
      
      setPixData({
        qrCode: pixPayment.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: pixPayment.point_of_interaction.transaction_data.qr_code_base64,
        pixCopyPaste: pixPayment.point_of_interaction.transaction_data.qr_code,
        expirationDate: pixPayment.date_of_expiration,
        paymentId: pixPayment.id
      });

      // Start polling for payment status
      pollPaymentStatus(pixPayment.id);
    } catch (err: any) {
      console.error('Error generating PIX:', err);
      const errorMessage = err.response?.data?.message || 'Error generando PIX';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Poll payment status
  const pollPaymentStatus = async (paymentId: string) => {
    const poll = async () => {
      try {
        const response = await api.get(`/payments/mercado-pago/status/${paymentId}`);
        const { status } = response.data;

        setPaymentStatus(status);

        if (status === 'approved') {
          setIsProcessing(false);
          onSuccess(paymentId);
        } else if (status === 'rejected' || status === 'cancelled') {
          setIsProcessing(false);
          onError('Pago PIX rechazado o cancelado');
        }
      } catch (err) {
        console.error('Error polling payment status:', err);
      }
    };

    // Poll every 3 seconds
    const intervalId = setInterval(poll, 3000);
    
    // Stop polling after 30 minutes (PIX expires in 24h but reasonable polling limit)
    setTimeout(() => clearInterval(intervalId), 30 * 60 * 1000);
    
    return intervalId;
  };

  // Copy PIX code to clipboard
  const copyPixCode = async () => {
    if (!pixData) return;

    try {
      await navigator.clipboard.writeText(pixData.pixCopyPaste);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = pixData.pixCopyPaste;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Calculate time remaining
  useEffect(() => {
    if (!pixData) return;

    const updateTimeRemaining = () => {
      const now = new Date().getTime();
      const expiration = new Date(pixData.expirationDate).getTime();
      const difference = expiration - now;

      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeRemaining(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeRemaining('Expirado');
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [pixData]);

  // Generate PIX on mount
  useEffect(() => {
    generatePixPayment();
  }, []);

  // Get status color and text
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', text: 'Pendiente' };
      case 'approved':
        return { color: 'bg-green-100 text-green-800', text: 'Aprobado' };
      case 'rejected':
        return { color: 'bg-red-100 text-red-800', text: 'Rechazado' };
      case 'cancelled':
        return { color: 'bg-gray-100 text-gray-800', text: 'Cancelado' };
      default:
        return { color: 'bg-gray-100 text-gray-800', text: status };
    }
  };

  return (
    <div className="space-y-6">
      {/* Generation Loading */}
      {isGenerating && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-2">
              <LoadingSpinner className="w-5 h-5" />
              <span>Generando código PIX...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* PIX Payment Interface */}
      {pixData && (
        <>
          {/* Status and Timer */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  Pago PIX
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusDisplay(paymentStatus).color}>
                    {getStatusDisplay(paymentStatus).text}
                  </Badge>
                  {timeRemaining && timeRemaining !== 'Expirado' && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span>{timeRemaining}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(amount)}
                </div>
                <p className="text-sm text-gray-600">
                  Escaneá el código QR o copiá el código PIX para pagar
                </p>
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Código QR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center mb-4">
                {pixData.qrCodeBase64 && (
                  <div className="p-4 bg-white rounded-lg border">
                    <img
                      src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                      alt="QR Code PIX"
                      className="w-64 h-64"
                    />
                  </div>
                )}
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                  1. Abrí tu app bancaria o de PIX
                </p>
                <p className="text-sm text-gray-600">
                  2. Escaneá el código QR
                </p>
                <p className="text-sm text-gray-600">
                  3. Confirmá el pago
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Copy & Paste Code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Código PIX</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs font-mono break-all text-center">
                  {pixData.pixCopyPaste}
                </p>
              </div>
              
              <Button
                onClick={copyPixCode}
                variant="outline"
                className="w-full"
                disabled={isCopied}
              >
                {isCopied ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Copiado!
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4" />
                    Copiar código PIX
                  </div>
                )}
              </Button>

              <div className="text-center space-y-1 text-sm text-gray-600">
                <p>1. Copiá el código PIX</p>
                <p>2. Abrí tu app bancaria</p>
                <p>3. Elegí "PIX Copia e Cola"</p>
                <p>4. Pegá el código y confirmá</p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Instructions */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300">
                    Instrucciones PIX
                  </h4>
                  <div className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
                    <p>• El pago se confirma instantáneamente</p>
                    <p>• PIX disponible 24/7, todos los días</p>
                    <p>• Sin tasas adicionales</p>
                    <p>• Código válido por 24 horas</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Waiting for Payment */}
          {paymentStatus === 'pending' && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <LoadingSpinner className="w-5 h-5 text-yellow-600" />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-300">
                      Esperando pago PIX
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-200">
                      Realizá el pago y tu reserva será confirmada automáticamente
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Success */}
          {paymentStatus === 'approved' && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-800 dark:text-green-300">
                      Pago PIX confirmado
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-200">
                      Tu reserva ha sido confirmada exitosamente
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Refresh Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => generatePixPayment()}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <LoadingSpinner className="w-4 h-4 mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Generar nuevo código
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default PixPayment;
