// lapa-casa-hostel/frontend/src/app/[locale]/hostel/page.tsx

import { setRequestLocale } from 'next-intl/server';
import { HostelEngine } from '@/components/booking/hostel-engine';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default async function HostelPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main>
      <HostelEngine locale={locale} />
    </main>
  );
}
