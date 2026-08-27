// frontend/src/components/booking/apartment-guest-form.tsx
//
// Paso 3 del motor de reservas de apartamentos:
// Resumen de la reserva + formulario de datos del huésped.
// Extraído del monolito apartment-engine.tsx (bloque step === 3).

'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Tag, MapPin, Check, X, AlertTriangle, KeyRound, DoorOpen, FileText,
  Ban, CigaretteOff, CreditCard, Lock, Zap, RotateCcw, ChevronDown, MessageCircle,
  Users, ShieldCheck, Trash2,
} from 'lucide-react';
import styles from './apartment-engine.module.css';
import { CHECKIN_TIMES } from './apartment-engine.types';
import { validateCPF, formatCPF, isEmailFmt, formatBRPhone, fmtDate } from './apartment-engine.utils';
import type { ApartmentAvailability } from '@/types/global';
import type { GuestForm, AptLocale, AdditionalGuest } from './apartment-engine.types';

interface ApartmentGuestFormProps {
  locale: AptLocale;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  selectedApartment: ApartmentAvailability;
  guestForm: GuestForm;
  touched: Record<string, boolean>;
  isCreatingBooking: boolean;
  error: string | null;
  onFieldChange: (field: keyof GuestForm, value: string) => void;
  onFieldBlur: (field: string) => void;
  onReserve: () => void;
  onBack: () => void;
  /** Acompañantes declarados (excluye al titular) */
  additionalGuests: AdditionalGuest[];
  onAdditionalGuestsChange: (guests: AdditionalGuest[]) => void;
}

export const ApartmentGuestForm: React.FC<ApartmentGuestFormProps> = ({
  locale,
  checkIn,
  checkOut,
  nights,
  guestCount,
  selectedApartment,
  guestForm,
  touched,
  isCreatingBooking,
  error,
  onFieldChange,
  onFieldBlur,
  onReserve,
  onBack,
  additionalGuests,
  onAdditionalGuestsChange,
}) => {
  const t = useTranslations('apartments');

  // ── Estado local ───────────────────────────────────────────────────────────
  const [cancelOpen, setCancelOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // ── Cálculos derivados de props (variables locales, no estado) ─────────────
  const totalPrice = selectedApartment.priceTotal;
  const otaPrice = Math.round(totalPrice * 1.15);
  const otaSaving = otaPrice - totalPrice;
  const depositAmount = selectedApartment.depositAmount;
  const depositPct = totalPrice > 0 ? Math.round((depositAmount / totalPrice) * 100) : 0;
  const isCarnaval = selectedApartment.seasonType === 'carnaval';

  const emailOk = guestForm.email ? isEmailFmt(guestForm.email) : null;
  const confirmEmailOk = guestForm.confirmEmail
    ? (isEmailFmt(guestForm.email) && guestForm.confirmEmail === guestForm.email)
    : null;
  const phoneOk = guestForm.phone ? guestForm.phone.replace(/\D/g, '').length >= 10 : null;
  const cpfHasLetter = /[a-zA-Z]/.test(guestForm.document);
  const cpfDigits = guestForm.document.replace(/\D/g, '');
  // null = untouched/empty (no border), true = valid, false = invalid (red border)
  // When touched and document is absent or partial (< 11 digits), show invalid.
  const cpfOk = !guestForm.document
    ? null
    : cpfHasLetter
    ? true
    : cpfDigits.length === 11
    ? validateCPF(cpfDigits)
    : false;  // partial CPF: invalid once touched

  const canReserve = !!(
    guestForm.fullName.trim() &&
    emailOk && confirmEmailOk && phoneOk &&
    (cpfOk === true) &&
    guestForm.arrivalTime &&
    termsAccepted
  );

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const whatsappMsg = encodeURIComponent(
    t('whatsappMessage', {
      name: selectedApartment.name,
      checkin: fmtDate(checkIn, locale),
      checkout: fmtDate(checkOut, locale),
      nights,
      total: totalPrice.toLocaleString('pt-BR'),
    })
  );


  // canReserve is computed above and available for use; the actual gate lives in
  // the parent's onReserve handler, which calls setTouched before checking it.
  void canReserve;

  // ── Acompañantes: helpers ──────────────────────────────────────────────────
  /** Cuántos acompañantes puede declarar: guestCount - 1 (titular ya cuenta como 1) */
  const maxAdditional = Math.max(0, guestCount - 1);

  /** Valida el documento de un acompañante (misma lógica que el titular) */
  function docOk(doc: string): boolean | null {
    if (!doc) { return null; }
    if (/[a-zA-Z]/.test(doc)) { return true; } // pasaporte — se acepta
    const digits = doc.replace(/\D/g, '');
    if (digits.length === 11) { return validateCPF(digits); }
    return false; // incompleto
  }

  function updateAdditionalGuest(index: number, field: keyof AdditionalGuest, value: string) {
    const updated = additionalGuests.map((g, i) =>
      i === index ? { ...g, [field]: field === 'document' ? (/[a-zA-Z]/.test(value) ? value : formatCPF(value)) : value } : g
    );
    onAdditionalGuestsChange(updated);
  }

  function addGuest() {
    if (additionalGuests.length >= maxAdditional) { return; }
    onAdditionalGuestsChange([
      ...additionalGuests,
      { id: crypto.randomUUID(), fullName: '', document: '' },
    ]);
  }

  function removeGuest(index: number) {
    onAdditionalGuestsChange(additionalGuests.filter((_, i) => i !== index));
  }

  return (
    <div>
      {/* Banner OTA */}
      <div className={styles.otaBanner}>
        <Tag size={15} />
        <span>{t.rich('otaBanner', { b: (chunks) => <strong>{chunks}</strong>, saving: otaSaving.toLocaleString('pt-BR') })}</span>
      </div>

      {/* Tarjeta de resumen */}
      <div className={styles.summaryCard}>
        <h3>{t('bookingSummary')}</h3>
        <div className={styles.summaryRows}>
          <div className={styles.summaryRow}>
            <span>{t('apartment')}</span>
            <span className={styles.summaryRowBold}>{selectedApartment.name}</span>
          </div>
          {selectedApartment.neighborhood && (
            <div className={styles.summaryRow}>
              <span>{t('location')}</span>
              <span className={styles.summaryRowBold}>{selectedApartment.neighborhood}</span>
            </div>
          )}
          <div className={styles.summaryRow}>
            <span>{t('guests')}</span>
            <span>{t('guestCount', { count: guestCount })}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>{t('checkIn')}</span>
            <span>{fmtDate(checkIn, locale)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>{t('checkOut')}</span>
            <span>{fmtDate(checkOut, locale)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>{t('nights2')}</span>
            <span>{nights}</span>
          </div>
          {/* Season row removed: price already shows total, no need to expose internal multipliers */}
          <div className={`${styles.summaryRow} ${styles.totalRow}`}>
            <span>{t('total')}</span>
            <span className={styles.totalPrice}>R$ {totalPrice.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>

      {/* Teaser de ubicación */}
      <div className={styles.addrTeaser}>
        <div className={styles.addrIcon}><MapPin size={20} /></div>
        <div>
          <div className={styles.addrLabel}>{t('location')}</div>
          <div className={styles.addrNeighborhood}>{t('locationValue')}</div>
          <div className={styles.addrNote}>{t('addressNote')}</div>
        </div>
      </div>

      {/* Formulario de huésped */}
      <div className={styles.guestForm}>
        <h3>{t('guestDataTitle')}</h3>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.formGrid}>
          {/* Nombre completo */}
          <div className={styles.formField}>
            <label htmlFor="apt-guest-name">
              {t('fullNameLabel')} <span className={styles.req}>*</span>
            </label>
            <input
              id="apt-guest-name"
              type="text"
              placeholder={t('fullNamePlaceholder')}
              value={guestForm.fullName}
              onChange={(e) => onFieldChange('fullName', e.target.value)}
              onBlur={() => onFieldBlur('fullName')}
              className={touched.fullName && !guestForm.fullName.trim() ? styles.inputInvalid : ''}
            />
          </div>

          {/* Email */}
          <div className={styles.formField}>
            <label htmlFor="apt-guest-email">
              {t('emailLabel')} <span className={styles.req}>*</span>
            </label>
            <input
              id="apt-guest-email"
              type="email"
              placeholder={t('emailPlaceholder')}
              autoComplete="off"
              value={guestForm.email}
              onChange={(e) => onFieldChange('email', e.target.value)}
              onBlur={() => onFieldBlur('email')}
              onPaste={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              className={
                emailOk === true
                  ? styles.inputValid
                  : touched.email && emailOk === false
                  ? styles.inputInvalid
                  : ''
              }
            />
            {touched.email && guestForm.email && (
              <span className={`${styles.feedback} ${emailOk ? styles.feedbackOk : styles.feedbackErr}`}>
                {emailOk
                  ? <><Check size={13} /> {t('emailValid')}</>
                  : <><X size={13} /> {t('emailInvalid')}</>}
              </span>
            )}
          </div>

          {/* Confirmar email */}
          <div className={styles.formField}>
            <label htmlFor="apt-guest-email-confirm">
              {t('confirmEmailLabel')} <span className={styles.req}>*</span>{' '}
              <span style={{ fontSize: '.65rem', fontWeight: 400, color: 'var(--fg-muted)' }}>
                {t('confirmEmailHint')}
              </span>
            </label>
            <input
              id="apt-guest-email-confirm"
              type="email"
              placeholder={t('confirmEmailPlaceholder')}
              autoComplete="off"
              value={guestForm.confirmEmail}
              onChange={(e) => onFieldChange('confirmEmail', e.target.value)}
              onBlur={() => onFieldBlur('confirmEmail')}
              onPaste={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              className={
                confirmEmailOk === true
                  ? styles.inputValid
                  : touched.confirmEmail && confirmEmailOk === false
                  ? styles.inputInvalid
                  : ''
              }
            />
            {touched.confirmEmail && guestForm.confirmEmail && (
              <span className={`${styles.feedback} ${confirmEmailOk ? styles.feedbackOk : styles.feedbackErr}`}>
                {confirmEmailOk
                  ? <><Check size={13} /> {t('emailsMatch')}</>
                  : <><X size={13} /> {t('emailsMismatch')}</>}
              </span>
            )}
          </div>

          {/* Teléfono */}
          <div className={styles.formField}>
            <label htmlFor="apt-guest-phone">
              {t('phoneLabel')} <span className={styles.req}>*</span>
            </label>
            <input
              id="apt-guest-phone"
              type="tel"
              placeholder={t('phonePlaceholder')}
              autoComplete="tel"
              maxLength={20}
              inputMode="numeric"
              value={guestForm.phone}
              onChange={(e) => onFieldChange('phone', formatBRPhone(e.target.value))}
              onBlur={() => onFieldBlur('phone')}
              className={
                phoneOk === true
                  ? styles.inputValid
                  : touched.phone && phoneOk === false
                  ? styles.inputInvalid
                  : ''
              }
            />
            {touched.phone && guestForm.phone && (
              <span className={`${styles.feedback} ${phoneOk ? styles.feedbackOk : styles.feedbackErr}`}>
                {phoneOk
                  ? <><Check size={13} /> {t('phoneValid')}</>
                  : <><X size={13} /> {t('phoneInvalid')}</>}
              </span>
            )}
          </div>

          {/* País */}
          <div className={styles.formField}>
            <label htmlFor="apt-guest-country">
              {t('countryLabel')} <span className={styles.req}>*</span>
            </label>
            <input
              id="apt-guest-country"
              type="text"
              placeholder={t('defaultCountry')}
              value={guestForm.country}
              onChange={(e) => onFieldChange('country', e.target.value)}
            />
          </div>

          {/* Documento (CPF o pasaporte) */}
          <div className={styles.formField}>
            <label htmlFor="apt-guest-document">
              {t('documentLabel')} <span className={styles.req}>*</span>
            </label>
            <input
              id="apt-guest-document"
              type="text"
              placeholder="000.000.000-00"
              maxLength={14}
              autoComplete="off"
              value={guestForm.document}
              onChange={(e) =>
                onFieldChange(
                  'document',
                  /[a-zA-Z]/.test(e.target.value) ? e.target.value : formatCPF(e.target.value),
                )
              }
              onBlur={() => onFieldBlur('document')}
              className={
                cpfOk === true
                  ? styles.inputValid
                  : touched.document && cpfOk === false
                  ? styles.inputInvalid
                  : ''
              }
            />
            {touched.document && guestForm.document && (
              <span className={`${styles.feedback} ${cpfOk ? styles.feedbackOk : styles.feedbackErr}`}>
                {cpfHasLetter
                  ? <><Check size={13} /> {t('passportAccepted')}</>
                  : cpfDigits.length === 11
                  ? cpfOk
                    ? <><Check size={13} /> {t('cpfValid')}</>
                    : <><X size={13} /> {t('cpfInvalid')}</>
                  : ''}
              </span>
            )}
          </div>

          {/* Horario de llegada */}
          <div className={styles.formField}>
            <label htmlFor="apt-guest-arrival">
              {t('arrivalTimeLabel')} <span className={styles.req}>*</span>
            </label>
            <select
              id="apt-guest-arrival"
              value={guestForm.arrivalTime}
              onChange={(e) => onFieldChange('arrivalTime', e.target.value)}
              onBlur={() => onFieldBlur('arrivalTime')}
              className={touched.arrivalTime && !guestForm.arrivalTime ? styles.inputInvalid : ''}
            >
              <option value="" disabled>{t('arrivalTimeSelectPlaceholder')}</option>
              {CHECKIN_TIMES.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
            {touched.arrivalTime && guestForm.arrivalTime && (
              <span className={`${styles.feedback} ${styles.feedbackOk}`}>
                <Check size={13} /> {t('arrivalTimeSelected')}
              </span>
            )}
          </div>

          {/* Pedidos especiales */}
          <div className={`${styles.formField} ${styles.formFieldFull}`}>
            <label htmlFor="apt-guest-requests">
              {t('specialRequestsLabel')} <span className={styles.opt}>{t('optionalHint')}</span>
            </label>
            <textarea
              id="apt-guest-requests"
              placeholder={t('specialRequestsPlaceholder')}
              value={guestForm.specialRequests}
              onChange={(e) => onFieldChange('specialRequests', e.target.value)}
            />
          </div>
        </div>

        {/* ── Declaración de hóspedes ──────────────────────────────────── */}
        {guestCount > 0 && (
          <div className={styles.guestsDeclaration}>
            <div className={styles.guestsDeclTitle}>
              <Users size={15} /> {t('guestDeclarationTitle')}
            </div>
            <p className={styles.guestsDeclNote}>{t('guestDeclarationNote')}</p>

            {/* Titular — solo lectura, datos del form principal */}
            <div className={styles.guestDeclRow}>
              <span className={styles.guestDeclBadge}>1</span>
              <div className={styles.guestDeclFields}>
                <span className={styles.guestDeclName}>
                  {guestForm.fullName || <em style={{ color: 'var(--fg-muted)' }}>{t('fullNameLabel')}</em>}
                  <span className={styles.guestDeclTitularTag}>{t('guestTitularTag')}</span>
                </span>
                <span className={styles.guestDeclDoc}>
                  {guestForm.document || <em style={{ color: 'var(--fg-muted)' }}>{t('documentLabel')}</em>}
                </span>
              </div>
            </div>

            {/* Acompañantes */}
            {additionalGuests.map((g, idx) => {
              const ok = docOk(g.document);
              return (
                <div key={g.id} className={styles.guestDeclRow}>
                  <span className={styles.guestDeclBadge}>{idx + 2}</span>
                  <div className={styles.guestDeclFields}>
                    <input
                      type="text"
                      placeholder={t('fullNamePlaceholder')}
                      value={g.fullName}
                      onChange={(e) => updateAdditionalGuest(idx, 'fullName', e.target.value)}
                      className={`${styles.guestDeclInput} ${!g.fullName.trim() ? styles.inputInvalid : ''}`}
                    />
                    <div className={styles.guestDeclDocWrap}>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        maxLength={14}
                        value={g.document}
                        onChange={(e) => updateAdditionalGuest(idx, 'document', e.target.value)}
                        className={`${styles.guestDeclInput} ${
                          ok === true ? styles.inputValid : ok === false ? styles.inputInvalid : ''
                        }`}
                      />
                      {ok === true && (
                        <span className={`${styles.feedback} ${styles.feedbackOk}`}>
                          <Check size={12} /> {/[a-zA-Z]/.test(g.document) ? t('passportAccepted') : t('cpfValid')}
                        </span>
                      )}
                      {ok === false && (
                        <span className={`${styles.feedback} ${styles.feedbackErr}`}>
                          <X size={12} /> {t('cpfInvalid')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.guestDeclRemove}
                    onClick={() => removeGuest(idx)}
                    aria-label={t('removeGuest')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}

            {additionalGuests.length < maxAdditional && (
              <button type="button" className={styles.guestDeclAdd} onClick={addGuest}>
                + {t('addGuest')}
              </button>
            )}

            <div className={styles.guestsDeclAlert}>
              <ShieldCheck size={14} />
              <span>{t('guestDeclarationVerifyNote')}</span>
            </div>
          </div>
        )}

        {/* Reglas de la casa */}
        <div className={styles.rulesConfirm}>
          <div className={styles.rulesConfirmTitle}>
            <AlertTriangle size={15} strokeWidth={2.2} /> {t('rulesConfirmTitle')}
          </div>
          <div className={styles.rulesConfirmList}>
            <div className={styles.rulesConfirmItem}>
              <KeyRound size={16} />
              <span>{t.rich('ruleCheckin', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.rulesConfirmItem}>
              <DoorOpen size={16} />
              <span>{t.rich('ruleCheckout', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.rulesConfirmItem}>
              <FileText size={16} />
              <span>{t.rich('ruleDocument', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.rulesConfirmItem}>
              <Ban size={16} />
              <span>{t.rich('ruleAge', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
            <div className={styles.rulesConfirmItem}>
              <CigaretteOff size={16} />
              <span>{t.rich('ruleSmoking', { b: (chunks) => <strong>{chunks}</strong> })}</span>
            </div>
          </div>
        </div>

        {/* Nota de pago: depósito + métodos */}
        <div className={styles.paymentNote}>
          <div className={styles.paymentNoteTitle}>
            <CreditCard size={15} /> {t('paymentNoteTitle')}
          </div>
          <div className={styles.depositPill}>
            <Lock size={13} /> {isCarnaval
              ? t('depositPillCarnaval', { pct: depositPct })
              : t('depositPill', { pct: depositPct })}
          </div>
          <div className={styles.paymentMethods}>
            <div className={`${styles.paymentMethod} ${styles.paymentMethodPix}`}>
              <span className={styles.pmIcon}><Zap size={18} /></span>
              <div>
                <div className={styles.pmName}>PIX</div>
                <div className={styles.pmDetail}>
                  {t.rich('pixDepositDetail', {
                    b: (chunks) => <strong>{chunks}</strong>,
                    amount: depositAmount.toLocaleString('pt-BR'),
                  })}
                </div>
              </div>
              <span className={`${styles.pmTag} ${styles.pmTagRecommended}`}>
                <Zap size={12} /> {t('instantApproval')}
              </span>
            </div>
            <div className={`${styles.paymentMethod} ${styles.paymentMethodCard}`}>
              <span className={styles.pmIcon}><CreditCard size={18} /></span>
              <div>
                <div className={styles.pmName}>{t('creditCard')}</div>
                <div className={styles.pmDetail}>
                  {t('cardDepositDetail', { amount: depositAmount.toLocaleString('pt-BR') })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Política de cancelación (acordeón) */}
        <div className={styles.cancelPolicy}>
          <button
            type="button"
            className={styles.cancelPolicyHeader}
            onClick={() => setCancelOpen((v) => !v)}
          >
            <span className={styles.cancelPolicyTitle}>
              <RotateCcw size={14} /> {t('cancelPolicyTitle')}
            </span>
            <span
              className={`${styles.cancelPolicyChevron} ${cancelOpen ? styles.cancelPolicyChevronOpen : ''}`}
            >
              <ChevronDown size={16} />
            </span>
          </button>
          {cancelOpen && (
            <div className={styles.cancelPolicyBody}>
              <div className={styles.cancelRows}>
                <div className={styles.cancelRow}>
                  <span className={`${styles.cancelBadge} ${styles.cancelBadgeGreen}`}>
                    <Check size={12} /> {t('cancelFullBadge')}
                  </span>
                  <span>{t.rich('cancelFull', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                </div>
                <div className={styles.cancelRow}>
                  <span className={`${styles.cancelBadge} ${styles.cancelBadgeAmber}`}>{t('cancelPartialBadge')}</span>
                  <span>{t.rich('cancelPartial', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                </div>
                <div className={styles.cancelRow}>
                  <span className={`${styles.cancelBadge} ${styles.cancelBadgeRed}`}>
                    <X size={12} /> {t('cancelNoneBadge')}
                  </span>
                  <span>{t.rich('cancelNone', { b: (chunks) => <strong>{chunks}</strong> })}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Aceite dos Termos de Reserva */}
        <div className={styles.termsAccept}>
          <label className={styles.termsAcceptLabel}>
            <input
              type="checkbox"
              className={styles.termsAcceptCheckbox}
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span>
              {t.rich('termsAcceptText', {
                link: (chunks) => (
                  <a
                    href="/termos-hospede"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.termsAcceptLink}
                  >
                    {chunks}
                  </a>
                ),
              })}
            </span>
          </label>
          {!termsAccepted && (
            <p className={styles.termsAcceptHint}>{t('termsAcceptHint')}</p>
          )}
        </div>

        {/* Botón Confirmar y pagar */}
        <button
          type="button"
          className={styles.btnReserve}
          onClick={onReserve}
          disabled={isCreatingBooking || !canReserve}
        >
          {isCreatingBooking ? t('creatingBooking') : `${t('confirmAndPay')} →`}
        </button>

        {/* Enlace WhatsApp */}
        {whatsappNumber && (
          <a
            className={styles.btnWhatsapp}
            href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={16} /> {t('confirmViaWhatsapp')}
          </a>
        )}
      </div>

      {/* Botón Volver */}
      <div className={styles.actions}>
        <button type="button" className={styles.btnBack} onClick={onBack}>
          ← {t('backToStep', { n: 2, label: t('stepApartment') })}
        </button>
      </div>
    </div>
  );
};
