import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Inter, Poppins, Cormorant_Garamond } from 'next/font/google';
import Script from 'next/script';
import { locales, type Locale } from '@/i18n';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { CookieConsentProvider } from '@/components/legal/cookie-consent';
import { WhatsAppFloatButton } from '@/components/layout/whatsapp-float-button';
import '../globals.css';

// display:'swap' evita el bloqueo de render en móviles (mejora CLS y FCP)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
  preload: false, // solo pre-cargamos Inter; Poppins se carga en diferido
});
// Fuente serif de marca (títulos "he-brand"/nombres de apartamento/h3) --
// hostel-engine.styles.ts y apartment-engine.module.css ya referenciaban
// var(--font-cormorant) en ~12 lugares, pero nunca se declaraba en ningún
// next/font: la variable no existía nunca, lo que invalida la propiedad
// font-family entera en esas reglas (no cae a Georgia/serif como parecía).
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
  preload: false,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

// themeColor vive aparte de Metadata desde Next 14 -- mismo color que
// manifest.json (idea #45, roadmap.html) para que la barra del navegador
// en mobile combine con la app instalada.
export const viewport: Viewport = {
  themeColor: '#0ea5e9',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

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
    title: {
      default: title,
      template: '%s · Lapa Casa',
    },
    description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      title,
      description,
      siteName: 'Lapa Casa',
      locale,
      type: 'website',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'Lapa Casa — Santa Teresa, Rio de Janeiro',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.jpg'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    // Idea #45 (roadmap.html): PWA real instalable -- el manifest.json ya
    // existía con contenido correcto, pero nada lo enlazaba desde el HTML
    // (sin <link rel="manifest">, ningún navegador lo descubre, así que
    // nunca aparecía el prompt de instalar). También referenciaba
    // screenshots/, icons/ y una página /booking que nunca llegaron a
    // existir -- se reescribió el manifest para que apunte solo a
    // archivos y rutas reales.
    manifest: '/manifest.json',
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${poppins.variable} ${cormorant.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* CookieConsentProvider envuelve a AnalyticsProvider para que este
              último pueda leer si el usuario ya aceptó cookies antes de
              cargar GA4/Facebook Pixel (sección 14 auditoría 17 secciones). */}
          <CookieConsentProvider>
            {/* AnalyticsProvider usa useSearchParams() (next/navigation) para
                trackear page views en cada cambio de ruta -- Next.js exige un
                Suspense boundary alrededor de cualquier consumidor de
                useSearchParams(), si no toda página estática que pase por acá
                (todas, este es el layout raíz) se ve forzada a render dinámico. */}
            <Suspense fallback={<>{children}</>}>
              <AnalyticsProvider>{children}</AnalyticsProvider>
            </Suspense>
          </CookieConsentProvider>
        </NextIntlClientProvider>

        <WhatsAppFloatButton locale={locale as Locale} />

        {/* Registro del Service Worker — mejora PWA y carga offline en móviles */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/' })
                  .catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
