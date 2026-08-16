'use client';
// frontend/src/components/booking/hostel-guest-form.tsx
// Step 3 — Formulario completo del huésped.
// Incluye formateo CPF/phone inline, validación por campo y política de cancelación.

import React from 'react';
import { Lang, FormState, FormErrors, T } from './hostel-engine.types';
import { validateCPF, formatCPF, formatPhone } from './hostel-engine.utils';

// ─── Props ────────────────────────────────────────────────
interface HostelGuestFormProps {
  lang: Lang;
  form: FormState;
  formErrors: FormErrors;
  docFeedback: string;
  emailFb: string;
  phoneFb: string;
  cancelOpen: boolean;
  onFormChange: (patch: Partial<FormState>) => void;
  onFormErrors: (patch: Partial<FormErrors>) => void;
  onDocFeedback: (v: string) => void;
  onEmailFb: (v: string) => void;
  onPhoneFb: (v: string) => void;
  onCancelToggle: () => void;
}

// ─── Iconos de reglas de la casa ─────────────────────────
const RULE_ICONS = ['🔑', '🚪', '📄', '🔞', '🚭'] as const;

// ─── Component ────────────────────────────────────────────
export function HostelGuestForm({
  lang, form, formErrors, docFeedback, emailFb, phoneFb, cancelOpen,
  onFormChange, onFormErrors, onDocFeedback, onEmailFb, onPhoneFb, onCancelToggle,
}: HostelGuestFormProps) {
  const t = T[lang];

  return (
    <div className="he-panel">
      <div className="he-panel-title">{t.p3title}</div>
      <div className="he-panel-sub">{t.p3sub}</div>

      {/* Nombre completo */}
      <div className="he-form-row">
        <label className="he-label" htmlFor="he-f-name">
          <span>{t.lblName}</span> <span className="he-req">*</span>
        </label>
        <input
          id="he-f-name"
          className={`he-inp${formErrors.name ? ' err' : form.name.trim().length > 2 ? ' ok' : ''}`}
          value={form.name}
          placeholder={t.lblName}
          onChange={e => onFormChange({ name: e.target.value })}
          onBlur={() => onFormErrors({ name: form.name.trim().length <= 2 ? t.errName : undefined })}
        />
        {formErrors.name && <div className="he-ferr">{formErrors.name}</div>}
      </div>

      {/* E-mail */}
      <div className="he-form-row">
        <label className="he-label" htmlFor="he-f-email">
          <span>{t.lblEmail}</span> <span className="he-req">*</span>
        </label>
        <input
          id="he-f-email"
          className={`he-inp${formErrors.email ? ' err' : !formErrors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? ' ok' : ''}`}
          type="email"
          value={form.email}
          placeholder="seu@email.com"
          autoComplete="off"
          onPaste={e => e.preventDefault()}
          onChange={e => onFormChange({ email: e.target.value })}
          onBlur={() => {
            const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
            onEmailFb(form.email ? (ok ? '✓ E-mail válido' : '✗ E-mail inválido') : '');
            onFormErrors({ email: !ok ? t.errEmail : undefined });
          }}
        />
        {formErrors.email && <div className="he-ferr">{formErrors.email}</div>}
        {emailFb && <div className={`he-ffb ${emailFb.startsWith('✓') ? 'ok' : 'err'}`}>{emailFb}</div>}
      </div>

      {/* Confirmar e-mail */}
      <div className="he-form-row">
        <label className="he-label" htmlFor="he-f-email2">
          <span>{t.lblEmail2}</span> <span className="he-req">*</span>{' '}
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '.65rem' }}>{t.noPaste}</span>
        </label>
        <input
          id="he-f-email2"
          className={`he-inp${formErrors.email2 ? ' err' : form.email2 && form.email2 === form.email ? ' ok' : ''}`}
          type="email"
          value={form.email2}
          placeholder="seu@email.com"
          autoComplete="off"
          onPaste={e => e.preventDefault()}
          onCut={e => e.preventDefault()}
          onChange={e => onFormChange({ email2: e.target.value })}
        />
        {formErrors.email2 && <div className="he-ferr">{formErrors.email2}</div>}
      </div>

      {/* WhatsApp + País */}
      <div className="he-form-row-2">
        <div>
          <label className="he-label" htmlFor="he-f-phone">
            <span>{t.lblPhone}</span> <span className="he-req">*</span>
          </label>
          <input
            id="he-f-phone"
            className={`he-inp${formErrors.phone ? ' err' : !formErrors.phone && form.phone.replace(/\D/g, '').length >= 10 ? ' ok' : ''}`}
            type="tel"
            value={form.phone}
            placeholder="+55 21 9 9999-9999"
            inputMode="numeric"
            maxLength={20}
            onChange={e => onFormChange({ phone: formatPhone(e.target.value) })}
            onBlur={() => {
              const ok = form.phone.replace(/\D/g, '').length >= 10;
              onPhoneFb(form.phone ? (ok ? '✓ Telefone válido' : '✗ Mínimo 10 dígitos') : '');
              onFormErrors({ phone: !ok ? t.errPhone : undefined });
            }}
          />
          {formErrors.phone && <div className="he-ferr">{formErrors.phone}</div>}
          {phoneFb && <div className={`he-ffb ${phoneFb.startsWith('✓') ? 'ok' : 'err'}`}>{phoneFb}</div>}
        </div>
        <div>
          <label className="he-label" htmlFor="he-f-country">
            <span>{t.lblCountry}</span> <span className="he-req">*</span>
          </label>
          <select
            id="he-f-country"
            className={`he-inp he-sel${formErrors.country ? ' err' : form.country ? ' ok' : ''}`}
            value={form.country}
            onChange={e => onFormChange({ country: e.target.value, doc: '' })}
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

      {/* CPF/Pasaporte + Horario de llegada */}
      <div className="he-form-row-2">
        <div>
          <label className="he-label" htmlFor="he-f-doc">
            <span>{form.country === 'BR' ? t.lblCPF : t.lblPassport}</span> <span className="he-req">*</span>
          </label>
          <input
            id="he-f-doc"
            className={`he-inp${formErrors.doc ? ' err' : docFeedback.startsWith('✓') ? ' ok' : ''}`}
            value={form.doc}
            placeholder={form.country === 'BR' ? t.phCPF : t.phPassport}
            maxLength={form.country === 'BR' ? 14 : 30}
            onChange={e => {
              const v = e.target.value;
              if (form.country === 'BR' && !/[a-zA-Z]/.test(v)) onFormChange({ doc: formatCPF(v) });
              else onFormChange({ doc: v });
            }}
            onBlur={() => {
              const isBR   = form.country === 'BR';
              const digits = form.doc.replace(/\D/g, '');
              if (isBR) {
                const ok = digits.length === 11 && validateCPF(digits);
                onDocFeedback(digits.length === 11 ? (ok ? t.fbCPFok : t.fbCPFerr) : '');
                onFormErrors({ doc: !ok ? t.errCPF : undefined });
              } else {
                const ok = form.doc.trim().length > 4;
                onDocFeedback(ok ? t.fbDocOk : '');
                onFormErrors({ doc: !ok ? t.errDocForeign : undefined });
              }
            }}
          />
          {formErrors.doc && <div className="he-ferr">{formErrors.doc}</div>}
          {docFeedback && <div className={`he-ffb ${docFeedback.startsWith('✓') ? 'ok' : 'err'}`}>{docFeedback}</div>}
        </div>
        <div>
          <label className="he-label" htmlFor="he-f-arrival">
            <span>{t.lblArrival}</span> <span className="he-req">*</span>
          </label>
          <select
            id="he-f-arrival"
            className={`he-inp he-sel${formErrors.arrival ? ' err' : form.arrival ? ' ok' : ''}`}
            value={form.arrival}
            onChange={e => onFormChange({ arrival: e.target.value })}
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

      {/* Solicitudes especiales */}
      <div className="he-form-row">
        <label className="he-label" htmlFor="he-f-req">
          <span>{t.lblRequests}</span>{' '}
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{t.optional}</span>
        </label>
        <textarea
          id="he-f-req"
          className="he-inp he-textarea"
          value={form.requests}
          placeholder="..."
          onChange={e => onFormChange({ requests: e.target.value })}
        />
      </div>

      {/* Reglas de la casa */}
      <div className="he-rules">
        <div className="he-rules-title">{t.rulesTitle}</div>
        {([t.rule1, t.rule2, t.rule3, t.rule4, t.rule5] as string[]).map((rule, i) => (
          <div key={i} className="he-rule">
            <span>{RULE_ICONS[i] ?? ''}</span>
            <span>{rule}</span>
          </div>
        ))}
      </div>

      {/* Política de cancelación */}
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
