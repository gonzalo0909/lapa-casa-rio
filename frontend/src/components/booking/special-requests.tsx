// lapa-casa-hostel/frontend/src/components/booking/special-requests.tsx

"use client";

import React from 'react';
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
          {T('arrivalTime', locale)} <span className="text-red-500">*</span>
        </label>
        <Select
          id="arrivalTime"
          value={formData.arrivalTime || ''}
          onChange={(e) => onChange('arrivalTime', e.target.value)}
          placeholder={T('selectTime', locale)}
          options={[
            { value: '14-16', label: '14:00 - 16:00' },
            { value: '16-18', label: '16:00 - 18:00' },
            { value: '18-20', label: '18:00 - 20:00' },
            { value: '20-22', label: '20:00 - 22:00' },
          ]}
        />
        <p className="text-xs text-gray-500 mt-1">{T('arrivalHelp', locale)}</p>
      </div>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Horário de Chegada',
      arrivalTime: 'Horário Previsto de Chegada',
      selectTime: 'Selecione o horário',
      arrivalHelp: 'Check-in das 14:00 às 22:00'
    },
    es: {
      title: 'Horario de Llegada',
      arrivalTime: 'Hora Prevista de Llegada',
      selectTime: 'Selecciona la hora',
      arrivalHelp: 'Check-in de 14:00 a 22:00'
    },
    en: {
      title: 'Arrival Time',
      arrivalTime: 'Expected Arrival Time',
      selectTime: 'Select time',
      arrivalHelp: 'Check-in from 14:00 to 22:00'
    },
    fr: {
      title: "Heure d'Arrivée",
      arrivalTime: "Heure d'Arrivée Prévue",
      selectTime: "Sélectionnez l'heure",
      arrivalHelp: 'Arrivée de 14h00 à 22h00'
    },
    de: {
      title: 'Ankunftszeit',
      arrivalTime: 'Voraussichtliche Ankunftszeit',
      selectTime: 'Uhrzeit wählen',
      arrivalHelp: 'Check-in von 14:00 bis 22:00 Uhr'
    }
  };
  return t[locale]?.[key] || key;
}
