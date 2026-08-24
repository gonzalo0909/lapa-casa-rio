// lapa-casa-hostel/frontend/src/app/[locale]/apartamentos/page.tsx
// Página /apartamentos — solo el motor de apartamentos, sin tab de hostel.
// El tab de Hostel no aparece aquí: el huésped de apartamento no ve la
// dirección del hostel ni tiene acceso cruzado desde esta página.

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ApartmentEngine } from '@/components/booking/apartment-engine';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'seo' });
  const title = t('apartmentsTitle');
  const description = t('apartmentsDescription');
  return {
    title,
    description,
    // Sin noindex — Google debe indexar /apartamentos con su propio SEO
    alternates: {
      canonical: `${SITE_URL}/${locale}/apartamentos`,
      languages: Object.fromEntries(
        locales.map((l) => [l, `${SITE_URL}/${l}/apartamentos`]),
      ),
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}/apartamentos`,
      siteName: 'Lapa Casa',
      locale,
      type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-image.jpg'] },
  };
}

export default async function ApartmentsPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale)
    ? params.locale
    : defaultLocale) as Locale;
  setRequestLocale(locale);

  // Sin PropertyTabs — el huésped de apartamentos no ve el tab de hostel
  // Para ver el hostel debe volver al home (/)
  return (
    <main>
      <ApartmentEngine locale={locale as 'pt' | 'es' | 'en'} />
    </main>
  );
}
