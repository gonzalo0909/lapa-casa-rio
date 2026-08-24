// lapa-casa-hostel/frontend/src/app/[locale]/parceiros/page.tsx
// Página pública del contrato de asociación para administradores de propiedad.
// URL: /[locale]/parceiros

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from '@/i18n';
import { PartnerContractPage } from '@/components/partners/partner-contract-page';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasa.com';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'seo' });
  const title = t('partnersTitle');
  const description = t('partnersDescription');
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}/parceiros`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/parceiros`])),
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}/parceiros`,
      siteName: 'Lapa Casa',
      locale,
      type: 'website',
    },
  };
}

export default async function ParceirosPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);

  return <PartnerContractPage locale={locale} />;
}
