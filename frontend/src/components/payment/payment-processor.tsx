// frontend/src/components/payment/payment-processor.tsx
// Motor de pago real: PIX (MercadoPago) + Tarjeta (Stripe).
// Reemplaza el enchufe temporal del preview.

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { paymentAPI } from '@/lib/api';
import { PixPayment } from './pix-payment';
import { CardPayment } from './card-payment';
import { StripeElementsWrapper } from './stripe-elements';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface PaymentProcessorProps {
  reservationId: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  checkInDate: string;
  locale: string;
  onSuccess: () => void;
}

interface PixPaymentData {
  paymentId: string;
  qrCode: string;
  qrCodeBase64?: string;
  amount: number;
}

interface CardPaymentData {
  paymentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  cardSurchargePercent: number;
}

// ── Helpers de localización ─────────────────────────────────────────────────

type SupportedLocale = 'pt' | 'es' | 'en' | 'fr' | 'de';

const SUPPORTED: SupportedLocale[] = ['pt', 'es', 'en', 'fr', 'de'];

function safeLocale(locale: string): SupportedLocale {
  return SUPPORTED.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : 'pt';
}

function T(key: string, locale: string): string {
  const dict: Record<string, Record<string, string>> = {
    pt: {
      tabPix:            'PIX',
      tabCard:           'Cartão de Crédito',
      pixRecommended:    '✓ Recomendado – sem taxa extra',
      depositNow:        'Depósito agora',
      remainingCheckin:  'Saldo no check-in',
      totalBooking:      'Total da reserva',
      surchargePct:      '+ {pct}% de taxa para cartão',
      loading:           'Preparando pagamento…',
      error:             'Erro ao iniciar o pagamento. Tente novamente.',
      checkIn:           'Check-in',
    },
    es: {
      tabPix:            'PIX',
      tabCard:           'Tarjeta de Crédito',
      pixRecommended:    '✓ Recomendado – sin cargo extra',
      depositNow:        'Depósito ahora',
      remainingCheckin:  'Saldo al check-in',
      totalBooking:      'Total de la reserva',
      surchargePct:      '+ {pct}% de recargo para tarjeta',
      loading:           'Preparando pago…',
      error:             'Error al iniciar el pago. Intentá de nuevo.',
      checkIn:           'Check-in',
    },
    en: {
      tabPix:            'PIX',
      tabCard:           'Credit Card',
      pixRecommended:    '✓ Recommended – no extra fee',
      depositNow:        'Deposit now',
      remainingCheckin:  'Balance at check-in',
      totalBooking:      'Booking total',
      surchargePct:      '+ {pct}% card surcharge',
      loading:           'Preparing payment…',
      error:             'Error initiating payment. Please try again.',
      checkIn:           'Check-in',
    },
    fr: {
      tabPix:            'PIX',
      tabCard:           'Carte de crédit',
      pixRecommended:    '✓ Recommandé – sans frais',
      depositNow:        'Dépôt maintenant',
      remainingCheckin:  'Solde au check-in',
      totalBooking:      'Total de la réservation',
      surchargePct:      '+ {pct}% de frais carte',
      loading:           'Préparation du paiement…',
      error:             'Erreur lors du paiement. Réessayez.',
      checkIn:           'Check-in',
    },
    de: {
      tabPix:            'PIX',
      tabCard:           'Kreditkarte',
      pixRecommended:    '✓ Empfohlen – kein Aufpreis',
      depositNow:        'Anzahlung jetzt',
      remainingCheckin:  'Restbetrag beim Check-in',
      totalBooking:      'Reservierungsgesamt',
      surchargePct:      '+ {pct}% Kartengebühr',
      loading:           'Zahlung wird vorbereitet…',
      error:             'Fehler beim Starten der Zahlung. Bitte erneut versuchen.',
      checkIn:           'Check-in',
    },
  };
  return dict[locale]?.[key] ?? dict['pt']?.[key] ?? key;
}

// ── Estilos inline con las CSS vars del apartment engine ────────────────────
// Las vars --primary, --accent, --border, --bg-card, --fg, --primary-soft
// están definidas en apartment-engine.module.css y se propagan globalmente.

// No se usa Record<string, CSSProperties> para evitar que noUncheckedIndexedAccess
// haga que S.xxx sea CSSProperties | undefined cuando se usa como prop `style`.
const S = {
  wrap: {
    border:       '1.5px solid var(--border, #ddd)',
    borderRadius: 12,
    background:   'var(--bg-card, #fff)',
    color:        'var(--fg, #111)',
    overflow:     'hidden',
  },
  summary: {
    padding:      '1rem 1.25rem',
    borderBottom: '1px solid var(--border, #ddd)',
    display:      'flex',
    flexDirection:'column',
    gap:          '.3rem',
  },
  row: {
    display:        'flex',
    justifyContent: 'space-between',
    fontSize:       '.85rem',
  },
  rowTotal: {
    display:        'flex',
    justifyContent: 'space-between',
    fontWeight:     700,
    fontSize:       '.9rem',
    paddingTop:     '.3rem',
    borderTop:      '1px solid var(--border, #ddd)',
    marginTop:      '.2rem',
  },
  tabs: {
    display:  'flex',
    gap:      '.5rem',
    padding:  '1rem 1.25rem .5rem',
  },
  body: {
    padding: '1rem 1.25rem 1.25rem',
  },
  loadingBox: {
    padding:    '2rem',
    textAlign:  'center',
    color:      'var(--fg-muted, #666)',
    fontSize:   '.9rem',
  },
  errorBox: {
    padding:      '.75rem 1rem',
    borderRadius: 8,
    background:   '#fff0f0',
    border:       '1px solid #fca5a5',
    color:        '#991b1b',
    fontSize:     '.85rem',
    marginBottom: '1rem',
  },
  surchargeBadge: {
    marginBottom: '.75rem',
    padding:      '.5rem .75rem',
    borderRadius: 8,
    background:   '#fffbeb',
    border:       '1px solid #fde68a',
    color:        '#92400e',
    fontSize:     '.78rem',
  },
  pixBadge: {
    display:    'block',
    fontSize:   '.7rem',
    fontWeight: 400,
    color:      'var(--success, #1a7a4c)',
    marginTop:  '.15rem',
  },
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex:        1,
    padding:     '.55rem .5rem',
    borderRadius: 8,
    border:      `1.5px solid ${active ? 'var(--primary, #2C4A8C)' : 'var(--border, #ddd)'}`,
    background:  active ? 'var(--primary-soft, #e8eefc)' : 'transparent',
    color:       active ? 'var(--primary, #2C4A8C)' : 'var(--fg, #111)',
    fontWeight:  active ? 700 : 400,
    fontSize:    '.82rem',
    cursor:      'pointer',
    textAlign:   'center',
    lineHeight:  1.3,
    transition:  'all .15s',
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
}) => {
  const loc = safeLocale(locale);

  const [activeTab,  setActiveTab]  = useState<'pix' | 'card'>('pix');
  const [pixData,    setPixData]    = useState<PixPaymentData | null>(null);
  const [cardData,   setCardData]   = useState<CardPaymentData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Llama al backend para crear el payment intent del proveedor indicado.
  // Si ya tenemos los datos en caché, no vuelve a llamar.
  const loadPayment = useCallback(
    async (tab: 'pix' | 'card', cached: { pix: PixPaymentData | null; card: CardPaymentData | null }) => {
      if (tab === 'pix'  && cached.pix)  return;
      if (tab === 'card' && cached.card) return;

      setLoading(true);
      setError(null);

      try {
        const provider = tab === 'pix' ? 'mercadopago' : 'stripe';
        const res = await paymentAPI.processDeposit(reservationId, provider);

        // El backend devuelve ApiResponse.success({ payment: {...} })
        // → axios res.data = { success, data: { payment: {...} } }
        // Desempacamos de forma defensiva.
        const raw = res.data;
        const p   = raw?.data?.payment ?? raw?.payment ?? raw?.data ?? raw;

        if (tab === 'pix') {
          setPixData({
            paymentId:     p.paymentId,
            qrCode:        p.qrCode        ?? '',
            qrCodeBase64:  p.qrCodeBase64,
            amount:        p.amount,
          });
        } else {
          setCardData({
            paymentId:           p.paymentId,
            clientSecret:        p.clientSecret      ?? '',
            amount:              p.amount,
            currency:            p.currency          ?? 'BRL',
            cardSurchargePercent: p.cardSurchargePercent ?? 0,
          });
        }
      } catch (_err) {
        setError(T('error', loc));
      } finally {
        setLoading(false);
      }
    },
    [reservationId, loc]
  );

  // Carga PIX al montar (tab por defecto).
  useEffect(() => {
    loadPayment('pix', { pix: null, card: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabClick = async (tab: 'pix' | 'card') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setError(null);
    // Pasamos el snapshot actual del caché para que loadPayment lo evalúe.
    await loadPayment(tab, { pix: pixData, card: cardData });
  };

  const handlePixSuccess = useCallback(
    (_data: { paymentId: string; amount: number }) => { onSuccess(); },
    [onSuccess]
  );
  const handleCardSuccess = useCallback(
    (_data: { paymentId: string; amount: number; currency: string }) => { onSuccess(); },
    [onSuccess]
  );
  const handlePaymentError = useCallback(
    (err: Error) => { setError(err.message); },
    []
  );

  const fmtBRL = (val: number) =>
    'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (iso: string) => {
    try {
      const fmt = loc === 'pt' ? 'pt-BR' : loc === 'es' ? 'es-AR' : 'en-US';
      return new Date(iso).toLocaleDateString(fmt, { day: '2-digit', month: 'short', year: 'numeric' });
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

      {/* ── Tabs de método de pago ────────────────────────────── */}
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
          {T('tabCard', loc)}
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
              onSuccess={handlePixSuccess}
              onError={handlePaymentError}
            />
          )
        ) : (
          cardData && (
            <>
              {cardData.cardSurchargePercent > 0 && (
                <div style={S.surchargeBadge}>
                  {T('surchargePct', loc).replace('{pct}', String(cardData.cardSurchargePercent))}
                </div>
              )}
              <StripeElementsWrapper
                clientSecret={cardData.clientSecret}
                amount={cardData.amount}
                currency={cardData.currency}
              >
                <CardPayment
                  paymentId={cardData.paymentId}
                  clientSecret={cardData.clientSecret}
                  amount={cardData.amount}
                  currency={cardData.currency}
                  locale={loc}
                  onSuccess={handleCardSuccess}
                  onError={handlePaymentError}
                />
              </StripeElementsWrapper>
            </>
          )
        )}
      </div>
    </div>
  );
};
