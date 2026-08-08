// lapa-casa-hostel/frontend/src/components/layout/site-footer.tsx

import React from 'react';

interface SiteFooterProps {
  locale?: 'pt' | 'es' | 'en' | 'fr' | 'de';
}

export const SiteFooter: React.FC<SiteFooterProps> = ({ locale = 'pt' }) => {
  return (
    <footer className="mt-12 py-6 border-t border-border">
      <div className="max-w-5xl mx-auto px-4 text-center">
        <p className="font-semibold text-foreground tracking-wide">LAPA CASA</p>
        <p className="text-xs text-muted-foreground mt-1">{T('since', locale)}</p>
      </div>
    </footer>
  );
};

function T(key: string, locale: string): string {
  const t: Record<string, Record<string, string>> = {
    pt: { since: 'Desde 2018' },
    es: { since: 'Desde 2018' },
    en: { since: 'Since 2018' },
    fr: { since: 'Depuis 2018' },
    de: { since: 'Seit 2018' },
  };
  return t[locale]?.[key] || key;
}
