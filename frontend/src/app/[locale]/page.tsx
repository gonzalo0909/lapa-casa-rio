// lapa-casa-hostel/frontend/src/app/[locale]/page.tsx

import { setRequestLocale, getTranslations } from 'next-intl/server';
import { BookingEngine } from '@/components/booking/booking-engine';
import { ApartmentEngine } from '@/components/booking/apartment-engine';
import { PropertyExperience } from '@/components/booking/property-experience';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default async function HomePage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'propertyTabs' });

  return (
    <main className="min-h-screen bg-background">
      <PropertyExperience
        locale={locale}
        hostelLabel={t('hostel')}
        apartmentsLabel={t('apartments')}
      >
        <BookingEngine locale={locale} />
        <ApartmentEngine locale={locale} />
      </PropertyExperience>
    </main>
  );
}
