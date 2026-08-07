import { setRequestLocale } from 'next-intl/server';
import { BookingEngine } from '@/components/booking/booking-engine';

type Locale = 'pt' | 'es' | 'en';

export default function HomePage({ params }: { params: { locale: string } }) {
  const locale = (['pt', 'es', 'en'].includes(params.locale) ? params.locale : 'pt') as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      <BookingEngine locale={locale} />
    </main>
  );
}
