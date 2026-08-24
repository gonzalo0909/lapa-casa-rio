// lapa-casa-hostel/frontend/src/app/[locale]/apartamentos/page.tsx
// Página /apartamentos — muestra el motor de apartamentos como tab activo,
// con el motor de hostel montado en segundo plano (Opción A).

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ApartmentEngine } from '@/components/booking/apartment-engine';
import { HostelEngine }    from '@/components/booking/hostel-engine';
import { PropertyTabs }    from '@/components/booking/property-tabs';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasa.com';

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

  return (
    <main>
      <PropertyTabs locale={locale} defaultTab={1}>
        <HostelEngine    locale={locale} />
        <ApartmentEngine locale={locale as 'pt' | 'es' | 'en'} />
      </PropertyTabs>
    </main>
  );
}
