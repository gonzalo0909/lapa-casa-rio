// lapa-casa-hostel/frontend/src/components/booking/contact-details.tsx

"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { GuestDetails } from '@/types/global';

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
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const ContactDetails: React.FC<ContactDetailsProps> = ({
  formData,
  errors,
  touched,
  onChange,
  onBlur,
  locale = 'pt',
  className = ''
}) => {
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

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            {T('phone', locale)} <span className="text-red-500">*</span>
          </label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => onChange('phone', e.target.value)}
            onBlur={() => onBlur('phone')}
            placeholder={T('phonePlaceholder', locale)}
            className={touched.phone && errors.phone ? 'border-red-500' : ''}
            aria-invalid={touched.phone && !!errors.phone}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
          />
          {touched.phone && errors.phone && (
            <p id="phone-error" className="text-sm text-red-600 mt-1">
              {errors.phone}
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
          >
            <option value="">{T('selectCountry', locale)}</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
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
            onChange={(e) => onChange('documentNumber', e.target.value)}
            onBlur={() => onBlur('documentNumber')}
            placeholder={T('documentPlaceholder', locale)}
            className={touched.documentNumber && errors.documentNumber ? 'border-red-500' : ''}
            aria-invalid={touched.documentNumber && !!errors.documentNumber}
            aria-describedby={errors.documentNumber ? 'documentNumber-error' : undefined}
          />
          {touched.documentNumber && errors.documentNumber && (
            <p id="documentNumber-error" className="text-sm text-red-600 mt-1">
              {errors.documentNumber}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">{T('documentHelp', locale)}</p>
        </div>
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
      phone: 'Telefone',
      phonePlaceholder: '+55 21 99999-9999',
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
      phone: 'Teléfono',
      phonePlaceholder: '+55 21 99999-9999',
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
      phone: 'Phone',
      phonePlaceholder: '+55 21 99999-9999',
      country: 'Country',
      selectCountry: 'Select your country',
      documentNumber: 'ID Document',
      documentPlaceholder: 'Passport, ID',
      documentHelp: 'Required for check-in',
      other: 'Other',
      privacyNote: 'Your data is protected and will only be used for the booking'
    }
  };
  return t[locale]?.[key] || key;
}
