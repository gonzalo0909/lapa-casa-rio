'use client';
// frontend/src/components/payment/auto-card-payment.tsx
//
// Formulario MP completo visible desde el inicio.
// Cuando el usuario escribe el número de tarjeta:
//   - 6+ dígitos → detección de BIN automática en segundo plano
//   - tarjeta brasileña → sigue con MP (sin cambios)
//   - tarjeta internacional → cambia automáticamente al form de Stripe

import React, { useState, useEffect, useRef } from 'react';
import { paymentAPI, getBookingToken } from '@/lib/api';
import { LoadingSpinner } from '../ui/loading-spinner';
import { type PaymentLocale, createPaymentT } from './payment-i18n';
import { MpCardPayment } from './mp-card-payment';
import { StripeElementsWrapper } from './stripe-elements';
import { CardPayment } from './card-payment';

// ── Tipos ────────────────────────────────────────────────────────────────────

type Mode = 'mp' | 'switching' | 'intl';

interface StripePaymentData {
  paymentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  cardSurchargePercent: number;
}

export interface AutoCardPaymentProps {
  reservationId: string;
  depositAmount: number;
  locale: PaymentLocale;
  onSuccess: (data: { paymentId: string; amount: number; currency: string }) => void;
  onError: (err: Error) => void;
  paymentContext?: 'apartment';
}

// ── i18n ─────────────────────────────────────────────────────────────────────

const T = createPaymentT({
  pt: {
    switching:   'Cartão internacional detectado. Preparando pagamento…',
    stripeErr:   'Erro ao preparar pagamento internacional. Tente novamente.',
    backToMp:    '← Usar cartão brasileiro',
    unavailable: 'Pagamento com cartão temporariamente indisponível. Use PIX ou entre em contato.',
  },
  es: {
    switching:   'Tarjeta internacional detectada. Preparando pago…',
    stripeErr:   'Error al preparar el pago internacional. Intentá de nuevo.',
    backToMp:    '← Usar tarjeta brasileña',
    unavailable: 'Pago con tarjeta temporalmente no disponible. Usá PIX o contactanos.',
  },
  en: {
    switching:   'International card detected. Preparing payment…',
    stripeErr:   'Error preparing international payment. Please try again.',
    backToMp:    '← Use a Brazilian card',
    unavailable: 'Card payment temporarily unavailable. Use PIX or contact us.',
  },
  fr: {
    switching:   'Carte internationale détectée. Préparation du paiement…',
    stripeErr:   'Erreur de préparation. Réessayez.',
    backToMp:    '← Utiliser une carte brésilienne',
    unavailable: 'Paiement par carte temporairement indisponible. Utilisez PIX ou contactez-nous.',
  },
  de: {
    switching:   'Internationale Karte erkannt. Zahlung wird vorbereitet…',
    stripeErr:   'Fehler bei der Vorbereitung. Bitte erneut versuchen.',
    backToMp:    '← Brasilianische Karte verwenden',
    unavailable: 'Kartenzahlung vorübergehend nicht verfügbar. Nutzen Sie PIX oder kontaktieren Sie uns.',
  },
  it: {
    switching:   'Carta internazionale rilevata. Preparazione pagamento…',
    stripeErr:   'Errore nella preparazione. Riprova.',
    backToMp:    '← Usa una carta brasiliana',
    unavailable: 'Pagamento con carta temporaneamente non disponibile. Usa PIX o contattaci.',
  },
});

// ── Componente ───────────────────────────────────────────────────────────────

export const AutoCardPayment: React.FC<AutoCardPaymentProps> = ({
  reservationId,
  depositAmount,
  locale,
  onSuccess,
  onError,
  paymentContext,
}) => {
  const [mode,         setMode]        = useState<Mode>('mp');
  const [stripeData,   setStripeData]  = useState<StripePaymentData | null>(null);
  const [stripeError,  setStripeError] = useState<string | null>(null);
  // true cuando el SDK de MP falló Y el fallback a Stripe también falló
  const [bothFailed,   setBothFailed]  = useState(false);

  // BIN que ya fue evaluado — no relanzar la misma detección dos veces
  const lastCheckedBin = useRef<string>('');
  // Resultado de la última detección ('br' | 'intl' | null)
  const lastResult     = useRef<'br' | 'intl' | null>(null);

  const mpSdkRef = useRef<any>(null);

  // ── Cargar SDK de MP para detección ──────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') { return; }
    const key = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!key) { return; }

    // El SDK de MP lanza promesas internas que pueden ser rechazadas por
    // bloqueadores de anuncios (mercadolibre.com bloqueado). Las capturamos
    // antes de que lleguen al handler global y evitamos el error de Sentry.
    const suppressMpRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? String(event.reason ?? '');
      if (msg.includes('mercadolibre.com') || msg.includes('mercadopago.com')) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', suppressMpRejection);

    const init = () => {
      const MP = (window as any).MercadoPago;
      if (!MP || mpSdkRef.current) { return; }
      try { mpSdkRef.current = new MP(key, { locale: 'pt-BR' }); } catch { /* silent */ }
    };

    if ((window as any).MercadoPago) { init(); return; }
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);

    return () => { window.removeEventListener('unhandledrejection', suppressMpRejection); };
  }, []);

  // ── Detección automática por BIN ─────────────────────────────────────────

  const handleBinChange = async (bin: string) => {
    if (!bin || bin.length < 6) { return; }
    // No repetir la misma detección
    if (bin === lastCheckedBin.current) { return; }
    lastCheckedBin.current = bin;

    const mp = mpSdkRef.current;
    if (!mp) { return; } // SDK no cargó → no detectamos, dejamos MP como default

    try {
      const methods = await mp.getPaymentMethods({ bin });

      let isBr = false;
      if (methods.results?.length) {
        const instData = await mp.getInstallments({
          amount:        String(Math.max(depositAmount, 1)),
          locale:        'pt-BR',
          paymentTypeId: 'credit_card',
          bin,
        });
        isBr = instData[0]?.payer_costs?.some(
          (c: { installments: number }) => c.installments >= 2
        ) ?? false;
      }

      lastResult.current = isBr ? 'br' : 'intl';

      if (!isBr) {
        // Tarjeta internacional → cambiar a Stripe automáticamente
        await switchToStripe();
      }
      // Si es brasileña → no hacer nada, el form MP ya está visible
    } catch {
      // Error en la detección → dejar MP como default (no bloquear el pago)
    }
  };

  // ── Cambio automático a Stripe ────────────────────────────────────────────

  const switchToStripe = async () => {
    if (stripeData) { setMode('intl'); return; }
    setMode('switching');
    setStripeError(null);
    try {
      const res = await (paymentContext === 'apartment'
        ? paymentAPI.processApartmentDeposit(reservationId, 'stripe')
        : paymentAPI.processDeposit(reservationId, 'stripe', undefined, getBookingToken(reservationId)));
      const raw = (res as any).data;
      const p   = raw?.data?.payment ?? raw?.payment ?? raw?.data ?? raw;
      setStripeData({
        paymentId:            p.paymentId,
        clientSecret:         p.clientSecret         ?? '',
        amount:               p.amount,
        currency:             p.currency             ?? 'BRL',
        cardSurchargePercent: p.cardSurchargePercent ?? 0,
      });
      setMode('intl');
    } catch {
      setStripeError(T('stripeErr', locale));
      setMode('mp'); // volver al form MP si falla
      // Si llegamos acá desde onSdkError (MP falló), ambos proveedores fallaron
      setBothFailed(true);
    }
  };

  // ── Volver a MP ───────────────────────────────────────────────────────────

  const backToMp = () => {
    lastCheckedBin.current = ''; // permitir nueva detección
    lastResult.current = null;
    setMode('mp');
    setStripeError(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Transición → mostrando spinner mientras carga Stripe
  if (mode === 'switching') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '.65rem',
        padding: '1.25rem', borderRadius: 10,
        background: 'var(--bg-card, #f7f7f5)',
        color: 'var(--fg-muted, #555)', fontSize: '.93rem',
      }}>
        <LoadingSpinner size="sm" />
        {T('switching', locale)}
      </div>
    );
  }

  // Modo Stripe
  if (mode === 'intl') {
    return (
      <div>
        {stripeError && (
          <div style={{
            padding: '.9rem 1.15rem', borderRadius: 10, marginBottom: '.75rem',
            background: '#FEE2E2', border: '1.5px solid #FCA5A5',
            color: '#991B1B', fontSize: '.93rem',
          }}>
            {stripeError}
          </div>
        )}
        {stripeData && (
          <StripeElementsWrapper
            clientSecret={stripeData.clientSecret}
            amount={stripeData.amount}
            currency={stripeData.currency}
          >
            <CardPayment
              paymentId={stripeData.paymentId}
              clientSecret={stripeData.clientSecret}
              amount={stripeData.amount}
              currency={stripeData.currency}
              locale={locale}
              reservationId={reservationId}
              confirmationToken={getBookingToken(reservationId) ?? undefined}
              onSuccess={onSuccess}
              onError={onError}
            />
          </StripeElementsWrapper>
        )}
        <button
          type="button"
          onClick={backToMp}
          style={{
            marginTop: '1rem', background: 'none', border: 'none',
            color: 'var(--fg-muted, #888)', fontSize: '.85rem',
            cursor: 'pointer', textDecoration: 'underline', padding: 0,
          }}
        >
          {T('backToMp', locale)}
        </button>
      </div>
    );
  }

  // Modo MP (default) — formulario completo visible desde el inicio.
  // Si ambos proveedores fallaron (MP SDK + Stripe), mostramos un mensaje
  // claro en lugar de una pantalla en blanco.
  if (bothFailed) {
    return (
      <div style={{
        padding: '1.1rem 1.15rem', borderRadius: 10,
        background: '#FEE2E2', border: '1.5px solid #FCA5A5',
        color: '#991B1B', fontSize: '.93rem',
      }}>
        {T('unavailable', locale)}
      </div>
    );
  }

  return (
    <MpCardPayment
      reservationId={reservationId}
      depositAmount={depositAmount}
      surchargePercent={0}
      locale={locale}
      onSuccess={d => onSuccess({ ...d, currency: 'BRL' })}
      onError={onError}
      onBinChange={handleBinChange}
      onSdkError={switchToStripe}
      mpCardEndpoint={paymentContext === 'apartment' ? '/payments/apartments/deposit-mp-card' : undefined}
    />
  );
};
