
'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { paymentAPI, handleAPIError } from '@/lib/api';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Alert } from '../ui/alert';
import { type PaymentLocale, createPaymentT } from './payment-i18n';

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
  locale?: PaymentLocale;
  reservationId?: string;
  confirmationToken?: string;
  onSuccess: (paymentData: { paymentId: string; amount: number }) => void;
  onError: (error: Error) => void;
}

export function PixPayment({ paymentId, qrCode, qrCodeBase64, amount, locale = 'pt', reservationId, confirmationToken, onSuccess, onError }: PixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  // Evita disparar onSuccess más de una vez si el polling y el botón
  // manual coinciden en el tiempo.
  const successFiredRef = useRef(false);

  const handleSuccess = useCallback(() => {
    if (successFiredRef.current) { return; }
    successFiredRef.current = true;
    onSuccess({ paymentId, amount });
  }, [paymentId, amount, onSuccess]);

  const checkPaymentStatus = useCallback(async () => {
    try {
      const response = await paymentAPI.getStatus(paymentId, reservationId ?? '', confirmationToken);
      const status = response.data?.status;
      if (status === 'succeeded' || status === 'approved' || status === 'paid') {
        handleSuccess();
      }
    } catch (_err) {
      // Se reintenta solo en el próximo tick -- un error de red puntual
      // consultando el estado no debe interrumpir la espera del Pix.
    }
  }, [paymentId, reservationId, confirmationToken, handleSuccess]);

  useEffect(() => {
    const interval = setInterval(checkPaymentStatus, 5000);
    return () => clearInterval(interval);
  }, [checkPaymentStatus]);

  // Verificación manual: el huésped ya escaneó y pagó pero el webhook de
  // MercadoPago todavía no llegó (puede tardar unos segundos). Al hacer
  // click, el backend consulta directamente la API de MP para saber si el
  // pago fue aprobado -- si sí, lo marca como succeeded y dispara las
  // notificaciones. Evita que el huésped quede esperando indefinidamente
  // si el webhook está demorado o no está configurado en el dashboard de MP.
  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      await paymentAPI.confirm(paymentId, reservationId ?? '', confirmationToken);
      handleSuccess();
    } catch (err) {
      // Si el backend dice "no aprobado todavía" mostramos un aviso suave,
      // no un error rojo -- el usuario puede reintentar en unos segundos.
      const msg = handleAPIError(err, locale);
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const copyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setError(handleAPIError(err, locale));
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-1">{T('howTo', locale)}</h4>
            <ol className="text-sm text-gray-700 space-y-1">
              <li>{T('step1', locale)}</li>
              <li>{T('step2', locale)}</li>
              <li>{T('step3', locale)}</li>
              <li>{T('step4', locale)}</li>
            </ol>
          </div>
        </div>
      </div>

      {/* bg-white fijo a propósito: el QR necesita alto contraste para escanear bien,
          independiente del tema de la página. */}
      <div className="flex justify-center bg-white p-6 rounded-lg border border-gray-300">
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
        {/* Monto — destacado con fondo verde suave */}
        <div className="rounded-lg bg-white border border-gray-200 px-5 py-4 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">{T('amountLabel', locale)}</span>
          <span className="text-2xl font-bold text-gray-900">R$ {amount.toFixed(2)}</span>
        </div>

        {/* Código PIX — label arriba, código con botón copiar integrado */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {T('codeLabel', locale)}
          </p>
          <div className="flex items-center rounded-lg border-2 border-gray-200 bg-white pr-2">
            <input
              id="pix-code"
              type="text"
              value={qrCode}
              readOnly
              className="flex-1 min-w-0 text-xs font-mono text-gray-700 bg-transparent border-none outline-none px-4 py-3 truncate"
            />
            <button
              type="button"
              onClick={copyPixCode}
              title={T('copy', locale)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                copied
                  ? 'bg-gray-100 text-gray-900'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {copied ? (
                <>
                  <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {T('copied', locale)}
                </>
              ) : (
                <>
                  <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  {T('copy', locale)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
        <LoadingSpinner size="sm" />
        <span>{T('waiting', locale)}</span>
      </div>

      {/* Botón de verificación manual: el webhook de MercadoPago puede
          tardar o no estar configurado todavía. El huésped hace click
          después de pagar para que el backend consulte MP directamente. */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleVerify}
          disabled={isVerifying}
          className="w-full"
        >
          {isVerifying ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              {T('verifying', locale)}
            </span>
          ) : (
            T('alreadyPaid', locale)
          )}
        </Button>
        <p className="text-xs text-gray-500 text-center">{T('alreadyPaidHint', locale)}</p>
      </div>

      <div className="text-center text-xs text-gray-500 pt-4 border-t border-gray-200">
        <p>{T('autoConfirm', locale)}</p>
        <p className="mt-1">{T('dontClose', locale)}</p>
      </div>
    </div>
  );
}

const T = createPaymentT({
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
      dontClose: 'Não feche esta página até a confirmação.',
      alreadyPaid: 'Já paguei — verificar agora',
      alreadyPaidHint: 'Clique após realizar o pagamento se a confirmação demorar.',
      verifying: 'Verificando...'
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
      dontClose: 'No cierres esta página hasta la confirmación.',
      alreadyPaid: 'Ya pagué — verificar ahora',
      alreadyPaidHint: 'Hacé click si el pago tardó en confirmarse.',
      verifying: 'Verificando...'
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
      dontClose: "Don't close this page until confirmed.",
      alreadyPaid: 'I already paid — verify now',
      alreadyPaidHint: 'Click here if confirmation is taking a while.',
      verifying: 'Verifying...'
    },
    fr: {
      howTo: 'Comment payer avec PIX',
      step1: "1. Ouvrez l'appli de votre banque",
      step2: '2. Choisissez de payer avec PIX',
      step3: '3. Scannez le QR code ou copiez le code',
      step4: '4. Confirmez le paiement',
      codeLabel: 'Code PIX (Copier-Coller)',
      copy: 'Copier',
      copied: 'Copié !',
      amountLabel: 'Montant à payer',
      waiting: 'En attente de la confirmation du paiement...',
      autoConfirm: 'Le paiement se confirme automatiquement une fois approuvé.',
      dontClose: 'Ne fermez pas cette page avant la confirmation.',
      alreadyPaid: "J'ai déjà payé — vérifier maintenant",
      alreadyPaidHint: 'Cliquez si la confirmation tarde à arriver.',
      verifying: 'Vérification...'
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
      dontClose: 'Schließen Sie diese Seite erst nach der Bestätigung.',
      alreadyPaid: 'Ich habe bereits bezahlt — jetzt prüfen',
      alreadyPaidHint: 'Klicken Sie hier, wenn die Bestätigung länger dauert.',
      verifying: 'Wird geprüft...'
    },
    it: {
      howTo: 'Come pagare con PIX',
      step1: '1. Apri l\'app della tua banca',
      step2: '2. Scegli di pagare con PIX',
      step3: '3. Scansiona il QR Code o copia il codice',
      step4: '4. Conferma il pagamento',
      codeLabel: 'Codice PIX (Copia e Incolla)',
      copy: 'Copia',
      copied: 'Copiato!',
      amountLabel: 'Importo da pagare',
      waiting: 'In attesa di conferma del pagamento...',
      autoConfirm: 'Il pagamento verrà confermato automaticamente dopo l\'approvazione.',
      dontClose: 'Non chiudere questa pagina fino alla conferma.',
      alreadyPaid: 'Ho già pagato — verifica ora',
      alreadyPaidHint: 'Clicca qui se la conferma tarda ad arrivare.',
      verifying: 'Verifica in corso...'
    }
});
