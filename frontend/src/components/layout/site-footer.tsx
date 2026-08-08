// lapa-casa-hostel/frontend/src/components/layout/site-footer.tsx

import React from 'react';
import Link from 'next/link';

interface SiteFooterProps {
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

export const SiteFooter: React.FC<SiteFooterProps> = ({ locale = 'pt' }) => {
  return (
    <footer className="mt-12 py-6 border-t border-border">
      <div className="max-w-5xl mx-auto px-4 text-center">
        <p className="font-semibold text-foreground tracking-wide">LAPA CASA</p>
        <p className="text-xs text-muted-foreground mt-1">{T('since', locale)}</p>
        <Link href={`/${locale}/galeria`} className="text-xs text-primary hover:underline mt-3 inline-block">
          {T('gallery', locale)}
        </Link>
      </div>
    </footer>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: { since: 'Desde 2018', gallery: 'Bitácora de Viajantes' },
    es: { since: 'Desde 2018', gallery: 'Bitácora de Viajantes' },
    en: { since: 'Since 2018', gallery: 'Travelers\' Logbook' },
    fr: { since: 'Depuis 2018', gallery: 'Carnet de Voyageurs' },
    de: { since: 'Seit 2018', gallery: 'Reisetagebuch' },
  };
  return t[locale]?.[key] || key;
}
