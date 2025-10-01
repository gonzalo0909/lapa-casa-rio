// lapa-casa-hostel/frontend/src/components/booking/guest-form.tsx

"use client";

import React, { useState, useCallback } from 'react';
import { ContactDetails } from './contact-details';
import { SpecialRequests } from './special-requests';
import { Alert } from '@/components/ui/alert';
import type { GuestDetails } from '@/types/global';

/**
 * GuestForm Component
 * 
 * Multi-section form for guest information
 * Validates required fields and special requests
 * 
 * @component
 */
interface GuestFormProps {
  value: GuestDetails | null;
  onSubmit: (details: GuestDetails) => void;
  locale?: 'pt' | 'es' | 'en';
  error?: string;
  className?: string;
}

export const GuestForm: React.FC<GuestFormProps> = ({
  value,
  onSubmit,
  locale = 'pt',
  error,
  className = ''
}) => {
  const [formData, setFormData] = useState<Partial<GuestDetails>>(
    value || {
      fullName: '',
      email: '',
      phone: '',
      country: '',
      documentNumber: '',
      specialRequests: '',
      arrivalTime: '',
      dietaryRestrictions: ''
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (field: string, value: string): string | null => {
      switch (field) {
        case 'fullName':
          if (!value || value.trim().length < 3) {
            return T('errorFullName', locale);
          }
          if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(value)) {
            return T('errorFullNameFormat', locale);
          }
          return null;

        case 'email':
          if (!value) {
            return T('errorEmail', locale);
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return T('errorEmailFormat', locale);
          }
          return null;

        case 'phone':
          if (!value) {
            return T('errorPhone', locale);
          }
          const phoneDigits = value.replace(/\D/g, '');
          if (phoneDigits.length < 10) {
            return T('errorPhoneFormat', locale);
          }
          return null;

        case 'country':
          if (!value) {
            return T('errorCountry', locale);
          }
          return null;

        case 'documentNumber':
          if (!value || value.trim().length < 5) {
            return T('errorDocument', locale);
          }
          return null;

        default:
          return null;
      }
    },
    [locale]
  );

  const handleFieldChange = useCallback(
    (field: keyof GuestDetails, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (touched[field]) {
        const error = validateField(field, value);
        setErrors((prev) => ({
          ...prev,
          [field]: error || ''
        }));
      }
    },
    [touched, validateField]
  );

  const handleFieldBlur = useCallback(
    (field: keyof GuestDetails) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const value = formData[field] as string;
      const error = validateField(field, value);
      setErrors((prev) => ({
        ...prev,
        [field]: error || ''
      }));
    },
    [formData, validateField]
  );

  const validateForm = useCallback((): boolean => {
    const requiredFields: (keyof GuestDetails)[] = [
      'fullName',
      'email',
      'phone',
      'country',
      'documentNumber'
    ];

    const newErrors: Record<string, string> = {};
    let isValid = true;

    requiredFields.forEach((field) => {
      const error = validateField(field, formData[field] as string);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [formData, validateField]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      const allTouched = Object.keys(formData).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {}
      );
      setTouched(allTouched);

      if (validateForm()) {
        onSubmit(formData as GuestDetails);
      }
    },
    [formData, validateForm, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className={`guest-form ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {T('title', locale)}
        </h2>
        <p className="text-gray-600">{T('subtitle', locale)}</p>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      <ContactDetails
        formData={formData}
        errors={errors}
        touched={touched}
        onChange={handleFieldChange}
        onBlur={handleFieldBlur}
        locale={locale}
        className="mb-6"
      />

      <SpecialRequests
        formData={formData}
        onChange={handleFieldChange}
        locale={locale}
        className="mb-6"
      />

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">
          {T('importantInfo', locale)}
        </h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• {T('info1', locale)}</li>
          <li>• {T('info2', locale)}</li>
          <li>• {T('info3', locale)}</li>
          <li>• {T('info4', locale)}</li>
        </ul>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          id="terms"
          required
          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label htmlFor="terms">
          {T('acceptTerms', locale)}{' '}
          <a href="/terms" className="text-blue-600 hover:underline" target="_blank">
            {T('termsLink', locale)}
          </a>
        </label>
      </div>
    </form>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Informações do Hóspede',
      subtitle: 'Preencha seus dados para finalizar a reserva',
      errorFullName: 'Nome completo é obrigatório',
      errorFullNameFormat: 'Nome deve conter apenas letras',
      errorEmail: 'Email é obrigatório',
      errorEmailFormat: 'Email inválido',
      errorPhone: 'Telefone é obrigatório',
      errorPhoneFormat: 'Telefone inválido',
      errorCountry: 'País é obrigatório',
      errorDocument: 'Documento é obrigatório',
      importantInfo: 'Informações Importantes',
      info1: 'Check-in: 14:00 - Check-out: 11:00',
      info2: 'Documento de identidade obrigatório',
      info3: 'Idade mínima: 18 anos',
      info4: 'Confirmação enviada por email',
      acceptTerms: 'Aceito os',
      termsLink: 'termos e condições'
    },
    es: {
      title: 'Información del Huésped',
      subtitle: 'Complete sus datos para finalizar la reserva',
      errorFullName: 'Nombre completo es obligatorio',
      errorFullNameFormat: 'Nombre debe contener solo letras',
      errorEmail: 'Email es obligatorio',
      errorEmailFormat: 'Email inválido',
      errorPhone: 'Teléfono es obligatorio',
      errorPhoneFormat: 'Teléfono inválido',
      errorCountry: 'País es obligatorio',
      errorDocument: 'Documento es obligatorio',
      importantInfo: 'Información Importante',
      info1: 'Check-in: 14:00 - Check-out: 11:00',
      info2: 'Documento de identidad obligatorio',
      info3: 'Edad mínima: 18 años',
      info4: 'Confirmación enviada por email',
      acceptTerms: 'Acepto los',
      termsLink: 'términos y condiciones'
    },
    en: {
      title: 'Guest Information',
      subtitle: 'Fill in your details to complete the booking',
      errorFullName: 'Full name is required',
      errorFullNameFormat: 'Name must contain only letters',
      errorEmail: 'Email is required',
      errorEmailFormat: 'Invalid email',
      errorPhone: 'Phone is required',
      errorPhoneFormat: 'Invalid phone',
      errorCountry: 'Country is required',
      errorDocument: 'Document is required',
      importantInfo: 'Important Information',
      info1: 'Check-in: 14:00 - Check-out: 11:00',
      info2: 'ID document required',
      info3: 'Minimum age: 18 years',
      info4: 'Confirmation sent by email',
      acceptTerms: 'I accept the',
      termsLink: 'terms and conditions'
    }
  };
  return t[locale]?.[key] || key;
}
