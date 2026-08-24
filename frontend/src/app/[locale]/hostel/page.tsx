// lapa-casa-hostel/frontend/src/app/[locale]/hostel/page.tsx
// Página /hostel — solo el motor de hostel, sin tab de apartamentos.
// Ambos motores son independientes: el huésped de hostel no ve apartamentos
// desde aquí, y el de apartamentos no ve el hostel desde /apartamentos.
// Para pasar de uno a otro hay que volver al home (/).

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HostelEngine } from '@/components/booking/hostel-engine';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

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
      siteName: 'Lapa Casa',
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

  // Sin PropertyTabs — el huésped de hostel no ve el tab de apartamentos
  return (
    <main>
      <HostelEngine locale={locale} />
    </main>
  );
}
