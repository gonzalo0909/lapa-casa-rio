// lapa-casa-hostel/frontend/src/app/[locale]/hostel/page.tsx

import { setRequestLocale } from 'next-intl/server';
import { BookingEngine } from '@/components/booking/booking-engine';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default async function HostelPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      <div className="w-full max-w-5xl mx-auto px-4 py-8">
        <BookingEngine locale={locale} />
      </div>
    </main>
  );
}
