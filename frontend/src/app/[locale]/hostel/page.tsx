// lapa-casa-hostel/frontend/src/app/[locale]/hostel/page.tsx
// Página /hostel — muestra el motor de hostel como tab activo,
// con el motor de apartamentos montado en segundo plano (Opción A).

import { setRequestLocale } from 'next-intl/server';
import { HostelEngine }    from '@/components/booking/hostel-engine';
import { ApartmentEngine } from '@/components/booking/apartment-engine';
import { PropertyTabs }    from '@/components/booking/property-tabs';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default async function HostelPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale)
    ? params.locale
    : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main>
      <PropertyTabs locale={locale} defaultTab={0}>
        <HostelEngine    locale={locale} />
        <ApartmentEngine locale={locale as 'pt' | 'es' | 'en'} />
      </PropertyTabs>
    </main>
  );
}
