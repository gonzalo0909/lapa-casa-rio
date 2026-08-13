// lapa-casa-hostel/frontend/src/components/booking/property-experience.tsx

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PropertySelectorHero } from './property-selector-hero';
import type { Locale } from '@/i18n';

interface PropertyExperienceProps {
  locale: Locale;
}

/**
 * PropertyExperience
 *
 * Home real: solo el hero selector (Hostel/Apartamentos), sin nada más en
 * la página. El motor de reservas de apartamentos vive en /apartamentos;
 * el motor del hostel vive aparte, en la rama mrh1308 -- acá no queda nada
 * de esa interfaz. El panel "Hostel" del hero se mantiene visible (fiel a
 * la maqueta) pero sin acción: no hay motor al que llevarlo en esta rama.
 */
export const PropertyExperience: React.FC<PropertyExperienceProps> = ({ locale }) => {
  const router = useRouter();

  const handleSelectApartments = () => {
    router.push(`/${locale}/apartamentos`);
  };

  return <PropertySelectorHero onSelectApartments={handleSelectApartments} />;
};
