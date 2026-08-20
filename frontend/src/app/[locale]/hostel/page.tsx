// lapa-casa-hostel/frontend/src/app/[locale]/hostel/page.tsx
// Página /hostel — muestra el motor de hostel como tab activo,
// con el motor de apartamentos montado en segundo plano (Opción A).

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HostelEngine }    from '@/components/booking/hostel-engine';
import { ApartmentEngine } from '@/components/booking/apartment-engine';
import { PropertyTabs }    from '@/components/booking/property-tabs';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasahostel.com';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'seo' });
  const title = t('hostelTitle');
  const description = t('hostelDescription');
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}/hostel`,
      languages: Object.fromEntries(
        locales.map((l) => [l, `${SITE_URL}/${l}/hostel`]),
      ),
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}/hostel`,
      siteName: 'Lapa Casa Hostel',
      locale,
      type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-image.jpg'] },
  };
}

export default async function HostelPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale)
    ? params.locale
    : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main>
      <PropertyTabs locale={locale} defaultTab={0}>
        <HostelEngine    locale={locale} />
        <ApartmentEngine locale={locale as 'pt' | 'es' | 'en'} />
      </PropertyTabs>
    </main>
  );
}
