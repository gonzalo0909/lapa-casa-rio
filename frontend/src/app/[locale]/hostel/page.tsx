// lapa-casa-hostel/frontend/src/app/[locale]/hostel/page.tsx
// Página /hostel — solo el motor de hostel, sin tab de apartamentos.
// Ambos motores son independientes: el huésped de hostel no ve apartamentos
// desde aquí, y el de apartamentos no ve el hostel desde /apartamentos.
// Para pasar de uno a otro hay que volver al home (/).

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { HostelEngine } from '@/components/booking/hostel-engine-lazy';
import { FAQSection } from '@/components/seo/faq-section';
import { StructuredData, LocalBusinessSchema } from '@/components/seo/structured-data';
import { locales, defaultLocale, type Locale } from '@/i18n';

// JSON-LD HowTo: cómo reservar en el hostel (AEO — motores de IA)
const HowToBookSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to book at Lapa Casa Rio',
  description:
    'Step-by-step guide to reserving beds or full dormitories at Lapa Casa Rio in Santa Teresa, Rio de Janeiro.',
  totalTime: 'PT5M',
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Choose your dates',
      text: 'Select your check-in and check-out dates using the booking calendar on our website.',
      url: 'https://lapacasario.com/en/hostel',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Select your beds or room',
      text: 'Pick the number of beds or choose a full dormitory (Mixto 12A, Mixto 12B, Mixto 7 or Flexible 7). Groups of 6+ get automatic discounts.',
      url: 'https://lapacasario.com/en/hostel',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Fill in guest information',
      text: 'Enter your name, email, and number of guests. Group leader fills in once for the whole group.',
      url: 'https://lapacasario.com/en/hostel',
    },
    {
      '@type': 'HowToStep',
      position: 4,
      name: 'Choose your payment method',
      text: 'Pay securely by credit card (Stripe), PIX, or Mercado Pago. Installment payments are available.',
      url: 'https://lapacasario.com/en/hostel',
    },
    {
      '@type': 'HowToStep',
      position: 5,
      name: 'Confirm and receive your booking',
      text: 'You will receive an instant confirmation email with your booking details and check-in instructions.',
      url: 'https://lapacasario.com/en/hostel',
    },
  ],
};

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
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/hostel`])),
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
  const locale = (
    locales.includes(params.locale as Locale) ? params.locale : defaultLocale
  ) as Locale;
  setRequestLocale(locale);

  // Sin PropertyTabs — el huésped de hostel no ve el tab de apartamentos
  return (
    <main>
      {/* JSON-LD: LocalBusiness + HowTo (AEO). Auditoría 17 secciones,
          sección 11: antes también incluía OrganizationSchema acá, mismo
          @type de negocio que LocalBusinessSchema (dirección/teléfono
          repetidos) -- ya se había limpiado esta duplicación en la home,
          quedó pendiente en esta página. */}
      <StructuredData data={LocalBusinessSchema} />
      <StructuredData data={HowToBookSchema} />

      <HostelEngine locale={locale} />

      {/* FAQ visible + JSON-LD FAQPage (AEO: ChatGPT, Perplexity, Gemini, Grok, Copilot) */}
      <FAQSection locale={locale} pageName="hostel" />
    </main>
  );
}
