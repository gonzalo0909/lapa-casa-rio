import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { PaymentConfirmationPage } from '@/components/payment/payment-confirmation-page';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

// Auditoría 17 secciones, sección 11: esta página no tenía metadata propia,
// así que heredaba el canonical de la home (duplicado) y quedaba indexable
// con el ID de reserva real en la URL -- cada confirmación de pago es
// privada, no contenido para buscar. noindex explícito + canonical propio
// (en vez de heredar el de la home) + bloqueo en robots.ts (defensa
// adicional para bots que no respeten el meta tag).
export function generateMetadata({ params }: { params: { locale: string; id: string } }): Metadata {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  return {
    title: 'Lapa Casa Rio',
    robots: { index: false, follow: false },
    alternates: {
      canonical: `${SITE_URL}/${locale}/payment/${params.id}`,
    },
  };
}

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
