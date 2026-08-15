'use client';
// frontend/src/components/booking/hostel-guest-form.tsx
// Step 3 — Formulário de dados do hóspede.
// Lida com formatação de CPF/phone internamente; toda validação fica no orquestrador.

import React from 'react';
import { Lang, T, FormState, FormErrors } from './hostel-engine.types';
import { formatCPF, formatPhone } from './hostel-engine.utils';

// ─── Props ──────────────────────────────────────────────
export interface HostelGuestFormProps {
  lang: Lang;
  form: FormState;
  formErrors: FormErrors;
  docFeedback: string;
  emailFb: string;
  phoneFb: string;
  cancelOpen: boolean;
  /** Generic setter for simple text fields */
  onFieldChange: (field: keyof FormState, value: string) => void;
  /** Country change also resets doc — handled in orchestrator */
  onCountryChange: (country: string) => void;
  onEmailBlur: () => void;
  onPhoneBlur: () => void;
  onDocBlur: () => void;
  onNameBlur: () => void;
  onCancelToggle: () => void;
}

// ─── Component ──────────────────────────────────────────
export function HostelGuestForm({
  lang, form, formErrors, docFeedback, emailFb, phoneFb, cancelOpen,
  onFieldChange, onCountryChange,
  onEmailBlur, onPhoneBlur, onDocBlur, onNameBlur,
  onCancelToggle,
}: HostelGuestFormProps) {
  const t = T[lang];
  const isBR = form.country === 'BR';

  return (
    <div className="he-panel">
      <div className="he-panel-title">{t.p3title}</div>
      <div className="he-panel-sub">{t.p3sub}</div>

      {/* Full name */}
      <div className="he-form-row">
        <label className="he-label" htmlFor="he-f-name">
          <span>{t.lblName}</span> <span className="he-req">*</span>
        </label>
        <input
          id="he-f-name"
          className={`he-inp${formErrors.name ? ' err' : form.name.trim().length > 2 ? ' ok' : ''}`}
          value={form.name}
          placeholder={t.lblName}
          onChange={e => onFieldChange('name', e.target.value)}
          onBlur={onNameBlur}
        />
        {formErrors.name && <div className="he-ferr">{formErrors.name}</div>}
      </div>

      {/* Email */}
      <div className="he-form-row">
        <label className="he-label" htmlFor="he-f-email">
          <span>{t.lblEmail}</span> <span className="he-req">*</span>
        </label>
        <input
          id="he-f-email"
          className={`he-inp${
            formErrors.email ? ' err'
            : !formErrors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? ' ok'
            : ''
          }`}
          type="email"
          value={form.email}
          placeholder="seu@email.com"
          autoComplete="off"
          onPaste={e => e.preventDefault()}
          onChange={e => onFieldChange('email', e.target.value)}
          onBlur={onEmailBlur}
        />
        {formErrors.email && <div className="he-ferr">{formErrors.email}</div>}
        {emailFb && (
          <div className={`he-ffb ${emailFb.startsWith('✓') ? 'ok' : 'err'}`}>{emailFb}</div>
        )}
      </div>

      {/* Confirm email */}
      <div className="he-form-row">
        <label className="he-label" htmlFor="he-f-email2">
          <span>{t.lblEmail2}</span> <span className="he-req">*</span>{' '}
          <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:'.65rem' }}>
            {t.noPaste}
          </span>
        </label>
        <input
          id="he-f-email2"
          className={`he-inp${
            formErrors.email2 ? ' err'
            : form.email2 && form.email2 === form.email ? ' ok'
            : ''
          }`}
          type="email"
          value={form.email2}
          placeholder="seu@email.com"
          autoComplete="off"
          onPaste={e => e.preventDefault()}
          onCut={e => e.preventDefault()}
          onChange={e => onFieldChange('email2', e.target.value)}
        />
        {formErrors.email2 && <div className="he-ferr">{formErrors.email2}</div>}
      </div>

      {/* Phone + Country */}
      <div className="he-form-row-2">
        <div>
          <label className="he-label" htmlFor="he-f-phone">
            <span>{t.lblPhone}</span> <span className="he-req">*</span>
          </label>
          <input
            id="he-f-phone"
            className={`he-inp${
              formErrors.phone ? ' err'
              : !formErrors.phone && form.phone.replace(/\D/g,'').length >= 10 ? ' ok'
              : ''
            }`}
            type="tel"
            value={form.phone}
            placeholder="+55 21 9 9999-9999"
            inputMode="numeric"
            maxLength={20}
            onChange={e => onFieldChange('phone', formatPhone(e.target.value))}
            onBlur={onPhoneBlur}
          />
          {formErrors.phone && <div className="he-ferr">{formErrors.phone}</div>}
          {phoneFb && (
            <div className={`he-ffb ${phoneFb.startsWith('✓') ? 'ok' : 'err'}`}>{phoneFb}</div>
          )}
        </div>
        <div>
          <label className="he-label" htmlFor="he-f-country">
            <span>{t.lblCountry}</span> <span className="he-req">*</span>
          </label>
          <select
            id="he-f-country"
            className={`he-inp he-sel${formErrors.country ? ' err' : form.country ? ' ok' : ''}`}
            value={form.country}
            onChange={e => onCountryChange(e.target.value)}
          >
            <option value="">{t.selectPlaceholder}</option>
            <option value="BR">Brasil</option>
            <option value="AR">Argentina</option>
            <option value="CO">Colombia</option>
            <option value="CL">Chile</option>
            <option value="US">Estados Unidos</option>
            <option value="DE">Alemanha / Germany</option>
            <option value="FR">França / France</option>
            <option value="GB">Reino Unido / UK</option>
            <option value="PT">Portugal</option>
            <option value="ES">España / Espanha</option>
            <option value="IT">Italia / Itália</option>
            <option value="OTHER">{t.optOther}</option>
          </select>
          {formErrors.country && <div className="he-ferr">{formErrors.country}</div>}
        </div>
      </div>

      {/* Document + Arrival time */}
      <div className="he-form-row-2">
        <div>
          <label className="he-label" htmlFor="he-f-doc">
            <span>{isBR ? t.lblCPF : t.lblPassport}</span> <span className="he-req">*</span>
          </label>
          <input
            id="he-f-doc"
            className={`he-inp${
              formErrors.doc ? ' err'
              : docFeedback.startsWith('✓') ? ' ok'
              : ''
            }`}
            value={form.doc}
            placeholder={isBR ? t.phCPF : t.phPassport}
            maxLength={isBR ? 14 : 30}
            onChange={e => {
              const v = e.target.value;
              const formatted = isBR && !/[a-zA-Z]/.test(v) ? formatCPF(v) : v;
              onFieldChange('doc', formatted);
            }}
            onBlur={onDocBlur}
          />
          {formErrors.doc && <div className="he-ferr">{formErrors.doc}</div>}
          {docFeedback && (
            <div className={`he-ffb ${docFeedback.startsWith('✓') ? 'ok' : 'err'}`}>{docFeedback}</div>
          )}
        </div>
        <div>
          <label className="he-label" htmlFor="he-f-arrival">
            <span>{t.lblArrival}</span> <span className="he-req">*</span>
          </label>
          <select
            id="he-f-arrival"
            className={`he-inp he-sel${formErrors.arrival ? ' err' : form.arrival ? ' ok' : ''}`}
            value={form.arrival}
            onChange={e => onFieldChange('arrival', e.target.value)}
          >
            <option value="">{t.arrivalPlaceholder}</option>
            {['14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
              '18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'].map(h =>
              <option key={h}>{h}</option>
            )}
          </select>
          {formErrors.arrival && <div className="he-ferr">{formErrors.arrival}</div>}
        </div>
      </div>

      {/* Special requests */}
      <div className="he-form-row">
        <label className="he-label" htmlFor="he-f-req">
          <span>{t.lblRequests}</span>{' '}
          <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>{t.optional}</span>
        </label>
        <textarea
          id="he-f-req"
          className="he-inp he-textarea"
          value={form.requests}
          placeholder="..."
          onChange={e => onFieldChange('requests', e.target.value)}
        />
      </div>

      {/* House rules */}
      <div className="he-rules">
        <div className="he-rules-title">{t.rulesTitle}</div>
        {[t.rule1, t.rule2, t.rule3, t.rule4, t.rule5].map((r, i) => (
          <div key={i} className="he-rule">
            <span>{(['🔑','🚪','📄','🔞','🚭'] as const)[i] ?? ''}</span><span>{r}</span>
          </div>
        ))}
      </div>

      {/* Cancellation policy accordion */}
      <div className="he-cancel">
        <button className="he-cancel-btn" type="button" onClick={onCancelToggle}>
          <span>{t.cancelBtn}</span>
          <span className={`he-chevron${cancelOpen ? ' open' : ''}`}>▼</span>
        </button>
        {cancelOpen && (
          <div className="he-cancel-body">
            <div className="he-cancel-row">
              <span className="he-cbadge he-cbadge-g">{t.cancelFree}</span>
              <span>{t.cancelFreeText}</span>
            </div>
            <div className="he-cancel-row">
              <span className="he-cbadge he-cbadge-r">{t.cancelNo}</span>
              <span>{t.cancelNoText}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
