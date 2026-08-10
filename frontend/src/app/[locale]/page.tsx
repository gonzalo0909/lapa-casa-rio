// lapa-casa-hostel/frontend/src/app/[locale]/page.tsx

import { setRequestLocale } from 'next-intl/server';
import { BookingEngine } from '@/components/booking/booking-engine';
import { LandingSection } from '@/components/landing/landing-section';
import { PropertyManagementBanner } from '@/components/booking/property-management-banner';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default function HomePage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      <LandingSection locale={locale} />
      <PropertyManagementBanner locale={locale} />
      <BookingEngine locale={locale} />
    </main>
  );
}
