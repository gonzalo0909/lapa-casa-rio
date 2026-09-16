// lapa-casa-hostel/frontend/src/app/[locale]/page.tsx

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PropertyExperience } from '@/components/booking/property-experience';
import { StructuredData, SpeakableSchema, WebSiteSchema, LocalBusinessSchema } from '@/components/seo/structured-data';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'seo' });
  const title = t('homeTitle');
  const description = t('homeDescription');
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: Object.fromEntries(
        locales.map((l) => [l, `${SITE_URL}/${l}`]),
      ),
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}`,
      siteName: 'Lapa Casa',
      locale,
      type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Lapa Casa — Santa Teresa, Rio de Janeiro' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-image.jpg'] },
  };
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      {/* WebSite + LocalBusiness + Speakable — AEO para motores de IA y asistentes de voz */}
      <StructuredData data={WebSiteSchema} />
      <StructuredData data={LocalBusinessSchema} />
      <StructuredData data={SpeakableSchema} />
      <PropertyExperience locale={locale} />
    </main>
  );
}
