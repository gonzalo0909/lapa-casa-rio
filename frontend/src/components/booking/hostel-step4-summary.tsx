'use client';
// frontend/src/components/booking/hostel-step4-summary.tsx
// Step 4 — Resumen de la reserva: fechas/cuartos, precio, datos del huésped,
// selector de método de pago y botones de confirmación.

import React from 'react';
import { CreditCard, MessageCircle, Zap } from 'lucide-react';
import type { FormState, PayMethod, PriceQuote, RoomDef, Translations } from './hostel-engine.types';
import { fmtDate, fmtMoney } from './hostel-engine.utils';
import type { CurrencyInfo } from '@/hooks/use-currency';

interface HostelStep4SummaryProps {
  t: Translations;
  form: FormState;
  price: PriceQuote;
  checkIn: Date;
  checkOut: Date;
  rooms: RoomDef[];
  beds: Record<string, number>;
  payMethod: PayMethod;
  onPayMethodChange: (m: PayMethod) => void;
  /** 1 + system_config.card_surcharge_percent/100 -- real, no hardcodear 1.10 acá (ver hostel-engine.tsx). */
  cardSurchargeMult: number;
  currency: CurrencyInfo | null;
  convertBRL: (v: number, currency: CurrencyInfo) => string;
  bookingError: string;
  isProcessing: boolean;
  isWaLoading: boolean;
  onConfirm: () => void;
  onWaClick: () => void;
}

export function HostelStep4Summary({
  t, form, price, checkIn, checkOut, rooms, beds, payMethod, onPayMethodChange,
  currency, convertBRL, bookingError,
  isProcessing, isWaLoading,
  onConfirm, onWaClick, cardSurchargeMult,
}: HostelStep4SummaryProps) {
  const selR = rooms.filter(r => (beds[r.id] ?? 0) > 0);
  const mult       = payMethod === 'card' ? cardSurchargeMult : 1;
  const depositAmt = Math.round(price.deposit * mult);
  const remaining  = Math.round((price.total - price.deposit) * mult);

  return (
    <div className="he-panel">
      <div className="he-panel-title">{t.p4title}</div>
      <div className="he-panel-sub">{t.p4sub}</div>

      <div className="he-sum-sec">
        <div className="he-sum-head">{t.sumDatesHead}</div>
        <div className="he-sum-rows">
          {[
            [t.checkin,  fmtDate(checkIn)],
            [t.checkout, fmtDate(checkOut)],
            [t.tNights, String(price.nights)],
            ...selR.map((r): [string, string] => {
              const cnt = beds[r.id] ?? 0;
              return [r.name, `${cnt} ${cnt > 1 ? t.tBeds : t.tBed}`];
            }),
            [t.tTotalBeds, String(price.beds)],
          ].map(([k, v], i) => (
            <div key={i} className="he-sum-row"><span>{k}</span><span>{v}</span></div>
          ))}
        </div>
      </div>

      <div className="he-sum-sec">
        <div className="he-sum-head">{t.sumPriceHead}</div>
        <div className="he-sum-rows">
          <div className="he-sum-row">
            <span>{fmtMoney(price.pbn)}/{t.tBed}/{t.tNightAbbr}</span>
            <span>{price.beds} {price.beds === 1 ? t.tBed : t.tBeds} × {price.nights} {price.nights === 1 ? t.tNight : t.tNights2}</span>
          </div>
          <div className="he-sum-row">
            <span>{t.tSubtotal} ({price.beds} {t.tBeds} × {price.nights} {t.tNights2})</span>
            <span>{fmtMoney(price.subtotal)}</span>
          </div>
          <div className="he-sum-row total">
            <span>{t.tTotal}</span>
            <span>
              {fmtMoney(Math.round(price.total * mult))}
              {currency && <span className="he-conv-inline">{convertBRL(Math.round(price.total * mult), currency)}</span>}
            </span>
          </div>
        </div>
      </div>

      <div className="he-dep-box">
        <div className="he-dep-half">
          <div className="he-dep-lbl">{form.country === 'BR' ? t.tDepositNow : t.cardDepLabel}</div>
          <div className="he-dep-amt">{fmtMoney(depositAmt)}</div>
          {currency && <div className="he-conv">{convertBRL(depositAmt, currency)}</div>}
          <div className="he-dep-note">
            {payMethod === 'card' ? t.pmCardTotal : `${Math.round((price.deposit / price.total) * 100)}%`}
          </div>
        </div>
        <div className="he-dep-half">
          <div className="he-dep-lbl">{100 - Math.round((price.deposit / price.total) * 100)}% {t.tAtCheckin}</div>
          <div className="he-dep-amt">{fmtMoney(remaining)}</div>
          {currency && <div className="he-conv">{convertBRL(remaining, currency)}</div>}
          <div className="he-dep-note">{t.checkin}</div>
        </div>
      </div>

      <div className="he-sum-sec">
        <div className="he-sum-head">{t.sumGuestHead}</div>
        <div className="he-sum-rows">
          <div className="he-sum-row"><span>{t.lblName}</span><span>{form.name}</span></div>
          <div className="he-sum-row"><span>{t.lblEmail}</span><span>{form.email}</span></div>
          <div className="he-sum-row"><span>{t.lblPhone}</span><span>{form.phone}</span></div>
          <div className="he-sum-row"><span>{t.tCountryLabel}</span><span>{form.country}</span></div>
          <div className="he-sum-row"><span>{t.lblArrival}</span><span>{form.arrival}</span></div>
        </div>
      </div>

      <div className="he-pay-methods">
        {/* ── PIX ── (habilitado para cualquier país — no restringir por form.country) */}
        <button type="button" className={`he-pay-m${payMethod === 'pix' ? ' selected' : ''}`} onClick={() => onPayMethodChange('pix')}>
          <input type="radio" name="he-pay" value="pix" checked={payMethod === 'pix'} readOnly style={{ flexShrink: 0, accentColor: '#2A5234' }} />
          <div className="he-pm-info">
            <div className="he-pm-name">
              <Zap size={13} aria-hidden />{t.pmPix}
            </div>
            <div className="he-pm-detail">{fmtMoney(price.deposit)} · {fmtMoney(price.total - price.deposit)} {t.tAtCheckin}</div>
          </div>
        </button>
        {/* ── Tarjeta ── */}
        <button type="button" className={`he-pay-m${payMethod === 'card' ? ' selected' : ''}`} onClick={() => onPayMethodChange('card')}>
          <input type="radio" name="he-pay" value="card" checked={payMethod === 'card'} readOnly style={{ flexShrink: 0, accentColor: '#2A5234' }} />
          <div className="he-pm-info">
            <div className="he-pm-name">
              <CreditCard size={13} aria-hidden />{t.pmCard}
            </div>
            <div className="he-pm-detail">
              {fmtMoney(Math.round(price.deposit * cardSurchargeMult))} · {fmtMoney(Math.round((price.total - price.deposit) * cardSurchargeMult))} {t.tAtCheckin}
            </div>
          </div>
        </button>
      </div>
      <div className="he-pm-note">{t.pmNote}</div>

      {bookingError && <div className="he-toast" style={{ margin: '0 0 .75rem' }}>{bookingError}</div>}

      <button className="he-btn-confirm" onClick={onConfirm} disabled={isProcessing}>
        {isProcessing ? '…' : t.btnConfirm}
      </button>
      <button className="he-btn-wa" onClick={onWaClick} disabled={isWaLoading}>
        <MessageCircle size={16} aria-hidden />
        {isWaLoading ? '…' : t.btnWhatsApp}
      </button>
    </div>
  );
}

