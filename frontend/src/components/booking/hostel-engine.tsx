'use client';
// Orquestador slim — setup de idioma, llama a los 3 hooks, renderiza JSX.

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { offersAPI } from '@/lib/api';
import { useCurrency, convertBRL } from '@/hooks/use-currency';
import type { BookingLocale } from '@/types/global';
import { T } from './hostel-engine.types';
import { HOSTEL_ENGINE_CSS } from './hostel-engine.styles';
import { HostelCalendar } from './hostel-calendar';
import { HostelRoomSelector } from './hostel-room-selector';
import { HostelGuestForm } from './hostel-guest-form';
import { HostelInfoBanner } from './hostel-info-banner';
import { useHostelWizard } from './use-hostel-wizard';
import { useHostelPricing } from './use-hostel-pricing';
import { useHostelPayment } from './use-hostel-payment';
import { fmtMoney, toBackendLang } from './hostel-engine.utils';

const HostelStep4Summary = dynamic(() =>
  import('./hostel-step4-summary').then((m) => m.HostelStep4Summary),
);
const HostelSuccessPanel = dynamic(() =>
  import('./hostel-success-panel').then((m) => m.HostelSuccessPanel),
);
const HostelExpiredPanel = dynamic(() =>
  import('./hostel-expired-panel').then((m) => m.HostelExpiredPanel),
);
const HostelGroupPanel = dynamic(() =>
  import('./hostel-group-panel').then((m) => m.HostelGroupPanel),
);

interface HostelEngineProps {
  locale?: string;
}

const SUPPORTED_LOCALES: BookingLocale[] = ['pt', 'es', 'en', 'fr', 'de', 'it'];

export function HostelEngine({ locale = 'pt' }: HostelEngineProps) {
  const initLang: BookingLocale = SUPPORTED_LOCALES.includes(locale as BookingLocale)
    ? (locale as BookingLocale)
    : 'pt';
  const [lang, setLang] = useState<BookingLocale>(initLang);
  const t = T[lang];
  const backendLang = toBackendLang(lang);
  const currency = useCurrency();

  const wizard = useHostelWizard(t);

  const { price, cardSurchargeMult, footerPrice } = useHostelPricing({
    checkIn: wizard.checkIn,
    checkOut: wizard.checkOut,
    beds: wizard.beds,
    rooms: wizard.rooms,
    totalBeds: wizard.totalBeds,
    t,
  });

  const payment = useHostelPayment({
    t, backendLang,
    price, cardSurchargeMult,
    form: wizard.form,
    beds: wizard.beds,
    rooms: wizard.rooms,
    checkIn: wizard.checkIn,
    checkOut: wizard.checkOut,
    totalBeds: wizard.totalBeds,
    appliedCoupon: wizard.appliedCoupon,
    gpName: wizard.gpName,
    gpEmail: wizard.gpEmail,
    setForm: wizard.setForm,
    setStep: wizard.setStep,
    resetWizard: wizard.resetWizard,
  });

  // ─── JSX ────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HOSTEL_ENGINE_CSS }} />
      <div className="he-wrap">
        {/* Volver al home */}
        <div className="he-nav-bar">
          <Link href="/" className="he-nav-link">{t.navHome}</Link>
          <Link href={`/${lang}/santa-teresa`} className="he-nav-link">Santa Teresa</Link>
        </div>

        {/* Header */}
        <div className="he-header">
          <div className="he-brand-loc">Santa Teresa · Rio de Janeiro</div>
          <h1 className="he-brand">
            Lapa Casa
            <span>Hostel</span>
          </h1>
          <div className="he-lang-sw">
            {SUPPORTED_LOCALES.map((l) => (
              <button
                key={l}
                className={`he-lang-btn${lang === l ? ' active' : ''}`}
                onClick={() => setLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Info importante ── */}
        <HostelInfoBanner lang={lang} />

        {/* ── Panel Wizard ── */}
        {payment.phase === 'wizard' && (
          <div className="he-card">
            {/* Step tracker */}
            <div className="he-steps">
              {[t.step1, t.step2, t.step3, t.step4].map((lbl, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div className={`he-step-conn${wizard.step > i ? ' done' : ''}`} />}
                  <div
                    className={`he-step-item${wizard.step === i + 1 ? ' active' : wizard.step > i + 1 ? ' done' : ''}`}
                  >
                    <div
                      className={`he-step-badge${wizard.step === i + 1 ? ' active' : wizard.step > i + 1 ? ' done' : ''}`}
                    >
                      {i + 1}
                    </div>
                    <div className="he-step-lbl">{lbl}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {wizard.toast && <div className="he-toast">{wizard.toast}</div>}

            {/* Step 1 — Calendario */}
            {wizard.step === 1 && (
              <HostelCalendar
                lang={lang}
                calMonth={wizard.calMonth}
                checkIn={wizard.checkIn}
                checkOut={wizard.checkOut}
                hoverDate={wizard.hoverDate}
                selectingEnd={wizard.selectingEnd}
                today={new Date()}
                onCalClick={wizard.handleCalClick}
                onMonthChange={wizard.handleMonthChange}
                onHoverDate={wizard.setHoverDate}
              />
            )}

            {/* Step 2 — Cuartos */}
            {wizard.step === 2 && (
              <>
                {!wizard.roomsLoaded ? (
                  <div className="he-panel" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--he-muted)' }}>
                    <div className="he-spinner" />
                  </div>
                ) : (
                  <HostelRoomSelector
                    lang={lang}
                    rooms={wizard.visibleRooms}
                    beds={wizard.beds}
                    revealed={wizard.revealed}
                    onChangeBeds={wizard.changeBeds}
                  />
                )}

                {/* ── Pago grupal (solo si hay 2+ camas y hay fechas) ── */}
                {wizard.totalBeds >= 2 && wizard.checkIn && wizard.checkOut && (
                  <>
                    <div className="he-or-divider">{t.gpOr}</div>
                    <div className="he-group-box">
                      <div className="he-group-title">{t.gpTitle}</div>
                      <div className="he-group-desc">{t.gpDesc}</div>
                      <div className="he-group-meta">
                        {wizard.totalBeds} {wizard.totalBeds === 1 ? t.tBed : t.tBeds} · {t.gpMetaEach}{' '}
                        {price ? fmtMoney(Math.round(price.total / wizard.totalBeds)) : ''}
                      </div>
                      <label htmlFor="he-gp-name" className="sr-only">
                        {t.lblName ?? 'Nome completo'}
                      </label>
                      <input
                        id="he-gp-name"
                        className="he-group-input"
                        type="text"
                        placeholder={t.lblName ?? 'Nome completo'}
                        value={wizard.gpName}
                        onChange={(e) => wizard.setGpName(e.target.value)}
                        autoComplete="name"
                      />
                      <label htmlFor="he-gp-email" className="sr-only">
                        {t.lblEmail ?? 'E-mail'}
                      </label>
                      <input
                        id="he-gp-email"
                        className="he-group-input"
                        type="email"
                        placeholder={t.lblEmail ?? 'E-mail'}
                        value={wizard.gpEmail}
                        onChange={(e) => wizard.setGpEmail(e.target.value)}
                        autoComplete="email"
                      />
                      {payment.groupError && <div className="he-group-err">{payment.groupError}</div>}
                      <button
                        className="he-btn-group"
                        onClick={payment.handleGroupSession}
                        disabled={payment.isGroupLoading || !wizard.gpName.trim() || !wizard.gpEmail.trim()}
                      >
                        {payment.isGroupLoading ? t.gpLoading : t.gpBtn}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Step 3 — Formulario del huésped */}
            {wizard.step === 3 && (
              <HostelGuestForm
                lang={lang}
                form={wizard.form}
                formErrors={wizard.formErrors}
                docFeedback={wizard.docFeedback}
                emailFb={wizard.emailFb}
                phoneFb={wizard.phoneFb}
                cancelOpen={wizard.cancelOpen}
                onFormChange={wizard.handleFormChange}
                onFormErrors={wizard.handleFormErrors}
                onDocFeedback={wizard.setDocFeedback}
                onEmailFb={wizard.setEmailFb}
                onPhoneFb={wizard.setPhoneFb}
                onCancelToggle={() => wizard.setCancelOpen((o) => !o)}
                appliedCoupon={wizard.appliedCoupon}
                onCouponApply={wizard.setAppliedCoupon}
                onCouponRemove={() => wizard.setAppliedCoupon(null)}
                onValidateCoupon={async (code) => {
                  const res = await offersAPI.validate(
                    code,
                    undefined,
                    wizard.checkIn ? wizard.checkIn.toISOString().slice(0, 10) : '',
                  );
                  return res.data;
                }}
              />
            )}

            {/* Step 4 — Resumen */}
            {wizard.step === 4 && price && wizard.checkIn && wizard.checkOut && (
              <HostelStep4Summary
                t={t}
                form={wizard.form}
                price={price}
                checkIn={wizard.checkIn}
                checkOut={wizard.checkOut}
                rooms={wizard.rooms}
                beds={wizard.beds}
                payMethod={payment.payMethod}
                onPayMethodChange={payment.setPayMethod}
                cardSurchargeMult={cardSurchargeMult}
                currency={currency}
                convertBRL={convertBRL}
                bookingError={payment.bookingError}
                isProcessing={payment.isProcessing}
                isWaLoading={payment.isWaLoading}
                onConfirm={payment.handleConfirm}
                onWaClick={payment.handleWaClick}
              />
            )}

            {/* Footer con precio y navegación */}
            <div className="he-foot">
              <div>
                <div className="he-price-main">{footerPrice.main}</div>
                <div className="he-price-sub">{footerPrice.sub}</div>
                {currency && price && (
                  <div className="he-conv">{convertBRL(price.total, currency)}</div>
                )}
              </div>
              <div className="he-foot-btns">
                {wizard.step > 1 && (
                  <button
                    className="he-btn-back"
                    onClick={() => wizard.setStep((s) => Math.max(1, s - 1))}
                  >
                    {t.btnBack}
                  </button>
                )}
                {wizard.step < 4 && (
                  <button className="he-btn-next" onClick={wizard.goNext}>
                    {t.btnNext}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Panel Éxito ── */}
        {payment.phase === 'success' && (
          <HostelSuccessPanel
            t={t}
            payMethod={payment.payMethod}
            bookingCode={payment.bookingCode}
            price={price}
            pixData={payment.pixData}
            pixCopied={payment.pixCopied}
            onPixCopy={payment.handlePixCopy}
            stripeUrl={payment.stripeUrl}
            timerStr={payment.timerStr}
            onNewBooking={payment.handleNewBooking}
            onSwitchMethod={wizard.form.country === 'BR' ? payment.handleSwitchPayMethod : undefined}
            paymentInitFailed={payment.paymentInitFailed}
            paymentLinkError={payment.paymentLinkError}
            isRetryingPayment={payment.isRetryingPayment}
            onRetryPaymentLink={payment.handleRetryPaymentLink}
            referralCode={payment.ownReferralCode}
            cardSurchargeMult={cardSurchargeMult}
          />
        )}

        {/* ── Panel Expirado ── */}
        {payment.phase === 'expired' && <HostelExpiredPanel t={t} onTryAgain={payment.handleNewBooking} />}

        {/* ── Panel Link Grupal ── */}
        {payment.phase === 'group' && (
          <HostelGroupPanel
            t={t}
            totalBeds={payment.groupTotalBeds}
            groupResNum={payment.groupResNum}
            groupWaUrl={payment.groupWaUrl}
            groupAmountPerBed={payment.groupAmountPerBed}
            onBookOwnBed={payment.handleBookOwnBed}
          />
        )}
      </div>
    </>
  );
}
