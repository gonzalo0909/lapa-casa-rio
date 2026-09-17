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

        <nav className="flex flex-wrap justify-center gap-4 mt-4">
          <Link href={`/${locale}/galeria`} className="text-xs text-primary hover:underline">
            {t('gallery')}
          </Link>
          <Link href={`/${locale}/santa-teresa`} className="text-xs text-primary hover:underline">
            {t('santaTeresa')}
          </Link>
          <Link href={`/${locale}/grupos`} className="text-xs text-primary hover:underline">
            {t('grupos')}
          </Link>
          <Link href={`/${locale}/tour`} className="text-xs text-primary hover:underline">
            {t('tour')}
          </Link>
          <Link href={`/${locale}/privacy`} className="text-xs text-primary hover:underline">
            {t('privacy')}
          </Link>
          <Link href={`/${locale}/termos-hospede`} className="text-xs text-primary hover:underline">
            {t('terms')}
          </Link>
        </nav>
      </div>
    </footer>
  );
};
