// lapa-casa-hostel/frontend/src/components/booking/gender-selector.tsx

"use client";

import React from 'react';
import type { BookingGender } from '@/types/global';

/**
 * GenderSelector Component
 *
 * Se elige junto con las fechas, antes de ver los cuartos.
 * "Solo hombres" muestra los cuartos mixtos (12 y 7 camas).
 * "Mujeres / Grupo mixto" muestra esos mismos más el cuarto Flexible 7
 * (solo-mujeres) -- aplica tanto para grupos de mujeres como para un
 * hombre que reserva en nombre de un grupo que incluye mujeres y necesita
 * ese cuarto para ellas.
 *
 * @component
 */
interface GenderSelectorProps {
  value: BookingGender;
  onChange: (gender: BookingGender) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
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
      mixed: 'So homens',
      female: 'Mulheres / Grupo misto',
      hint: 'Escolha "Mulheres / Grupo misto" se alguem do grupo precisar do quarto feminino exclusivo.'
    },
    es: {
      title: '¿Quién se va a hospedar?',
      mixed: 'Solo hombres',
      female: 'Mujeres / Grupo mixto',
      hint: 'Elegí "Mujeres / Grupo mixto" si alguien del grupo necesita el cuarto solo-mujeres.'
    },
    en: {
      title: 'Who is staying?',
      mixed: 'Men only',
      female: 'Women / Mixed group',
      hint: 'Choose "Women / Mixed group" if anyone in the group needs the female-only room.'
    },
    fr: {
      title: 'Qui va séjourner ?',
      mixed: 'Hommes seulement',
      female: 'Femmes / Groupe mixte',
      hint: "Choisissez \"Femmes / Groupe mixte\" si quelqu'un du groupe a besoin de la chambre réservée aux femmes."
    },
    de: {
      title: 'Wer übernachtet?',
      mixed: 'Nur Männer',
      female: 'Frauen / Gemischte Gruppe',
      hint: 'Wählen Sie "Frauen / Gemischte Gruppe", wenn jemand aus der Gruppe das Frauenzimmer benötigt.'
    }
  };
  return t[locale]?.[key] || key;
}
