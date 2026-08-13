// lapa-casa-hostel/frontend/src/app/[locale]/page.tsx

import { setRequestLocale } from 'next-intl/server';
import { ApartmentEngine } from '@/components/booking/apartment-engine';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default async function HomePage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      <ApartmentEngine locale={locale} />
    </main>
  );
}
