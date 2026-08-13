import { setRequestLocale } from 'next-intl/server';
import { PaymentConfirmationPage } from '@/components/payment/payment-confirmation-page';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default function PaymentPage({ params }: { params: { locale: string; id: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      <PaymentConfirmationPage bookingId={params.id} locale={locale} />
      <SiteFooter locale={locale} />
    </main>
  );
}
