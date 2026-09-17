'use client';
// frontend/src/components/booking/hostel-success-panel.tsx
// Panel de éxito tras confirmar la reserva: QR PIX o link de Stripe + timer de expiración.

import React, { useState } from 'react';
import { CheckCircle2, CreditCard, Check, Gift } from 'lucide-react';
import type { PayMethod, Translations } from './hostel-engine.types';
import { type calcPrice, fmtMoney } from './hostel-engine.utils';

type Price = ReturnType<typeof calcPrice>;

// PIX QR pattern decorativo — fallback si Mercado Pago no devuelve un QR real.
const PIX_PAT = [
  0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1,
  1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1,
];

interface HostelSuccessPanelProps {
  t: Translations;
  payMethod: PayMethod;
  bookingCode: string;
  price: Price;
  pixData: { qrCode: string; qrCodeBase64: string } | null;
  pixCopied: boolean;
  onPixCopy: () => void;
  stripeUrl: string | null;
  timerStr: string;
  onNewBooking: () => void;
  onSwitchMethod?: () => void;
  paymentInitFailed?: boolean;
  /** Código de referido propio, generado al confirmar (idea #49, roadmap.html). */
  referralCode?: string | null;
  /** Error al generar el link de pago con tarjeta — habilita botón de reintento. */
  paymentLinkError?: boolean;
  /** Indica que se está reintentando la generación del link de pago. */
  isRetryingPayment?: boolean;
  /** Callback para reintentar la generación del link de pago con tarjeta. */
  onRetryPaymentLink?: () => void;
}

export function HostelSuccessPanel({
  t,
  payMethod,
  bookingCode,
  price,
  pixData,
  pixCopied,
  onPixCopy,
  stripeUrl,
  timerStr,
  onNewBooking,
  onSwitchMethod,
  paymentInitFailed,
  referralCode,
  paymentLinkError,
  isRetryingPayment,
  onRetryPaymentLink,
}: HostelSuccessPanelProps) {
  const [referralCopied, setReferralCopied] = useState(false);
  const handleReferralCopy = () => {
    if (!referralCode) {
      return;
    }
    navigator.clipboard.writeText(referralCode).catch(() => {});
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 3000);
  };
  return (
    <div className="he-card">
      <div className="he-success-panel">
        <div className="he-success-check">
          <CheckCircle2 size={28} color="#1E5E40" aria-hidden />
        </div>
        <div className="he-success-title">{t.successTitle}</div>
        <div className="he-success-sub">{t.successSub}</div>
        <div className="he-booking-code">{bookingCode}</div>
        <div className="he-pay-box">
          {payMethod === 'pix' ? (
            <>
              <div className="he-pix-lbl">{t.pixDepLabel}</div>
              {paymentInitFailed && <div className="he-min-warn">{t.payInitFailedMsg}</div>}
              {pixData?.qrCodeBase64 ? (
                /* QR real de Mercado Pago */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR PIX"
                  className="he-pix-qr-img"
                />
              ) : !paymentInitFailed ? (
                /* fallback decorativo mientras se genera el QR real */
                <div className="he-pix-qr">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7,8px)',
                      gridTemplateRows: 'repeat(7,8px)',
                      gap: '1px',
                    }}
                  >
                    {PIX_PAT.map((b, i) => (
                      <div
                        key={i}
                        style={{
                          background: b ? '#fff' : 'transparent',
                          width: '8px',
                          height: '8px',
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="he-pix-amt">{price ? fmtMoney(price.deposit) : ''}</div>
              {pixData?.qrCode && (
                <button type="button" className="he-pix-copy-btn" onClick={onPixCopy}>
                  {pixCopied ? (
                    <>
                      <Check
                        size={13}
                        aria-hidden
                        style={{ display: 'inline', verticalAlign: '-2px', marginRight: '.3em' }}
                      />
                      Código copiado
                    </>
                  ) : (
                    'Copiar código PIX'
                  )}
                </button>
              )}
              <div className="he-pix-key">{t.pixKey}</div>
              <div className="he-timer">
                {t.timerLabel}: <strong>{timerStr}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="he-pix-lbl">{t.cardDepLabel}</div>
              <div style={{ margin: '.4rem 0', display: 'flex', justifyContent: 'center' }}>
                <CreditCard size={40} color="#7BC47F" aria-hidden />
              </div>
              <div className="he-pix-amt">{price ? fmtMoney(price.deposit) : ''}</div>
              {paymentInitFailed && <div className="he-min-warn">{t.payInitFailedMsg}</div>}
              {paymentLinkError && !stripeUrl && (
                <div className="he-min-warn" style={{ marginBottom: '.6rem' }}>
                  {t.paymentLinkErrorMsg}
                </div>
              )}
              {stripeUrl ? (
                <a
                  href={stripeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="he-stripe-link"
                >
                  {t.cardGoToPayment ?? 'Ir al pago con tarjeta →'}
                </a>
              ) : !paymentInitFailed ? (
                <>
                  <div
                    style={{
                      fontSize: '.72rem',
                      color: 'rgba(255,255,255,.7)',
                      marginTop: '.2rem',
                      textAlign: 'center',
                    }}
                  >
                    {t.cardInstruction}
                  </div>
                  {paymentLinkError && onRetryPaymentLink && (
                    <button
                      type="button"
                      className="he-btn-confirm"
                      style={{ marginTop: '.75rem' }}
                      disabled={isRetryingPayment}
                      onClick={onRetryPaymentLink}
                    >
                      {isRetryingPayment ? '...' : 'Reintentar'}
                    </button>
                  )}
                </>
              ) : null}
              <div className="he-timer">
                {t.timerLabel}: <strong>{timerStr}</strong>
              </div>
            </>
          )}
        </div>
        <div className="he-success-note">
          {payMethod === 'pix' && (
            <>
              {t.pixKey}
              <br />
            </>
          )}
          {t.restNote}
        </div>
        {referralCode && (
          <div className="he-rules" style={{ marginTop: '1rem', textAlign: 'left' }}>
            <div className="he-rules-title">
              <Gift size={14} color="#7BC47F" aria-hidden />
              {t.referralTitle}
            </div>
            <p style={{ fontSize: '.78rem', color: '#F0EDE0', margin: '0 0 .6rem' }}>
              {t.referralBody}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <code
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '.95rem',
                  fontWeight: 700,
                  letterSpacing: '.05em',
                  background: 'rgba(255,255,255,.08)',
                  border: '1px solid rgba(255,255,255,.15)',
                  borderRadius: '8px',
                  padding: '.5rem .75rem',
                  color: '#7BC47F',
                }}
              >
                {referralCode}
              </code>
              <button type="button" className="he-pix-copy-btn" onClick={handleReferralCopy}>
                {referralCopied ? (
                  <>
                    <Check
                      size={13}
                      aria-hidden
                      style={{ display: 'inline', verticalAlign: '-2px', marginRight: '.3em' }}
                    />
                    {t.referralCopied}
                  </>
                ) : (
                  t.referralCopy
                )}
              </button>
            </div>
          </div>
        )}
        {onSwitchMethod && (
          <button
            type="button"
            className="he-btn-back"
            style={{ marginTop: '1.25rem' }}
            onClick={onSwitchMethod}
          >
            {t.btnChangeMethod}
          </button>
        )}
        <button className="he-btn-confirm" style={{ marginTop: '.6rem' }} onClick={onNewBooking}>
          {t.btnNewBooking}
        </button>
      </div>
    </div>
  );
}
