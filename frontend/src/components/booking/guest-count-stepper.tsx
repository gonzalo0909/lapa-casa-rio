// lapa-casa-hostel/frontend/src/components/booking/guest-count-stepper.tsx

"use client";

import React from 'react';
import { useTranslations } from 'next-intl';

interface GuestCountStepperProps {
  value: number;
  onChange: (count: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

/**
 * Contador +/- de huéspedes que filtra/ordena la grilla de apartamentos
 * por capacidad (ver ApartmentEngine). Puerto de la UX de LCACOPIA
 * (guest-counter-wrap), sin backend propio -- el filtrado ocurre en el
 * cliente sobre la respuesta ya recibida de /availability/apartments.
 */
export const GuestCountStepper: React.FC<GuestCountStepperProps> = ({
  value,
  onChange,
  min = 1,
  max = 4,
  className = '',
}) => {
  const t = useTranslations('apartments');

  return (
    <div
      className={`flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 ${className}`}
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {t('guestCount', { count: value })}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{t('guestCountHint')}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label={t('decreaseGuests')}
          className="w-8 h-8 rounded-lg border border-border bg-background text-foreground font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary hover:text-primary transition-colors"
        >
          −
        </button>
        <span className="w-6 text-center font-bold text-foreground tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label={t('increaseGuests')}
          className="w-8 h-8 rounded-lg border border-border bg-background text-foreground font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary hover:text-primary transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
};
