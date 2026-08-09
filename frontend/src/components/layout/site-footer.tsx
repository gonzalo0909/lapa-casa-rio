// lapa-casa-hostel/frontend/src/components/layout/site-footer.tsx

import React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n';

interface SiteFooterProps {
  locale?: Locale;
}

export const SiteFooter: React.FC<SiteFooterProps> = async ({ locale = 'pt' }) => {
  const t = await getTranslations({ locale, namespace: 'footer' });

  return (
    <footer className="mt-12 py-6 border-t border-border">
      <div className="max-w-5xl mx-auto px-4 text-center">
        <p className="font-semibold text-foreground tracking-wide">LAPA CASA</p>
        <p className="text-xs text-muted-foreground mt-1">{t('since')}</p>
        <Link
          href={`/${locale}/galeria`}
          className="text-xs text-primary hover:underline mt-3 inline-block"
        >
          {t('gallery')}
        </Link>
      </div>
    </footer>
  );
};
