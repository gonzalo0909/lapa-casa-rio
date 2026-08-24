// lapa-casa-hostel/frontend/src/app/[locale]/page.tsx

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PropertyExperience } from '@/components/booking/property-experience';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasa.com';

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

/** JSON-LD structured data — LodgingBusiness + two sub-properties */
function JsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: 'Lapa Casa',
    url: SITE_URL,
    description:
      'Hostel boutique y apartamentos privados en Santa Teresa, Río de Janeiro. Reserva directa, mejor precio garantizado.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Rio de Janeiro',
      addressRegion: 'RJ',
      addressCountry: 'BR',
      streetAddress: 'Santa Teresa',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: -22.9167,
      longitude: -43.1931,
    },
    image: `${SITE_URL}/og-image.jpg`,
    priceRange: '$$',
    telephone: '',
    starRating: { '@type': 'Rating', ratingValue: '4' },
    amenityFeature: [
      { '@type': 'LocationFeatureSpecification', name: 'Free WiFi', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Kitchen', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Private rooms', value: true },
    ],
    hasMap: 'https://maps.google.com/?q=Santa+Teresa+Rio+de+Janeiro',
    sameAs: [],
    containsPlace: [
      {
        '@type': 'Room',
        name: 'Hostel Dormitório',
        description: 'Camas em dormitórios mistos e femininos com capacidade de 7 a 12 pessoas.',
      },
      {
        '@type': 'Apartment',
        name: 'Apartamentos privados',
        description: 'Apartamentos privativos com cozinha em Santa Teresa, Rio de Janeiro.',
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      <JsonLd />
      <PropertyExperience locale={locale} />
    </main>
  );
}
