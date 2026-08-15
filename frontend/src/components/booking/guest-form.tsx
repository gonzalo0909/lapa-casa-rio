// lapa-casa-hostel/frontend/src/components/booking/guest-form.tsx

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  error?: string;
  className?: string;
}

const REQUIRED_FIELDS: (keyof GuestDetails)[] = [
  'fullName',
  'email',
  'phone',
  'country',
  'documentNumber',
  'arrivalTime'
];

export const GuestForm: React.FC<GuestFormProps> = ({
  value,
  onSubmit,
  locale = 'pt',
  error,
  className = ''
}) => {
  const t = useTranslations('guestForm');
  const [formData, setFormData] = useState<Partial<GuestDetails>>(
    value || {
      fullName: '',
      email: '',
      phone: '',
      country: '',
      documentNumber: '',
      specialRequests: '',
      arrivalTime: ''
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (field: string, value: string): string | null => {
      switch (field) {
        case 'fullName':
          if (!value || value.trim().length < 3) {
            return t('errorFullName');
          }
          if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(value)) {
            return t('errorFullNameFormat');
          }
          return null;

        case 'email':
          if (!value) {
            return t('errorEmail');
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return t('errorEmailFormat');
          }
          return null;

        case 'phone':
          if (!value) {
            return t('errorPhone');
          }
          const phoneDigits = value.replace(/\D/g, '');
          if (phoneDigits.length < 10) {
            return t('errorPhoneFormat');
          }
          return null;

        case 'country':
          if (!value) {
            return t('errorCountry');
          }
          return null;

        case 'documentNumber':
          if (!value || value.trim().length < 5) {
            return t('errorDocument');
          }
          return null;

        case 'arrivalTime':
          if (!value) {
            return t('errorArrivalTime');
          }
          return null;

        default:
          return null;
      }
    },
    [t]
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

  // El formulario no tiene botón propio de envío -- el paso completo se
  // avanza con el botón "Siguiente" compartido de BookingEngine, así que
  // los datos se sincronizan al padre (mismo patrón que el resto de los
  // pasos del wizard) en vez de esperar un submit que nunca ocurre. Pero
  // solo cuando el formulario está completo y válido -- antes se llamaba
  // a onSubmit en cada tecla, con datos parciales/inválidos a medio
  // escribir, contaminando el guestDetails del store.
  useEffect(() => {
    const isComplete = REQUIRED_FIELDS.every(
      (field) => !validateField(field, (formData[field] as string) || '')
    );
    if (isComplete) {
      onSubmit(formData as GuestDetails);
    }
  }, [formData, onSubmit, validateField]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    REQUIRED_FIELDS.forEach((field) => {
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
      if (e) {e.preventDefault();}

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
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t('title')}
        </h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {error && (
        <Alert variant="danger" className="mb-6">
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

      <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
          {t('importantInfo')}
        </h4>
        <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
          <li>• {t('info1')}</li>
          <li>• {t('info2')}</li>
          <li>• {t('info3')}</li>
          <li>• {t('info4')}</li>
          <li>• {t('info5')}</li>
        </ul>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          id="terms"
          required
          className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
        />
        <label htmlFor="terms">
          {t('acceptTerms')}{' '}
          <a href="/terms" className="text-primary hover:underline" target="_blank">
            {t('termsLink')}
          </a>
        </label>
      </div>
    </form>
  );
};
