// lapa-casa-hostel/frontend/src/components/booking/property-experience.tsx

'use client';

import React from 'react';
import { PropertySelectorHero } from './property-selector-hero';
import { PropertyManagementBanner } from './property-management-banner';
import { LandingSection } from '@/components/landing/landing-section';
import type { Locale } from '@/i18n';

interface PropertyExperienceProps {
  locale: Locale;
  children: React.ReactNode;
}

/**
 * PropertyExperience
 *
 * Home real: hero selector (Hostel/Apartamentos) + motor de reservas de
 * apartamentos. El motor de reservas del hostel vive aparte, en la rama
 * mrh1308 -- acá no queda nada de esa interfaz. El panel "Hostel" del hero
 * se mantiene visible (fiel a la maqueta) pero sin acción: no hay motor
 * al que llevarlo en esta rama.
 */
export const PropertyExperience: React.FC<PropertyExperienceProps> = ({ locale, children }) => {
  const handleSelectApartments = () => {
    document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <PropertySelectorHero onSelectApartments={handleSelectApartments} />
      <LandingSection locale={locale} />
      <PropertyManagementBanner locale={locale} />
      <div id="reservar" className="scroll-mt-4 w-full max-w-5xl mx-auto px-4 py-8">
        {children}
      </div>
    </>
  );
};
