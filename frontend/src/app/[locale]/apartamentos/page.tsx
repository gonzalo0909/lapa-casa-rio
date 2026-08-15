// lapa-casa-hostel/frontend/src/app/[locale]/apartamentos/page.tsx
// Página /apartamentos — muestra el motor de apartamentos como tab activo,
// con el motor de hostel montado en segundo plano (Opción A).

import { setRequestLocale } from 'next-intl/server';
import { ApartmentEngine } from '@/components/booking/apartment-engine';
import { HostelEngine }    from '@/components/booking/hostel-engine';
import { PropertyTabs }    from '@/components/booking/property-tabs';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default async function ApartmentsPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale)
    ? params.locale
    : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main>
      <PropertyTabs locale={locale} defaultTab={1}>
        <HostelEngine    locale={locale} />
        <ApartmentEngine locale={locale as 'pt' | 'es' | 'en'} />
      </PropertyTabs>
    </main>
  );
}
