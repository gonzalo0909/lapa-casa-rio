import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { GuestGallery } from '@/components/gallery/guest-gallery';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'seo' });
  const title = t('galleryTitle');
  const description = t('galleryDescription');
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}/galeria`,
      languages: Object.fromEntries(
        locales.map((l) => [l, `${SITE_URL}/${l}/galeria`]),
      ),
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}/galeria`,
      siteName: 'Lapa Casa',
      locale,
      type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-image.jpg'] },
  };
}

export default function GalleryPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      <GuestGallery locale={locale} />
      <SiteFooter locale={locale} />
    </main>
  );
}
