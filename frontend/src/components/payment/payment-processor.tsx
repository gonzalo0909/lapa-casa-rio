// frontend/src/components/payment/payment-processor.tsx
// Motor de pago real: PIX (MercadoPago) + Tarjeta (Stripe).
// Reemplaza el enchufe temporal del preview.

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { paymentAPI, getBookingToken } from '@/lib/api';
import { PixPayment } from './pix-payment';
import { AutoCardPayment } from './auto-card-payment';
import { type PaymentLocale, createPaymentT } from './payment-i18n';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface PaymentProcessorProps {
  reservationId: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  checkInDate: string;
  locale: string;
  onSuccess: () => void;
  paymentContext?: 'apartment';
}

interface PixPaymentData {
  paymentId: string;
  qrCode: string;
  qrCodeBase64?: string;
  amount: number;
}

// ── Helpers de localización ─────────────────────────────────────────────────

const SUPPORTED: PaymentLocale[] = ['pt', 'es', 'en', 'fr', 'de', 'it'];

function safeLocale(locale: string): PaymentLocale {
  return SUPPORTED.includes(locale as PaymentLocale) ? (locale as PaymentLocale) : 'pt';
}

const T = createPaymentT({
    pt: {
      tabPix:           'PIX',
      tabCard:          'Cartão',
      pixRecommended:   '✓ Recomendado – sem taxa extra',
      depositNow:       'Depósito agora',
      remainingCheckin: 'Saldo no check-in',
      totalBooking:     'Total da reserva',
      loading:          'Preparando pagamento…',
      error:            'Erro ao iniciar o pagamento. Tente novamente.',
      checkIn:          'Check-in',
    },
    es: {
      tabPix:           'PIX',
      tabCard:          'Tarjeta',
      pixRecommended:   '✓ Recomendado – sin cargo extra',
      depositNow:       'Depósito ahora',
      remainingCheckin: 'Saldo al check-in',
      totalBooking:     'Total de la reserva',
      loading:          'Preparando pago…',
      error:            'Error al iniciar el pago. Intentá de nuevo.',
      checkIn:          'Check-in',
    },
    en: {
      tabPix:           'PIX',
      tabCard:          'Card',
      pixRecommended:   '✓ Recommended – no extra fee',
      depositNow:       'Deposit now',
      remainingCheckin: 'Balance at check-in',
      totalBooking:     'Booking total',
      loading:          'Preparing payment…',
      error:            'Error initiating payment. Please try again.',
      checkIn:          'Check-in',
    },
    fr: {
      tabPix:           'PIX',
      tabCard:          'Carte',
      pixRecommended:   '✓ Recommandé – sans frais',
      depositNow:       'Dépôt maintenant',
      remainingCheckin: 'Solde au check-in',
      totalBooking:     'Total de la réservation',
      loading:          'Préparation du paiement…',
      error:            'Erreur lors du paiement. Réessayez.',
      checkIn:          'Check-in',
    },
    de: {
      tabPix:           'PIX',
      tabCard:          'Karte',
      pixRecommended:   '✓ Empfohlen – kein Aufpreis',
      depositNow:       'Anzahlung jetzt',
      remainingCheckin: 'Restbetrag beim Check-in',
      totalBooking:     'Reservierungsgesamt',
      loading:          'Zahlung wird vorbereitet…',
      error:            'Fehler beim Starten der Zahlung. Bitte erneut versuchen.',
      checkIn:          'Check-in',
    },
    it: {
      tabPix:           'PIX',
      tabCard:          'Carta',
      pixRecommended:   '✓ Consigliato – nessuna commissione extra',
      depositNow:       'Caparra ora',
      remainingCheckin: 'Saldo al check-in',
      totalBooking:     'Totale prenotazione',
      loading:          'Preparazione del pagamento…',
      error:            "Errore nell'avvio del pagamento. Riprova.",
      checkIn:          'Check-in',
    },
});

// ── Estilos inline con las CSS vars del apartment engine ────────────────────
// Las vars --primary, --accent, --border, --bg-card, --fg, --primary-soft
// están definidas en apartment-engine.module.css y se propagan globalmente.

// Record<string, CSSProperties>: valida cada objeto contra los tipos CSS de React.
// Con noUncheckedIndexedAccess, S.xxx es CSSProperties | undefined -- eso es
// compatible con el prop style?: CSSProperties, así que no genera error en JSX.
// Valores alineados 1:1 con apartment-engine.module.css (post-agrandar):
//   .payTab        → font .95rem, padding .7rem, radius 8px
//   .summaryRows   → font .93rem, gap .5rem
//   .totalPrice    → font 1.15rem
//   .summaryCard   → padding 1.35rem 1.55rem
const S: Record<string, React.CSSProperties> = {
  wrap: {
    border:       '1.5px solid var(--border, #ddd)',
    borderRadius: 12,
    background:   'var(--bg-card, #fff)',
    color:        'var(--fg, #111)',
    overflow:     'hidden',
  },
  summary: {
    padding:       '1.35rem 1.55rem',
    borderBottom:  '1px solid var(--border, #ddd)',
    display:       'flex',
    flexDirection: 'column',
    gap:           '.5rem',
  },
  row: {
    display:        'flex',
    justifyContent: 'space-between',
    fontSize:       '.93rem',
  },
  rowTotal: {
    display:        'flex',
    justifyContent: 'space-between',
    fontWeight:     700,
    fontSize:       '1.15rem',
    paddingTop:     '.6rem',
    borderTop:      '1px solid var(--border, #ddd)',
    marginTop:      '.2rem',
  },
  tabs: {
    display:  'flex',
    gap:      '.5rem',
    padding:  '1.1rem 1.35rem .6rem',
  },
  body: {
    padding: '1.1rem 1.35rem 1.35rem',
  },
  loadingBox: {
    padding:   '2.25rem',
    textAlign: 'center',
    color:     'var(--fg-muted, #666)',
    fontSize:  '.93rem',
  },
  errorBox: {
    padding:      '.9rem 1.15rem',
    borderRadius: 10,
    background:   '#FEE2E2',
    border:       '1.5px solid #FCA5A5',
    color:        '#991B1B',
    fontSize:     '.93rem',
    marginBottom: '1.25rem',
  },
  surchargeBadge: {
    marginBottom: '.85rem',
    padding:      '.65rem 1rem',
    borderRadius: 8,
    background:   'var(--warn-bg, #FBE9DB)',
    border:       '1px solid var(--warn-border, #E29B72)',
    color:        'var(--warn-fg, #9A4A28)',
    fontSize:     '.9rem',
  },
  pixBadge: {
    display:    'block',
    fontSize:   '.8rem',
    fontWeight: 400,
    color:      'var(--success-fg, #1E5E40)',
    marginTop:  '.15rem',
  },
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex:         1,
    padding:      '.7rem',
    borderRadius: 8,
    border:       `1.5px solid ${active ? 'var(--primary, #2C4A8C)' : 'var(--border, #ddd)'}`,
    background:   active ? 'var(--primary-soft, #D5DFF5)' : 'transparent',
    color:        active ? 'var(--primary, #2C4A8C)' : 'var(--fg-muted, #6A6058)',
    fontWeight:   600,
    fontSize:     '.95rem',
    cursor:       'pointer',
    textAlign:    'center',
    lineHeight:   1.3,
    transition:   'all .15s',
  };
}

// ── Componente principal ─────────────────────────────────────────────────────

export const PaymentProcessor: React.FC<PaymentProcessorProps> = ({
  reservationId,
  totalAmount,
  depositAmount,
  remainingAmount,
  checkInDate,
  locale,
  onSuccess,
  paymentContext,
}) => {
  const loc = safeLocale(locale);

  const [activeTab, setActiveTab] = useState<'pix' | 'card'>('pix');
  const [pixData,   setPixData]   = useState<PixPaymentData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Carga el PaymentIntent de PIX.
  const loadPix = useCallback(
    async (cached: PixPaymentData | null) => {
      if (cached) { return; }
      setLoading(true);
      setError(null);
      try {
        const res = await (paymentContext === 'apartment'
          ? paymentAPI.processApartmentDeposit(reservationId, 'mercadopago')
          : paymentAPI.processDeposit(reservationId, 'mercadopago', undefined, getBookingToken(reservationId)));
        const raw = (res as any).data;
        const p   = raw?.data?.payment ?? raw?.payment ?? raw?.data ?? raw;
        setPixData({
          paymentId:    p.paymentId,
          qrCode:       p.qrCode       ?? '',
          qrCodeBase64: p.qrCodeBase64,
          amount:       p.amount,
        });
      } catch {
        setError(T('error', loc));
      } finally {
        setLoading(false);
      }
    },
    [reservationId, loc, paymentContext]
  );

  // Carga PIX al montar (tab por defecto).
  useEffect(() => {
    loadPix(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabClick = async (tab: 'pix' | 'card') => {
    if (tab === activeTab) { return; }
    setActiveTab(tab);
    setError(null);
    if (tab === 'pix') { await loadPix(pixData); }
  };

  const handlePixSuccess = useCallback(
    (_data: { paymentId: string; amount: number }) => { onSuccess(); },
    [onSuccess]
  );
  const handleCardSuccess = useCallback(
    (_data: { paymentId: string; amount: number; currency: string }) => { onSuccess(); },
    [onSuccess]
  );
  const handlePaymentError = useCallback((err: Error) => { setError(err.message); }, []);

  const fmtBRL = (val: number) =>
    'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (iso: string) => {
    try {
      const fmt = loc === 'pt' ? 'pt-BR' : loc === 'es' ? 'es-AR' : 'en-US';
      return new Date(iso + 'T12:00:00').toLocaleDateString(fmt, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div style={S.wrap}>
      {/* ── Resumen del depósito ──────────────────────────────── */}
      <div style={S.summary}>
        <div style={S.row}>
          <span>{T('depositNow', loc)}</span>
          <span style={{ fontWeight: 600 }}>{fmtBRL(depositAmount)}</span>
        </div>
        <div style={S.row}>
          <span>{T('remainingCheckin', loc)} · {fmtDate(checkInDate)}</span>
          <span>{fmtBRL(remainingAmount)}</span>
        </div>
        <div style={S.rowTotal}>
          <span>{T('totalBooking', loc)}</span>
          <span>{fmtBRL(totalAmount)}</span>
        </div>
      </div>

      {/* ── Tabs de método de pago (PIX | Cartão) ───────────── */}
      <div style={S.tabs}>
        <button
          type="button"
          style={tabStyle(activeTab === 'pix')}
          onClick={() => handleTabClick('pix')}
          aria-pressed={activeTab === 'pix'}
        >
          PIX
          {activeTab === 'pix' && (
            <span style={S.pixBadge}>{T('pixRecommended', loc)}</span>
          )}
        </button>
        <button
          type="button"
          style={tabStyle(activeTab === 'card')}
          onClick={() => handleTabClick('card')}
          aria-pressed={activeTab === 'card'}
        >
          💳 {T('tabCard', loc)}
        </button>
      </div>

      {/* ── Contenido del método seleccionado ────────────────── */}
      <div style={S.body}>
        {error && (
          <div style={S.errorBox} role="alert">{error}</div>
        )}

        {loading ? (
          <div style={S.loadingBox}>{T('loading', loc)}</div>
        ) : activeTab === 'pix' ? (
          pixData && (
            <PixPayment
              paymentId={pixData.paymentId}
              qrCode={pixData.qrCode}
              qrCodeBase64={pixData.qrCodeBase64}
              amount={pixData.amount}
              locale={loc}
              reservationId={reservationId}
              confirmationToken={getBookingToken(reservationId)}
              onSuccess={handlePixSuccess}
              onError={handlePaymentError}
            />
          )
        ) : (
          /* Cartão — detección automática BR (MP) o Internacional (Stripe) */
          <AutoCardPayment
            reservationId={reservationId}
            depositAmount={depositAmount}
            locale={loc}
            onSuccess={handleCardSuccess}
            onError={handlePaymentError}
            paymentContext={paymentContext}
          />
        )}
      </div>
    </div>
  );
};
