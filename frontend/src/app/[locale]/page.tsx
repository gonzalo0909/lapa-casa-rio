// lapa-casa-hostel/frontend/src/app/[locale]/page.tsx

import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { BookingEngine } from '@/components/booking/booking-engine';
import { ApartmentEngine } from '@/components/booking/apartment-engine';
import { LandingSection } from '@/components/landing/landing-section';
import { PropertyManagementBanner } from '@/components/booking/property-management-banner';
import { PropertyTabs } from '@/components/booking/property-tabs';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default async function HomePage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'propertyTabs' });

  return (
    <main className="min-h-screen bg-background">
      <LandingSection locale={locale} />
      <PropertyManagementBanner locale={locale} />
      <PropertyTabs
        locale={locale}
        hostelLabel={t('hostel')}
        apartmentsLabel={t('apartments')}
      >
        <BookingEngine locale={locale} />
        <ApartmentEngine locale={locale} />
      </PropertyTabs>
    </main>
  );
}
