// lapa-casa-hostel/frontend/src/components/booking/property-experience.tsx

'use client';

import React, { useState } from 'react';
import { PropertySelectorHero } from './property-selector-hero';
import { PropertyManagementBanner } from './property-management-banner';
import { PropertyTabs } from './property-tabs';
import { LandingSection } from '@/components/landing/landing-section';
import type { Locale } from '@/i18n';

interface PropertyExperienceProps {
  locale: Locale;
  hostelLabel: string;
  apartmentsLabel: string;
  children: [React.ReactNode, React.ReactNode];
}

/**
 * PropertyExperience
 *
 * Junta el hero selector (Hostel/Apartamentos) con el motor de reservas
 * real: mantiene el estado de qué pestaña está activa para que elegir un
 * panel del hero mueva PropertyTabs y haga scroll hasta ahí.
 */
export const PropertyExperience: React.FC<PropertyExperienceProps> = ({
  locale,
  hostelLabel,
  apartmentsLabel,
  children,
}) => {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  const handleSelect = (tab: 0 | 1) => {
    setActiveTab(tab);
    document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <PropertySelectorHero activeTab={activeTab} onSelect={handleSelect} />
      <LandingSection locale={locale} />
      <PropertyManagementBanner locale={locale} />
      <div id="reservar" className="scroll-mt-4">
        <PropertyTabs
          locale={locale}
          hostelLabel={hostelLabel}
          apartmentsLabel={apartmentsLabel}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {children[0]}
          {children[1]}
        </PropertyTabs>
      </div>
    </>
  );
};
