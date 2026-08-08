// lapa-casa-hostel/frontend/src/components/booking/property-management-banner.tsx

"use client";

import React from 'react';

/**
 * PropertyManagementBanner Component
 *
 * Aviso comercial en la home, arriba del motor de reservas: invita a
 * dueños de apartamentos a asociarse para que Lapa Casa Hostel administre
 * el alquiler por temporada y la limpieza. No forma parte del flujo de
 * reserva de huéspedes.
 *
 * @component
 */
interface PropertyManagementBannerProps {
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
  className?: string;
}

export const PropertyManagementBanner: React.FC<PropertyManagementBannerProps> = ({
  locale = 'pt',
  className = ''
}) => {
  return (
    <div className={className}>
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <span className="text-3xl">🔑</span>
          <div className="flex-1">
            <p className="font-semibold text-amber-900 text-sm sm:text-base">
              {T('title', locale)}
            </p>
            <p className="text-amber-800 text-xs sm:text-sm">
              {T('subtitle', locale)}
            </p>
          </div>
          <a
            href="mailto:info@lapacasahostel.com"
            className="shrink-0 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            {T('cta', locale)}
          </a>
        </div>
      </div>
    </div>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: {
      title: 'Você tem um apartamento em Santa Teresa ou no Rio?',
      subtitle: 'Fazemos parcerias para administrar seu imóvel para aluguel por temporada — cuidamos também da limpeza.',
      cta: 'Fale conosco'
    },
    es: {
      title: '¿Tenés un apartamento en Santa Teresa o en Río?',
      subtitle: 'Hacemos parcerías para administrar tu propiedad para alquiler por temporada — también nos encargamos de la limpieza.',
      cta: 'Contactanos'
    },
    en: {
      title: 'Do you own an apartment in Santa Teresa or Rio?',
      subtitle: 'We partner with owners to manage short-term rental properties — we also handle the cleaning.',
      cta: 'Contact us'
    },
    fr: {
      title: 'Vous possédez un appartement à Santa Teresa ou à Rio ?',
      subtitle: 'Nous nous associons aux propriétaires pour gérer des locations saisonnières — nous nous occupons aussi du ménage.',
      cta: 'Contactez-nous'
    },
    de: {
      title: 'Besitzen Sie eine Wohnung in Santa Teresa oder Rio?',
      subtitle: 'Wir gehen Partnerschaften ein, um Ferienwohnungen zu verwalten — inklusive Reinigung.',
      cta: 'Kontaktieren Sie uns'
    }
  };
  return t[locale]?.[key] || key;
}
