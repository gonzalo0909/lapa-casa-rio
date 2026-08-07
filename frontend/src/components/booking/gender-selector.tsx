// lapa-casa-hostel/frontend/src/components/booking/gender-selector.tsx

"use client";

import React from 'react';
import type { BookingGender } from '@/types/global';

/**
 * GenderSelector Component
 *
 * Se elige junto con las fechas, antes de ver los cuartos: determina
 * si el huésped ve solo cuartos mixtos, o también el cuarto solo-mujeres
 * (Flexible 7). Los hombres siempre reservan mixto; las mujeres pueden
 * elegir entre mixto o solo-mujeres.
 *
 * @component
 */
interface GenderSelectorProps {
  value: BookingGender;
  onChange: (gender: BookingGender) => void;
  locale?: 'pt' | 'es' | 'en';
  className?: string;
}

export const GenderSelector: React.FC<GenderSelectorProps> = ({
  value,
  onChange,
  locale = 'pt',
  className = ''
}) => {
  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{T('title', locale)}</h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange('mixed')}
          aria-pressed={value === 'mixed'}
          className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
            value === 'mixed'
              ? 'border-blue-600 bg-blue-50 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          {T('mixed', locale)}
        </button>
        <button
          type="button"
          onClick={() => onChange('female')}
          aria-pressed={value === 'female'}
          className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
            value === 'female'
              ? 'border-pink-600 bg-pink-50 text-pink-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          {T('female', locale)}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">{T('hint', locale)}</p>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Quem vai se hospedar?',
      mixed: 'Grupo misto',
      female: 'Só mulheres',
      hint: 'Isso define quais quartos aparecem na próxima etapa.'
    },
    es: {
      title: '¿Quién se va a hospedar?',
      mixed: 'Grupo mixto',
      female: 'Solo mujeres',
      hint: 'Esto define qué habitaciones aparecen en el próximo paso.'
    },
    en: {
      title: 'Who is staying?',
      mixed: 'Mixed group',
      female: 'Women only',
      hint: 'This decides which rooms show up in the next step.'
    }
  };
  return t[locale]?.[key] || key;
}
