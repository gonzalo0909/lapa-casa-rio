import { setRequestLocale } from 'next-intl/server';
import { BookingEngine } from '@/components/booking/booking-engine';
import { LandingSection } from '@/components/landing/landing-section';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default function HomePage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale)
    ? params.locale
    : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      {/* ── Presentación del hostel ── */}
      <LandingSection locale={locale} />

      {/* ── Motor de reservas ── */}
      <section id="reservar" className="scroll-mt-4">
        <BookingEngine locale={locale} />
      </section>
    </main>
  );
}
