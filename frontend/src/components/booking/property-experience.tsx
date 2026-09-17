// lapa-casa-hostel/frontend/src/components/booking/property-experience.tsx

'use client';

import React from 'react';
import { PropertySelectorHero } from './property-selector-hero';
import type { Locale } from '@/i18n';

interface PropertyExperienceProps {
  locale: Locale;
}

/**
 * PropertyExperience
 *
 * Home: hero selector (Hostel/Apartamentos).
 * Hostel → /hostel (BookingEngine), Apartamentos → /apartamentos (ApartmentEngine).
 *
 * PropertySelectorHero arma sus propios hrefs a partir del locale de la URL
 * actual (auditoría 17 secciones, sección 11 -- antes navegaba con
 * router.push() en un onClick, sin ningún <a href> real).
 */
export const PropertyExperience: React.FC<PropertyExperienceProps> = () => {
  return <PropertySelectorHero />;
};
