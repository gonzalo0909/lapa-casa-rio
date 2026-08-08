// lapa-casa-hostel/frontend/src/components/booking/special-requests.tsx

"use client";

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import type { GuestDetails } from '@/types/global';

interface SpecialRequestsProps {
  formData: Partial<GuestDetails>;
  onChange: (field: keyof GuestDetails, value: string) => void;
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

export const SpecialRequests: React.FC<SpecialRequestsProps> = ({
  formData,
  onChange,
  locale = 'pt',
  className = ''
}) => {
  return (
    <div className={`special-requests space-y-4 ${className}`}>
      <h3 className="font-semibold text-gray-900 mb-4">{T('title', locale)}</h3>

      <div>
        <label htmlFor="arrivalTime" className="block text-sm font-medium text-gray-700 mb-2">
          {T('arrivalTime', locale)}
        </label>
        <Select
          id="arrivalTime"
          value={formData.arrivalTime || ''}
          onChange={(e) => onChange('arrivalTime', e.target.value)}
          placeholder={T('selectTime', locale)}
          options={[
            { value: 'morning', label: '08:00 - 12:00' },
            { value: 'afternoon', label: '12:00 - 18:00' },
            { value: 'evening', label: '18:00 - 22:00' },
            { value: 'night', label: '22:00 - 02:00' },
          ]}
        />
        <p className="text-xs text-gray-500 mt-1">{T('arrivalHelp', locale)}</p>
      </div>

      <div>
        <label htmlFor="dietaryRestrictions" className="block text-sm font-medium text-gray-700 mb-2">
          {T('dietary', locale)}
        </label>
        <Select
          id="dietaryRestrictions"
          value={formData.dietaryRestrictions || ''}
          onChange={(e) => onChange('dietaryRestrictions', e.target.value)}
          placeholder={T('selectDietary', locale)}
          options={[
            { value: 'none', label: T('none', locale) },
            { value: 'vegetarian', label: T('vegetarian', locale) },
            { value: 'vegan', label: T('vegan', locale) },
            { value: 'gluten-free', label: T('glutenFree', locale) },
            { value: 'lactose-free', label: T('lactoseFree', locale) },
            { value: 'other', label: T('other', locale) },
          ]}
        />
      </div>

      <div>
        <label htmlFor="specialRequests" className="block text-sm font-medium text-gray-700 mb-2">
          {T('requests', locale)}
        </label>
        <Textarea
          id="specialRequests"
          value={formData.specialRequests || ''}
          onChange={(e) => onChange('specialRequests', e.target.value)}
          placeholder={T('requestsPlaceholder', locale)}
          rows={4}
          maxLength={500}
        />
        <p className="text-xs text-gray-500 mt-1">
          {(formData.specialRequests || '').length}/500 {T('characters', locale)}
        </p>
      </div>

      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          ℹ️ {T('requestsNote', locale)}
        </p>
      </div>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Solicitações Especiais',
      arrivalTime: 'Horário Previsto de Chegada',
      selectTime: 'Selecione o horário',
      arrivalHelp: 'Check-in a partir das 14:00',
      dietary: 'Restrições Alimentares',
      selectDietary: 'Selecione uma opção',
      none: 'Nenhuma',
      vegetarian: 'Vegetariano',
      vegan: 'Vegano',
      glutenFree: 'Sem glúten',
      lactoseFree: 'Sem lactose',
      other: 'Outro',
      requests: 'Solicitações Adicionais',
      requestsPlaceholder: 'Andar alto, cama inferior, próximo ao banheiro...',
      characters: 'caracteres',
      requestsNote: 'Faremos o possível para atender, mas não podemos garantir'
    },
    es: {
      title: 'Solicitudes Especiales',
      arrivalTime: 'Hora Prevista de Llegada',
      selectTime: 'Selecciona la hora',
      arrivalHelp: 'Check-in desde las 14:00',
      dietary: 'Restricciones Alimentarias',
      selectDietary: 'Selecciona una opción',
      none: 'Ninguna',
      vegetarian: 'Vegetariano',
      vegan: 'Vegano',
      glutenFree: 'Sin gluten',
      lactoseFree: 'Sin lactosa',
      other: 'Otro',
      requests: 'Solicitudes Adicionales',
      requestsPlaceholder: 'Piso alto, cama inferior, cerca del baño...',
      characters: 'caracteres',
      requestsNote: 'Haremos lo posible, pero no podemos garantizar'
    },
    en: {
      title: 'Special Requests',
      arrivalTime: 'Expected Arrival Time',
      selectTime: 'Select time',
      arrivalHelp: 'Check-in from 14:00',
      dietary: 'Dietary Restrictions',
      selectDietary: 'Select an option',
      none: 'None',
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      glutenFree: 'Gluten-free',
      lactoseFree: 'Lactose-free',
      other: 'Other',
      requests: 'Additional Requests',
      requestsPlaceholder: 'High floor, lower bunk, near bathroom...',
      characters: 'characters',
      requestsNote: 'We will do our best but cannot guarantee'
    },
    fr: {
      title: 'Demandes Spéciales',
      arrivalTime: 'Heure d’Arrivée Prévue',
      selectTime: 'Sélectionnez l’heure',
      arrivalHelp: 'Arrivée à partir de 14h00',
      dietary: 'Restrictions Alimentaires',
      selectDietary: 'Sélectionnez une option',
      none: 'Aucune',
      vegetarian: 'Végétarien',
      vegan: 'Végan',
      glutenFree: 'Sans gluten',
      lactoseFree: 'Sans lactose',
      other: 'Autre',
      requests: 'Demandes Supplémentaires',
      requestsPlaceholder: 'Étage élevé, lit du bas, proche des toilettes...',
      characters: 'caractères',
      requestsNote: 'Nous ferons de notre mieux, sans garantie'
    },
    de: {
      title: 'Besondere Wünsche',
      arrivalTime: 'Voraussichtliche Ankunftszeit',
      selectTime: 'Uhrzeit wählen',
      arrivalHelp: 'Check-in ab 14:00 Uhr',
      dietary: 'Ernährungseinschränkungen',
      selectDietary: 'Option wählen',
      none: 'Keine',
      vegetarian: 'Vegetarisch',
      vegan: 'Vegan',
      glutenFree: 'Glutenfrei',
      lactoseFree: 'Laktosefrei',
      other: 'Andere',
      requests: 'Zusätzliche Wünsche',
      requestsPlaceholder: 'Hohes Stockwerk, unteres Bett, nahe Badezimmer...',
      characters: 'Zeichen',
      requestsNote: 'Wir tun unser Bestes, können es aber nicht garantieren'
    }
  };
  return t[locale]?.[key] || key;
}
