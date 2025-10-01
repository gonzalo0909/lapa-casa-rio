// lapa-casa-hostel/frontend/src/components/payment/pix-payment.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Alert } from '../ui/alert';

interface PixPaymentProps {
  bookingId: string;
  amount: number;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

interface PixData {
  qrCode: string;
  qrCodeBase64: string;
  pixKey: string;
  expiresAt: string;
  transactionId: string;
}

export function PixPayment({ bookingId, amount, onSuccess, onError }: PixPaymentProps) {
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    generatePixCode();
  }, [bookingId, amount]);

  useEffect(() => {
    if (!pixData) return;

    const checkInterval = setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => clearInterval(checkInterval);
  }, [pixData]);

  useEffect(() => {
    if (!pixData?.expiresAt) return;

    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const expiryTime = new Date(pixData.expiresAt).getTime();
      const diff = Math.max(0, expiryTime - now);
      setTimeRemaining(Math.floor(diff / 1000));
    };

    calculateTimeRemaining();
    const timer = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(timer);
  }, [pixData]);

  const generatePixCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/pix/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId,
          amount
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar código PIX');
      }

      const data: PixData = await response.json();
      setPixData(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar PIX');
      onError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!pixData || isChecking) return;

    setIsChecking(true);

    try {
      const response = await fetch(`/api/payments/pix/status/${pixData.transactionId}`);
      
      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.status === 'approved' || data.status === 'paid') {
        onSuccess({
          paymentId: data.paymentId,
          transactionId: pixData.transactionId,
          amount,
          currency: 'BRL',
          status: 'succeeded',
          paymentMethod: 'pix'
        });
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const copyPixCode = async () => {
    if (!pixData) return;

    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Gerando código PIX...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive" role="alert">
          {error}
        </Alert>
        <Button onClick={generatePixCode} className="w-full">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!pixData) return null;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          </svg>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">Como pagar com PIX</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Abra o app do seu banco</li>
              <li>2. Escolha pagar com PIX</li>
              <li>3. Escaneie o QR Code ou copie o código</li>
              <li>4. Confirme o pagamento</li>
            </ol>
          </div>
        </div>
      </div>

      {timeRemaining > 0 ? (
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Código expira em:</p>
          <p className="text-2xl font-bold text-gray-900">{formatTime(timeRemaining)}</p>
        </div>
      ) : (
        <Alert variant="destructive">
          Código PIX expirado. Gere um novo código.
        </Alert>
      )}

      <div className="flex justify-center bg-white p-6 rounded-lg border">
        <QRCodeSVG
          value={pixData.qrCode}
          size={256}
          level="H"
          includeMargin
        />
      </div>

      <div className="space-y-3">
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Código PIX (Copia e Cola)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pixData.qrCode}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono"
              aria-label="Código PIX"
            />
            <Button
              type="button"
              onClick={copyPixCode}
              variant={copied ? 'default' : 'outline'}
              size="sm"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  Copiado!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                  </svg>
                  Copiar
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Valor a pagar</span>
            <span className="text-xl font-bold text-gray-900">
              R$ {amount.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            ID da transação: {pixData.transactionId}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
        <LoadingSpinner size="sm" />
        <span>Aguardando confirmação do pagamento...</span>
      </div>

      <div className="text-center text-xs text-gray-500 pt-4 border-t">
        <p>O pagamento será confirmado automaticamente após a aprovação.</p>
        <p className="mt-1">Não feche esta página até a confirmação.</p>
      </div>
    </div>
  );
}
