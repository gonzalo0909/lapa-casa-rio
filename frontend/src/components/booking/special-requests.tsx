// lapa-casa-hostel/frontend/src/components/booking/special-requests.tsx

"use client";

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import type { GuestDetails } from '@/types/global';

interface SpecialRequestsProps {
  formData: Partial<GuestDetails>;
  onChange: (field: keyof GuestDetails, value: string) => void;
  locale?: 'pt' | 'es' | 'en';
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
        >
          <option value="">{T('selectTime', locale)}</option>
          <option value="morning">08:00 - 12:00</option>
          <option value="afternoon">12:00 - 18:00</option>
          <option value="evening">18:00 - 22:00</option>
          <option value="night">22:00 - 02:00</option>
        </Select>
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
        >
          <option value="">{T('selectDietary', locale)}</option>
          <option value="none">{T('none', locale)}</option>
          <option value="vegetarian">{T('vegetarian', locale)}</option>
          <option value="vegan">{T('vegan', locale)}</option>
          <option value="gluten-free">{T('glutenFree', locale)}</option>
          <option value="lactose-free">{T('lactoseFree', locale)}</option>
          <option value="other">{T('other', locale)}</option>
        </Select>
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
    }
  };
  return t[locale]?.[key] || key;
}
