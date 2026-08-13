// lapa-casa-hostel/frontend/src/components/booking/contact-details.tsx

"use client";

import React, { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { GuestDetails } from '@/types/global';

// ── CPF helpers ──────────────────────────────────────────────────────────────
function validateCPF(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) {return false;}
  let s = 0;
  for (let i = 0; i < 9; i++) {s += parseInt(n.charAt(i), 10) * (10 - i);}
  let d = (s * 10) % 11; if (d >= 10) {d = 0;}
  if (d !== parseInt(n.charAt(9), 10)) {return false;}
  s = 0;
  for (let i = 0; i < 10; i++) {s += parseInt(n.charAt(i), 10) * (11 - i);}
  d = (s * 10) % 11; if (d >= 10) {d = 0;}
  return d === parseInt(n.charAt(10), 10);
}

function formatCPF(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 11);
  if (n.length > 9) {return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;}
  if (n.length > 6) {return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`;}
  if (n.length > 3) {return `${n.slice(0,3)}.${n.slice(3)}`;}
  return n;
}

// ── Formato de teléfono (modo strict) ───────────────────────────────────────
// +55 (21) 9 9999-9999 -- puerto del auto-formato de LCACOPIA. Si el
// huésped tipea letras (número internacional sin DDI brasileño) se deja
// tal cual, sin forzar el formato BR.
function formatPhoneStrict(v: string): string {
  if (/[a-zA-Z]/.test(v)) {return v;}
  const n = v.replace(/\D/g, '').slice(0, 13);
  if (n.length <= 2) {return n ? `+${n}` : '';}
  if (n.length <= 4) {return `+${n.slice(0, 2)} (${n.slice(2)}`;}
  if (n.length <= 5) {return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4)}`;}
  if (n.length <= 9) {return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 5)} ${n.slice(5)}`;}
  return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 5)} ${n.slice(5, 9)}-${n.slice(9, 13)}`;
}

// ── Arrival time options: 14:00–22:00 every 30 min ──────────────────────────
const ARRIVAL_TIMES: string[] = [];
for (let h = 14; h <= 22; h++) {
  ARRIVAL_TIMES.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 22) {ARRIVAL_TIMES.push(`${String(h).padStart(2, '0')}:30`);}
}

/**
 * ContactDetails Component
 * 
 * Contact information form section
 * Handles name, email, phone, country, document
 * 
 * @component
 */
interface ContactDetailsProps {
  formData: Partial<GuestDetails>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  onChange: (field: keyof GuestDetails, value: string) => void;
  onBlur: (field: keyof GuestDetails) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
  /** Doble campo de email (sin copiar/pegar) + aviso de teléfono más
   * detallado. Puerto de LCACOPIA, hoy solo para Apartamentos. */
  strict?: boolean;
}

/** Bloquea pegar/cortar -- el huésped tiene que tipear el email a mano en
 * los dos campos, así un typo en el primero no se repite invisible en el
 * segundo. */
function blockPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  e.preventDefault();
}

type CpfStatus = 'idle' | 'valid' | 'invalid' | 'passport';

export const ContactDetails: React.FC<ContactDetailsProps> = ({
  formData,
  errors,
  touched,
  onChange,
  onBlur,
  locale = 'pt',
  className = '',
  strict = false
}) => {
  const [cpfStatus, setCpfStatus] = useState<CpfStatus>('idle');
  const [cpfMsg, setCpfMsg] = useState('');

  const handleDocumentChange = useCallback((value: string) => {
    const hasLetter = /[a-zA-Z]/.test(value);
    let formatted = value;
    if (!hasLetter) {
      formatted = formatCPF(value);
    }
    onChange('documentNumber', formatted);

    const raw = formatted.replace(/\D/g, '');
    if (!value.trim()) {
      setCpfStatus('idle'); setCpfMsg('');
    } else if (hasLetter) {
      setCpfStatus('passport'); setCpfMsg(T('cpfPassport', locale));
    } else if (raw.length === 11) {
      const ok = validateCPF(raw);
      setCpfStatus(ok ? 'valid' : 'invalid');
      setCpfMsg(ok ? T('cpfValid', locale) : T('cpfInvalid', locale));
    } else {
      setCpfStatus('idle'); setCpfMsg('');
    }
  }, [onChange, locale]);

  const countries = [
    { code: 'BR', name: 'Brasil' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colombia' },
    { code: 'MX', name: 'México' },
    { code: 'PE', name: 'Perú' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Deutschland' },
    { code: 'FR', name: 'France' },
    { code: 'ES', name: 'España' },
    { code: 'IT', name: 'Italia' },
    { code: 'PT', name: 'Portugal' },
    { code: 'AU', name: 'Australia' },
    { code: 'CA', name: 'Canada' },
    { code: 'JP', name: '日本' },
    { code: 'CN', name: '中国' },
    { code: 'OTHER', name: T('other', locale) }
  ];

  return (
    <div className={`contact-details space-y-4 ${className}`}>
      <h3 className="font-semibold text-gray-900 mb-4">{T('title', locale)}</h3>

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
          {T('fullName', locale)} <span className="text-red-500">*</span>
        </label>
        <Input
          id="fullName"
          type="text"
          value={formData.fullName || ''}
          onChange={(e) => onChange('fullName', e.target.value)}
          onBlur={() => onBlur('fullName')}
          placeholder={T('fullNamePlaceholder', locale)}
          className={touched.fullName && errors.fullName ? 'border-red-500' : ''}
          aria-invalid={touched.fullName && !!errors.fullName}
          aria-describedby={errors.fullName ? 'fullName-error' : undefined}
        />
        {touched.fullName && errors.fullName && (
          <p id="fullName-error" className="text-sm text-red-600 mt-1">
            {errors.fullName}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            {T('email', locale)} <span className="text-red-500">*</span>
          </label>
          <Input
            id="email"
            type="email"
            value={formData.email || ''}
            onChange={(e) => onChange('email', e.target.value)}
            onBlur={() => onBlur('email')}
            onPaste={strict ? blockPaste : undefined}
            onCut={strict ? blockPaste : undefined}
            placeholder={T('emailPlaceholder', locale)}
            className={touched.email && errors.email ? 'border-red-500' : ''}
            aria-invalid={touched.email && !!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {touched.email && errors.email && (
            <p id="email-error" className="text-sm text-red-600 mt-1">
              {errors.email}
            </p>
          )}
        </div>

        {strict && (
          <div>
            <label htmlFor="confirmEmail" className="block text-sm font-medium text-gray-700 mb-2">
              {T('confirmEmail', locale)} <span className="text-red-500">*</span>{' '}
              <span className="font-normal text-gray-500">({T('typeManually', locale)})</span>
            </label>
            <Input
              id="confirmEmail"
              type="email"
              value={formData.confirmEmail || ''}
              onChange={(e) => onChange('confirmEmail', e.target.value)}
              onBlur={() => onBlur('confirmEmail')}
              onPaste={blockPaste}
              onCut={blockPaste}
              placeholder={T('emailPlaceholder', locale)}
              className={touched.confirmEmail && errors.confirmEmail ? 'border-red-500' : ''}
              aria-invalid={touched.confirmEmail && !!errors.confirmEmail}
              aria-describedby={errors.confirmEmail ? 'confirmEmail-error' : undefined}
            />
            {touched.confirmEmail && errors.confirmEmail && (
              <p id="confirmEmail-error" className="text-sm text-red-600 mt-1">
                {errors.confirmEmail}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            {T('phone', locale)} <span className="text-red-500">*</span>
          </label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => onChange('phone', strict ? formatPhoneStrict(e.target.value) : e.target.value)}
            onBlur={() => onBlur('phone')}
            placeholder={T('phonePlaceholder', locale)}
            className={touched.phone && errors.phone ? 'border-red-500' : ''}
            aria-invalid={touched.phone && !!errors.phone}
            aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'}
          />
          {touched.phone && errors.phone ? (
            <p id="phone-error" className="text-sm text-red-600 mt-1">
              {errors.phone}
            </p>
          ) : (
            <p id="phone-hint" className="text-xs text-gray-500 mt-1">
              {T('phoneHint', locale)}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
            {T('country', locale)} <span className="text-red-500">*</span>
          </label>
          <Select
            id="country"
            value={formData.country || ''}
            onChange={(e) => onChange('country', e.target.value)}
            onBlur={() => onBlur('country')}
            className={touched.country && errors.country ? 'border-red-500' : ''}
            aria-invalid={touched.country && !!errors.country}
            aria-describedby={errors.country ? 'country-error' : undefined}
            placeholder={T('selectCountry', locale)}
            options={countries.map((country) => ({ value: country.code, label: country.name }))}
          />
          {touched.country && errors.country && (
            <p id="country-error" className="text-sm text-red-600 mt-1">
              {errors.country}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="documentNumber" className="block text-sm font-medium text-gray-700 mb-2">
            {T('documentNumber', locale)} <span className="text-red-500">*</span>
          </label>
          <Input
            id="documentNumber"
            type="text"
            value={formData.documentNumber || ''}
            onChange={(e) => handleDocumentChange(e.target.value)}
            onBlur={() => onBlur('documentNumber')}
            placeholder={T('documentPlaceholder', locale)}
            maxLength={14}
            className={[
              touched.documentNumber && errors.documentNumber ? 'border-red-500' : '',
              cpfStatus === 'valid' || cpfStatus === 'passport' ? 'border-green-400' : '',
              cpfStatus === 'invalid' ? 'border-red-400' : '',
            ].filter(Boolean).join(' ')}
            aria-invalid={touched.documentNumber && !!errors.documentNumber}
            aria-describedby="documentNumber-feedback"
          />
          {touched.documentNumber && errors.documentNumber ? (
            <p id="documentNumber-feedback" className="text-sm text-red-600 mt-1">
              {errors.documentNumber}
            </p>
          ) : cpfMsg ? (
            <p id="documentNumber-feedback" className={`text-xs mt-1 ${cpfStatus === 'invalid' ? 'text-red-600' : 'text-green-600'}`}>
              {cpfMsg}
            </p>
          ) : (
            <p id="documentNumber-feedback" className="text-xs text-gray-500 mt-1">
              {T('documentHelp', locale)}
            </p>
          )}
        </div>
      </div>

      {/* Horário de chegada */}
      <div>
        <label htmlFor="arrivalTime" className="block text-sm font-medium text-gray-700 mb-2">
          {T('arrivalTime', locale)} <span className="text-red-500">*</span>
        </label>
        <Select
          id="arrivalTime"
          value={formData.arrivalTime || ''}
          onChange={(e) => onChange('arrivalTime', e.target.value)}
          onBlur={() => onBlur('arrivalTime')}
          className={touched.arrivalTime && errors.arrivalTime ? 'border-red-500' : ''}
          aria-invalid={touched.arrivalTime && !!errors.arrivalTime}
          aria-describedby={errors.arrivalTime ? 'arrivalTime-error' : 'arrivalTime-hint'}
          placeholder={T('selectArrivalTime', locale)}
          options={ARRIVAL_TIMES.map((t) => ({ value: t, label: t }))}
        />
        {touched.arrivalTime && errors.arrivalTime ? (
          <p id="arrivalTime-error" className="text-sm text-red-600 mt-1">
            {errors.arrivalTime}
          </p>
        ) : (
          <p id="arrivalTime-hint" className="text-xs text-gray-500 mt-1">
            {T('arrivalTimeHint', locale)}
          </p>
        )}
      </div>

      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          🔒 {T('privacyNote', locale)}
        </p>
      </div>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Dados de Contato',
      fullName: 'Nome Completo',
      fullNamePlaceholder: 'João da Silva',
      email: 'Email',
      emailPlaceholder: 'joao@email.com',
      confirmEmail: 'Confirmar email',
      typeManually: 'digite manualmente',
      phone: 'Telefone (WhatsApp)',
      phonePlaceholder: '+55 21 99999-9999',
      phoneHint: 'Use o número do seu WhatsApp, mesmo morando fora do Brasil -- é assim que vamos te contatar se precisarmos, sem custo de ligação internacional.',
      country: 'País',
      selectCountry: 'Selecione seu país',
      documentNumber: 'Documento de Identidade',
      documentPlaceholder: 'CPF, RG, Passaporte',
      documentHelp: 'Necessário para check-in',
      other: 'Outro',
      privacyNote: 'Seus dados estão protegidos e serão usados apenas para a reserva'
    },
    es: {
      title: 'Datos de Contacto',
      fullName: 'Nombre Completo',
      fullNamePlaceholder: 'Juan da Silva',
      email: 'Email',
      emailPlaceholder: 'juan@email.com',
      confirmEmail: 'Confirmar email',
      typeManually: 'escribilo manualmente',
      phone: 'Teléfono (WhatsApp)',
      phonePlaceholder: '+55 21 99999-9999',
      phoneHint: 'Poné el número de tu WhatsApp, aunque vivas fuera de Brasil -- así te contactamos si hace falta, sin costo de llamada internacional.',
      country: 'País',
      selectCountry: 'Selecciona tu país',
      documentNumber: 'Documento de Identidad',
      documentPlaceholder: 'DNI, Pasaporte',
      documentHelp: 'Necesario para check-in',
      other: 'Otro',
      privacyNote: 'Tus datos están protegidos y se usarán solo para la reserva'
    },
    en: {
      title: 'Contact Details',
      fullName: 'Full Name',
      fullNamePlaceholder: 'John Smith',
      email: 'Email',
      emailPlaceholder: 'john@email.com',
      confirmEmail: 'Confirm email',
      typeManually: 'type manually',
      phone: 'Phone (WhatsApp)',
      phonePlaceholder: '+55 21 99999-9999',
      phoneHint: 'Enter your WhatsApp number, even if you live abroad -- that\'s how we\'ll reach you if needed, with no international call cost.',
      country: 'Country',
      selectCountry: 'Select your country',
      documentNumber: 'ID Document',
      documentPlaceholder: 'Passport, ID',
      documentHelp: 'Required for check-in',
      other: 'Other',
      privacyNote: 'Your data is protected and will only be used for the booking'
    },
    fr: {
      title: 'Coordonnées',
      fullName: 'Nom Complet',
      fullNamePlaceholder: 'Jean Dupont',
      email: 'E-mail',
      emailPlaceholder: 'jean@email.com',
      confirmEmail: "Confirmer l'e-mail",
      typeManually: 'à saisir manuellement',
      phone: 'Téléphone (WhatsApp)',
      phonePlaceholder: '+55 21 99999-9999',
      phoneHint: 'Indiquez votre numéro WhatsApp, même si vous vivez hors du Brésil -- c"est ainsi que nous vous contacterons si besoin, sans frais d"appel international.',
      country: 'Pays',
      selectCountry: 'Sélectionnez votre pays',
      documentNumber: "Pièce d'Identité",
      documentPlaceholder: "Passeport, carte d'identité",
      documentHelp: 'Requis pour l"enregistrement',
      other: 'Autre',
      privacyNote: 'Vos données sont protégées et utilisées uniquement pour la réservation'
    },
    de: {
      title: 'Kontaktdaten',
      fullName: 'Vollständiger Name',
      fullNamePlaceholder: 'Max Mustermann',
      email: 'E-Mail',
      emailPlaceholder: 'max@email.com',
      confirmEmail: 'E-Mail bestätigen',
      typeManually: 'manuell eingeben',
      phone: 'Telefon (WhatsApp)',
      phonePlaceholder: '+55 21 99999-9999',
      phoneHint: 'Geben Sie Ihre WhatsApp-Nummer an, auch wenn Sie außerhalb Brasiliens leben -- so erreichen wir Sie bei Bedarf ohne Kosten für internationale Anrufe.',
      country: 'Land',
      selectCountry: 'Land auswählen',
      documentNumber: 'Ausweisdokument',
      documentPlaceholder: 'Reisepass, Personalausweis',
      documentHelp: 'Erforderlich für den Check-in',
      other: 'Andere',
      privacyNote: 'Ihre Daten sind geschützt und werden nur für die Buchung verwendet'
    }
  };
  return t[locale]?.[key] || key;
}
