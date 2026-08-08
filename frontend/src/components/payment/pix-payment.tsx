// lapa-casa-hostel/frontend/src/components/payment/pix-payment.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { paymentAPI, handleAPIError } from '@/lib/api';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Alert } from '../ui/alert';

/**
 * PixPayment Component
 *
 * El QR/código Pix ya viene generado por el padre via
 * POST /payments/deposit (provider: mercadopago) -- este componente solo
 * lo muestra y consulta GET /payments/:id/status cada 5s hasta que el
 * webhook real de MercadoPago (routes/webhooks... / payments.routes.ts)
 * marque el pago como succeeded.
 *
 * @component
 */
interface PixPaymentProps {
  paymentId: string;
  qrCode: string;
  qrCodeBase64?: string;
  amount: number;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  onSuccess: (paymentData: { paymentId: string; amount: number }) => void;
  onError: (error: Error) => void;
}

export function PixPayment({ paymentId, qrCode, qrCodeBase64, amount, locale = 'pt', onSuccess, onError }: PixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkPaymentStatus = useCallback(async () => {
    try {
      const response = await paymentAPI.getStatus(paymentId);
      const status = response.data?.status;
      if (status === 'succeeded' || status === 'approved' || status === 'paid') {
        onSuccess({ paymentId, amount });
      }
    } catch (_err) {
      // Se reintenta solo en el próximo tick -- un error de red puntual
      // consultando el estado no debe interrumpir la espera del Pix.
    }
  }, [paymentId, amount, onSuccess]);

  useEffect(() => {
    const interval = setInterval(checkPaymentStatus, 5000);
    return () => clearInterval(interval);
  }, [checkPaymentStatus]);

  const copyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setError(handleAPIError(err));
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">{T('howTo', locale)}</h4>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>{T('step1', locale)}</li>
              <li>{T('step2', locale)}</li>
              <li>{T('step3', locale)}</li>
              <li>{T('step4', locale)}</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="flex justify-center bg-white p-6 rounded-lg border">
        {qrCodeBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code Pix" width={256} height={256} />
        ) : (
          <QRCodeSVG value={qrCode} size={256} level="H" includeMargin />
        )}
      </div>

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      <div className="space-y-3">
        <div className="bg-gray-50 rounded-lg p-4">
          <label htmlFor="pix-code" className="block text-sm font-medium text-gray-700 mb-2">
            {T('codeLabel', locale)}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="pix-code"
              type="text"
              value={qrCode}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono"
            />
            <Button type="button" onClick={copyPixCode} variant={copied ? 'success' : 'outline'} size="sm">
              {copied ? T('copied', locale) : T('copy', locale)}
            </Button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">{T('amountLabel', locale)}</span>
            <span className="text-xl font-bold text-gray-900">R$ {amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
        <LoadingSpinner size="sm" />
        <span>{T('waiting', locale)}</span>
      </div>

      <div className="text-center text-xs text-gray-500 pt-4 border-t">
        <p>{T('autoConfirm', locale)}</p>
        <p className="mt-1">{T('dontClose', locale)}</p>
      </div>
    </div>
  );
}

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      howTo: 'Como pagar com PIX',
      step1: '1. Abra o app do seu banco',
      step2: '2. Escolha pagar com PIX',
      step3: '3. Escaneie o QR Code ou copie o código',
      step4: '4. Confirme o pagamento',
      codeLabel: 'Código PIX (Copia e Cola)',
      copy: 'Copiar',
      copied: 'Copiado!',
      amountLabel: 'Valor a pagar',
      waiting: 'Aguardando confirmação do pagamento...',
      autoConfirm: 'O pagamento será confirmado automaticamente após a aprovação.',
      dontClose: 'Não feche esta página até a confirmação.'
    },
    es: {
      howTo: 'Cómo pagar con PIX',
      step1: '1. Abrí la app de tu banco',
      step2: '2. Elegí pagar con PIX',
      step3: '3. Escaneá el QR o copiá el código',
      step4: '4. Confirmá el pago',
      codeLabel: 'Código PIX (Copiar y Pegar)',
      copy: 'Copiar',
      copied: '¡Copiado!',
      amountLabel: 'Monto a pagar',
      waiting: 'Esperando confirmación del pago...',
      autoConfirm: 'El pago se confirma automáticamente al aprobarse.',
      dontClose: 'No cierres esta página hasta la confirmación.'
    },
    en: {
      howTo: 'How to pay with PIX',
      step1: '1. Open your bank app',
      step2: '2. Choose to pay with PIX',
      step3: '3. Scan the QR code or copy the code',
      step4: '4. Confirm the payment',
      codeLabel: 'PIX Code (Copy & Paste)',
      copy: 'Copy',
      copied: 'Copied!',
      amountLabel: 'Amount to pay',
      waiting: 'Waiting for payment confirmation...',
      autoConfirm: 'Payment confirms automatically once approved.',
      dontClose: 'Don’t close this page until confirmed.'
    },
    fr: {
      howTo: 'Comment payer avec PIX',
      step1: '1. Ouvrez l’appli de votre banque',
      step2: '2. Choisissez de payer avec PIX',
      step3: '3. Scannez le QR code ou copiez le code',
      step4: '4. Confirmez le paiement',
      codeLabel: 'Code PIX (Copier-Coller)',
      copy: 'Copier',
      copied: 'Copié !',
      amountLabel: 'Montant à payer',
      waiting: 'En attente de la confirmation du paiement...',
      autoConfirm: 'Le paiement se confirme automatiquement une fois approuvé.',
      dontClose: 'Ne fermez pas cette page avant la confirmation.'
    },
    de: {
      howTo: 'So bezahlen Sie mit PIX',
      step1: '1. Öffnen Sie Ihre Banking-App',
      step2: '2. Wählen Sie PIX als Zahlungsmethode',
      step3: '3. Scannen Sie den QR-Code oder kopieren Sie den Code',
      step4: '4. Bestätigen Sie die Zahlung',
      codeLabel: 'PIX-Code (Kopieren & Einfügen)',
      copy: 'Kopieren',
      copied: 'Kopiert!',
      amountLabel: 'Zu zahlender Betrag',
      waiting: 'Warten auf Zahlungsbestätigung...',
      autoConfirm: 'Die Zahlung wird nach Genehmigung automatisch bestätigt.',
      dontClose: 'Schließen Sie diese Seite erst nach der Bestätigung.'
    }
  };
  return t[locale]?.[key] || key;
}
