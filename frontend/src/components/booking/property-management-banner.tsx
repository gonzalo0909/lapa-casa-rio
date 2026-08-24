// lapa-casa-hostel/frontend/src/components/booking/property-management-banner.tsx

"use client";

import React from 'react';

/**
 * PropertyManagementBanner Component
 *
 * Aviso comercial en la home, arriba del motor de reservas: invita a
 * dueños de apartamentos a asociarse para que Lapa Casa administre
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
            href={`https://wa.me/5521977157530?text=${encodeURIComponent(T('whatsappMessage', locale))}`}
            target="_blank"
            rel="noopener noreferrer"
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
      title: 'Seu apartamento rendendo no Rio de Janeiro, sem você mexer um dedo.',
      subtitle: 'Cuidamos de tudo: gestão do aluguel por temporada, hóspedes e limpeza. Você só recebe.',
      cta: 'Quero saber mais',
      whatsappMessage: 'Olá! Tenho um apartamento no Rio de Janeiro e quero saber mais sobre a gestão de aluguel por temporada.'
    },
    es: {
      title: 'Tu apartamento generando ingresos en Río de Janeiro, sin mover un dedo.',
      subtitle: 'Nos encargamos de todo: gestión del alquiler por temporada, huéspedes y limpieza. Vos solo cobrás.',
      cta: 'Quiero saber más',
      whatsappMessage: '¡Hola! Tengo un apartamento en Río de Janeiro y quiero saber más sobre la gestión de alquiler por temporada.'
    },
    en: {
      title: 'Your apartment earning in Rio de Janeiro, without you lifting a finger.',
      subtitle: "We handle everything: short-term rental management, guests, and cleaning. You just collect.",
      cta: 'Tell me more',
      whatsappMessage: 'Hi! I have an apartment in Rio de Janeiro and I want to know more about your short-term rental management.'
    },
    fr: {
      title: 'Votre appartement génère des revenus à Rio de Janeiro, sans que vous ayez à vous en occuper.',
      subtitle: 'On s’occupe de tout : gestion de la location saisonnière, voyageurs et ménage. Vous n’avez qu’à encaisser.',
      cta: 'En savoir plus',
      whatsappMessage: 'Bonjour ! J’ai un appartement à Rio de Janeiro et je voudrais en savoir plus sur votre gestion de location saisonnière.'
    },
    de: {
      title: 'Ihre Wohnung in Rio de Janeiro bringt Einnahmen, ohne dass Sie etwas tun müssen.',
      subtitle: 'Wir kümmern uns um alles: Verwaltung der Ferienvermietung, Gäste und Reinigung. Sie kassieren einfach.',
      cta: 'Mehr erfahren',
      whatsappMessage: 'Hallo! Ich habe eine Wohnung in Rio de Janeiro und möchte mehr über Ihre Verwaltung von Ferienwohnungen erfahren.'
    }
  };
  return t[locale]?.[key] || key;
}
