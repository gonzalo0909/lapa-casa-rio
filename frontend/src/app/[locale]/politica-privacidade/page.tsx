// lapa-casa-hostel/frontend/src/app/[locale]/politica-privacidade/page.tsx
//
// Sección 14 — alias canônico em português para a Política de Privacidade.
// O banner de cookies e termos-hospede já linkam para /<locale>/privacy
// (rota existente com todo o conteúdo LGPD). Esta rota redireciona lá para
// que URLs em português como "/pt/politica-privacidade" também funcionem
// corretamente (bookmarks, links externos, busca orgânica).

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  return {
    alternates: {
      canonical: `${SITE_URL}/${locale}/privacy`,
    },
    robots: { index: false, follow: true },
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function PoliticaPrivacidadePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const safeLocale = (locales.includes(locale as Locale) ? locale : defaultLocale) as Locale;
  redirect(`/${safeLocale}/privacy`);
}
