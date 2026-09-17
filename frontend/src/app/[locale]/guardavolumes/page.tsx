// lapa-casa-hostel/frontend/src/app/[locale]/guardavolumes/page.tsx
//
// Malas/Guardavolumes: guarda-equipaje abierto a cualquier persona en
// Rio de Janeiro, no solo a huéspedes de Lapa Casa -- antes del check-in,
// antes de viajar, de paso por Santa Teresa, etc. Precio/días/horario
// vienen de system_config.luggage_storage (editable desde
// /admin/pricing.html), con fallback si el backend no responde.

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { ArrowLeft, Luggage, Clock, Wallet } from 'lucide-react';
import { StructuredData } from '@/components/seo/structured-data';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5521977157530';

const DEFAULT_LUGGAGE_STORAGE = {
  price: 30,
  days: 'Todos los días',
  startTime: '08:00',
  endTime: '22:00',
};

/** Editable desde /admin/pricing.html (system_config.luggage_storage). */
async function getLuggageStorage(): Promise<typeof DEFAULT_LUGGAGE_STORAGE> {
  try {
    const res = await fetch(`${API_URL}/rooms`, { next: { revalidate: 300 } });
    if (!res.ok) {
      return DEFAULT_LUGGAGE_STORAGE;
    }
    const json = await res.json();
    const ls = json?.data?.policies?.luggageStorage;
    if (!ls || typeof ls.price !== 'number' || !ls.days || !ls.startTime || !ls.endTime) {
      return DEFAULT_LUGGAGE_STORAGE;
    }
    return { price: ls.price, days: ls.days, startTime: ls.startTime, endTime: ls.endTime };
  } catch {
    return DEFAULT_LUGGAGE_STORAGE;
  }
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const title = 'Guarda-equipaje en Santa Teresa — Malas/Guardavolumes | Lapa Casa';
  const description =
    'Deja tu equipaje en Lapa Casa Rio, Santa Teresa, aunque no te hospedes acá. Antes del check-in, antes de viajar, o de paso por Rio de Janeiro.';
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}/guardavolumes`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/guardavolumes`])),
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}/guardavolumes`,
      siteName: 'Lapa Casa',
      locale,
      type: 'website',
    },
  };
}

const USE_CASES = [
  {
    title: 'Llegaste antes del check-in',
    text: 'Tu vuelo aterrizó temprano y el cuarto todavía no está listo. Deja la mochila y sal a caminar Santa Teresa con las manos libres.',
  },
  {
    title: 'Te vas de viaje a la noche',
    text: 'Hiciste el check-out pero tu vuelo o bus sale recién de noche. Guarda el equipaje y aprovecha el día en Rio sin cargar nada.',
  },
  {
    title: 'Estás de paso por el barrio',
    text: 'No te hospedas en Lapa Casa, pero estás recorriendo Santa Teresa con la maleta a cuestas. Te la guardamos mientras conoces el barrio.',
  },
  {
    title: 'Cambiaste de alojamiento',
    text: 'Sales de un hotel y entras a otro más tarde, en cualquier punto de Rio. Deja el equipaje aquí y muévete ligero por la ciudad.',
  },
];

export default async function GuardavolumesPage({ params }: { params: { locale: string } }) {
  const locale = (
    locales.includes(params.locale as Locale) ? params.locale : defaultLocale
  ) as Locale;
  setRequestLocale(locale);
  const luggageStorage = await getLuggageStorage();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Guarda-equipaje Lapa Casa — Santa Teresa',
    description:
      'Guarda-equipaje abierto a cualquier huésped en Rio de Janeiro, no solo a huéspedes del hostel.',
    provider: { '@type': 'LodgingBusiness', name: 'Lapa Casa', url: SITE_URL },
    areaServed: { '@type': 'City', name: 'Rio de Janeiro', addressCountry: 'BR' },
    offers: {
      '@type': 'Offer',
      price: String(luggageStorage.price),
      priceCurrency: 'BRL',
      description: `Diaria de guarda-equipaje, ${luggageStorage.days}, ${luggageStorage.startTime}–${luggageStorage.endTime}`,
    },
  };

  return (
    <main className="min-h-screen bg-background">
      <StructuredData data={schema} />

      {/* ── Hero ── */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-4">
            Santa Teresa · Rio de Janeiro
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-6 leading-tight">
            ¿Tienes que dejar la maleta en algún lado?
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
            No hace falta ser huésped de Lapa Casa. Te guardamos el equipaje en Santa Teresa estés
            yendo, viniendo, o simplemente dando una vuelta por Rio — para que camines liviano y
            disfrutes el día sin cargar nada.
          </p>
        </div>
      </section>

      {/* ── Precio / horario ── */}
      <section className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-card border border-border rounded-xl p-6 flex flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Diaria</div>
              <div className="text-lg font-semibold text-foreground">R$ {luggageStorage.price}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Horario</div>
              <div className="text-lg font-semibold text-foreground">
                {luggageStorage.startTime} a {luggageStorage.endTime}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Luggage className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Días</div>
              <div className="text-lg font-semibold text-foreground">{luggageStorage.days}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Casos de uso ── */}
      <div className="max-w-3xl mx-auto px-4">
        <section className="py-12 border-b border-border">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-6">
            ¿Cuándo te sirve?
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {USE_CASES.map((uc, i) => (
              <div key={i} className="border border-border rounded-lg bg-card p-5">
                <h3 className="font-semibold text-foreground mb-2">{uc.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{uc.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-12">
          <div className="bg-card border border-border rounded-xl p-8">
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              Deja la maleta y sal a disfrutar Rio
            </h2>
            <p className="text-muted-foreground mb-6">
              Escríbenos por WhatsApp y coordinamos el horario de entrega y retiro.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('¡Hola! Quiero dejar mi equipaje guardado en Lapa Casa.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
              >
                💬 Reservar por WhatsApp
              </a>
            </div>
          </div>
        </section>
      </div>

      <SiteFooter locale={locale} />
    </main>
  );
}
