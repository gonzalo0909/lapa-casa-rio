import { setRequestLocale } from 'next-intl/server';
import { GuestGallery } from '@/components/gallery/guest-gallery';
import { locales, defaultLocale, type Locale } from '@/i18n';

export default function GalleryPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background">
      <GuestGallery locale={locale} />
    </main>
  );
}
