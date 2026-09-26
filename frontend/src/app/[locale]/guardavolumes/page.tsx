//
// Malas/Guardavolumes: guarda-equipaje abierto a cualquier persona en
// Rio de Janeiro, no solo a huéspedes de Lapa Casa -- antes del check-in,
// antes de viajar, de paso por Santa Teresa, etc. Precio/días/horario
// vienen de system_config.luggage_storage (editable desde
// /admin/pricing.html), con fallback si el backend no responde.

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Luggage, Clock, Wallet } from 'lucide-react';
import { StructuredData } from '@/components/seo/structured-data';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

// La página entera estaba hardcodeada en español, sin pasar por next-intl
// ni por un CONTENT[locale] -- se veía igual en cualquier idioma que
// eligiera el usuario (bug reportado: texto mezclado navegando en otro
// idioma). Se agrega CONTENT: Record<Locale, ...> con los 6 idiomas,
// mismo patrón que santa-teresa/page.tsx y grupos/page.tsx.
interface UseCase {
  title: string;
  text: string;
}

interface GuardavolumesContent {
  metaTitle: string;
  metaDescription: string;
  home: string;
  eyebrow: string;
  h1: string;
  heroText: string;
  daily: string;
  schedule: string;
  days: string;
  useCasesHeading: string;
  useCases: UseCase[];
  ctaHeading: string;
  ctaText: string;
  ctaButton: string;
  whatsappMessage: string;
  serviceDescription: string;
  offerDescription: (days: string, start: string, end: string) => string;
}

const CONTENT: Record<Locale, GuardavolumesContent> = {
  pt: {
    metaTitle: 'Guarda-volumes em Santa Teresa — Malas/Guarda-volumes | Lapa Casa',
    metaDescription:
      'Deixe sua bagagem no Lapa Casa Rio, Santa Teresa, mesmo que você não esteja hospedado aqui. Antes do check-in, antes de viajar, ou de passagem pelo Rio de Janeiro.',
    home: 'Início',
    eyebrow: 'Santa Teresa · Rio de Janeiro',
    h1: 'Precisa deixar a mala em algum lugar?',
    heroText:
      'Não é preciso ser hóspede do Lapa Casa. Guardamos sua bagagem em Santa Teresa, esteja você chegando, saindo, ou só dando uma volta pelo Rio — para que você caminhe leve e aproveite o dia sem carregar nada.',
    daily: 'Diária',
    schedule: 'Horário',
    days: 'Dias',
    useCasesHeading: 'Quando é útil para você?',
    useCases: [
      {
        title: 'Você chegou antes do check-in',
        text: 'Seu voo pousou cedo e o quarto ainda não está pronto. Deixe a mochila e saia para caminhar por Santa Teresa com as mãos livres.',
      },
      {
        title: 'Você viaja à noite',
        text: 'Você fez o check-out, mas seu voo ou ônibus só sai à noite. Guarde a bagagem e aproveite o dia no Rio sem carregar nada.',
      },
      {
        title: 'Você está de passagem pelo bairro',
        text: 'Você não está hospedado no Lapa Casa, mas está conhecendo Santa Teresa com a mala nas costas. Nós guardamos ela enquanto você conhece o bairro.',
      },
      {
        title: 'Você trocou de hospedagem',
        text: 'Você sai de um hotel e entra em outro mais tarde, em qualquer ponto do Rio. Deixe a bagagem aqui e circule mais leve pela cidade.',
      },
    ],
    ctaHeading: 'Deixe a mala e saia para aproveitar o Rio',
    ctaText: 'Fale com a gente pelo WhatsApp e combinamos o horário de entrega e retirada.',
    ctaButton: 'Reservar pelo WhatsApp',
    whatsappMessage: 'Olá! Quero deixar minha bagagem guardada no Lapa Casa.',
    serviceDescription:
      'Guarda-volumes aberto a qualquer pessoa no Rio de Janeiro, não só a hóspedes do hostel.',
    offerDescription: (days, start, end) => `Diária de guarda-volumes, ${days}, ${start}–${end}`,
  },
  es: {
    metaTitle: 'Guarda-equipaje en Santa Teresa — Malas/Guardavolumes | Lapa Casa',
    metaDescription:
      'Deja tu equipaje en Lapa Casa Rio, Santa Teresa, aunque no te hospedes acá. Antes del check-in, antes de viajar, o de paso por Rio de Janeiro.',
    home: 'Inicio',
    eyebrow: 'Santa Teresa · Río de Janeiro',
    h1: '¿Tienes que dejar la maleta en algún lado?',
    heroText:
      'No hace falta ser huésped de Lapa Casa. Te guardamos el equipaje en Santa Teresa estés yendo, viniendo, o simplemente dando una vuelta por Rio — para que camines liviano y disfrutes el día sin cargar nada.',
    daily: 'Diaria',
    schedule: 'Horario',
    days: 'Días',
    useCasesHeading: '¿Cuándo te sirve?',
    useCases: [
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
    ],
    ctaHeading: 'Deja la maleta y sal a disfrutar Rio',
    ctaText: 'Escríbenos por WhatsApp y coordinamos el horario de entrega y retiro.',
    ctaButton: 'Reservar por WhatsApp',
    whatsappMessage: '¡Hola! Quiero dejar mi equipaje guardado en Lapa Casa.',
    serviceDescription:
      'Guarda-equipaje abierto a cualquier huésped en Rio de Janeiro, no solo a huéspedes del hostel.',
    offerDescription: (days, start, end) => `Diaria de guarda-equipaje, ${days}, ${start}–${end}`,
  },
  en: {
    metaTitle: 'Luggage Storage in Santa Teresa — Lapa Casa',
    metaDescription:
      'Leave your bags at Lapa Casa Rio, Santa Teresa, even if you are not staying here. Before check-in, before you travel, or just passing through Rio de Janeiro.',
    home: 'Home',
    eyebrow: 'Santa Teresa · Rio de Janeiro',
    h1: 'Need somewhere to leave your bags?',
    heroText:
      "You don't need to be a Lapa Casa guest. We'll store your luggage in Santa Teresa whether you're arriving, leaving, or just wandering around Rio — so you can walk light and enjoy your day without carrying anything.",
    daily: 'Daily rate',
    schedule: 'Hours',
    days: 'Days',
    useCasesHeading: 'When does this come in handy?',
    useCases: [
      {
        title: 'You arrived before check-in',
        text: 'Your flight landed early and the room is not ready yet. Drop your backpack and head out to explore Santa Teresa hands-free.',
      },
      {
        title: "You're leaving at night",
        text: "You've checked out, but your flight or bus doesn't leave until night. Store your luggage and enjoy the day in Rio without carrying anything.",
      },
      {
        title: "You're just passing through",
        text: "You're not staying at Lapa Casa, but you're exploring Santa Teresa with your suitcase in tow. We'll keep it safe while you check out the neighborhood.",
      },
      {
        title: 'You switched accommodation',
        text: "You're checking out of one place and into another later, anywhere in Rio. Drop your luggage here and get around the city unburdened.",
      },
    ],
    ctaHeading: 'Drop your bags and go enjoy Rio',
    ctaText: "Message us on WhatsApp and we'll arrange a drop-off and pick-up time.",
    ctaButton: 'Book via WhatsApp',
    whatsappMessage: 'Hi! I would like to store my luggage at Lapa Casa.',
    serviceDescription:
      'Luggage storage open to anyone in Rio de Janeiro, not only hostel guests.',
    offerDescription: (days, start, end) => `Luggage storage daily rate, ${days}, ${start}–${end}`,
  },
  de: {
    metaTitle: 'Gepäckaufbewahrung in Santa Teresa — Lapa Casa',
    metaDescription:
      'Lassen Sie Ihr Gepäck im Lapa Casa Rio in Santa Teresa, auch wenn Sie dort nicht übernachten. Vor dem Check-in, vor der Weiterreise oder einfach auf der Durchreise durch Rio de Janeiro.',
    home: 'Startseite',
    eyebrow: 'Santa Teresa · Rio de Janeiro',
    h1: 'Müssen Sie irgendwo Ihr Gepäck lassen?',
    heroText:
      'Sie müssen kein Gast des Lapa Casa sein. Wir bewahren Ihr Gepäck in Santa Teresa auf, egal ob Sie gerade ankommen, abreisen oder einfach durch Rio bummeln — damit Sie den Tag ohne Gepäck genießen können.',
    daily: 'Tagespreis',
    schedule: 'Öffnungszeiten',
    days: 'Tage',
    useCasesHeading: 'Wann ist das nützlich für Sie?',
    useCases: [
      {
        title: 'Sie kamen vor dem Check-in an',
        text: 'Ihr Flug ist früh gelandet und das Zimmer ist noch nicht bereit. Lassen Sie den Rucksack hier und erkunden Sie Santa Teresa mit freien Händen.',
      },
      {
        title: 'Sie reisen erst abends weiter',
        text: 'Sie haben bereits ausgecheckt, aber Ihr Flug oder Bus fährt erst abends. Geben Sie Ihr Gepäck ab und genießen Sie den Tag in Rio ohne Gepäck.',
      },
      {
        title: 'Sie sind nur auf der Durchreise',
        text: 'Sie übernachten nicht im Lapa Casa, erkunden aber Santa Teresa mit Ihrem Koffer im Schlepptau. Wir bewahren ihn auf, während Sie das Viertel erkunden.',
      },
      {
        title: 'Sie wechseln die Unterkunft',
        text: 'Sie checken aus einer Unterkunft aus und später an einer anderen ein, irgendwo in Rio. Lassen Sie Ihr Gepäck hier und bewegen Sie sich leichter durch die Stadt.',
      },
    ],
    ctaHeading: 'Geben Sie Ihr Gepäck ab und genießen Sie Rio',
    ctaText: 'Schreiben Sie uns auf WhatsApp und wir vereinbaren eine Uhrzeit für Abgabe und Abholung.',
    ctaButton: 'Über WhatsApp buchen',
    whatsappMessage: 'Hallo! Ich möchte mein Gepäck im Lapa Casa aufbewahren lassen.',
    serviceDescription:
      'Gepäckaufbewahrung für alle in Rio de Janeiro, nicht nur für Hostelgäste.',
    offerDescription: (days, start, end) => `Tagespreis Gepäckaufbewahrung, ${days}, ${start}–${end}`,
  },
  fr: {
    metaTitle: 'Consigne à bagages à Santa Teresa — Lapa Casa',
    metaDescription:
      'Laissez vos bagages au Lapa Casa Rio, à Santa Teresa, même si vous n\'y séjournez pas. Avant le check-in, avant de voyager, ou de passage à Rio de Janeiro.',
    home: 'Accueil',
    eyebrow: 'Santa Teresa · Rio de Janeiro',
    h1: 'Besoin de laisser votre valise quelque part ?',
    heroText:
      "Pas besoin d'être client du Lapa Casa. Nous gardons vos bagages à Santa Teresa, que vous arriviez, repartiez, ou vous baladiez simplement dans Rio — pour profiter de votre journée les mains libres.",
    daily: 'Tarif journalier',
    schedule: 'Horaires',
    days: 'Jours',
    useCasesHeading: 'Quand est-ce utile pour vous ?',
    useCases: [
      {
        title: "Vous êtes arrivé avant le check-in",
        text: "Votre vol a atterri tôt et la chambre n'est pas encore prête. Déposez votre sac et partez explorer Santa Teresa les mains libres.",
      },
      {
        title: 'Vous partez en voyage le soir',
        text: "Vous avez fait le check-out, mais votre vol ou bus ne part que le soir. Déposez vos bagages et profitez de votre journée à Rio sans rien porter.",
      },
      {
        title: 'Vous êtes de passage dans le quartier',
        text: "Vous ne logez pas au Lapa Casa, mais vous découvrez Santa Teresa avec votre valise. Nous la gardons pendant que vous explorez le quartier.",
      },
      {
        title: "Vous changez d'hébergement",
        text: "Vous quittez un hôtel pour en rejoindre un autre plus tard, n'importe où à Rio. Laissez vos bagages ici et déplacez-vous plus léger dans la ville.",
      },
    ],
    ctaHeading: 'Déposez vos bagages et profitez de Rio',
    ctaText: 'Écrivez-nous sur WhatsApp et on organise l\'heure de dépôt et de retrait.',
    ctaButton: 'Réserver via WhatsApp',
    whatsappMessage: 'Bonjour ! Je voudrais laisser mes bagages au Lapa Casa.',
    serviceDescription:
      'Consigne à bagages ouverte à tous à Rio de Janeiro, pas seulement aux clients de l\'auberge.',
    offerDescription: (days, start, end) => `Tarif journalier de consigne, ${days}, ${start}–${end}`,
  },
  it: {
    metaTitle: 'Deposito bagagli a Santa Teresa — Lapa Casa',
    metaDescription:
      'Lascia il tuo bagaglio al Lapa Casa Rio, a Santa Teresa, anche se non alloggi qui. Prima del check-in, prima di viaggiare, o di passaggio a Rio de Janeiro.',
    home: 'Home',
    eyebrow: 'Santa Teresa · Rio de Janeiro',
    h1: 'Devi lasciare la valigia da qualche parte?',
    heroText:
      "Non serve essere ospite del Lapa Casa. Custodiamo il tuo bagaglio a Santa Teresa che tu stia arrivando, partendo, o semplicemente facendo un giro per Rio — così puoi goderti la giornata senza portare nulla.",
    daily: 'Tariffa giornaliera',
    schedule: 'Orario',
    days: 'Giorni',
    useCasesHeading: 'Quando ti torna utile?',
    useCases: [
      {
        title: 'Sei arrivato prima del check-in',
        text: 'Il tuo volo è atterrato presto e la camera non è ancora pronta. Lascia lo zaino ed esci a esplorare Santa Teresa a mani libere.',
      },
      {
        title: 'Parti in viaggio la sera',
        text: 'Hai fatto il check-out ma il tuo volo o autobus parte solo la sera. Lascia il bagaglio e goditi la giornata a Rio senza portare nulla.',
      },
      {
        title: 'Sei di passaggio nel quartiere',
        text: 'Non alloggi al Lapa Casa, ma stai visitando Santa Teresa con la valigia al seguito. La custodiamo noi mentre scopri il quartiere.',
      },
      {
        title: 'Hai cambiato alloggio',
        text: 'Fai il check-out da un posto e il check-in in un altro più tardi, in qualsiasi zona di Rio. Lascia il bagaglio qui e muoviti più leggero in città.',
      },
    ],
    ctaHeading: 'Lascia la valigia ed esci a goderti Rio',
    ctaText: 'Scrivici su WhatsApp e concordiamo l\'orario di consegna e ritiro.',
    ctaButton: 'Prenota via WhatsApp',
    whatsappMessage: 'Ciao! Vorrei lasciare il mio bagaglio al Lapa Casa.',
    serviceDescription:
      'Deposito bagagli aperto a chiunque a Rio de Janeiro, non solo agli ospiti dell\'ostello.',
    offerDescription: (days, start, end) => `Tariffa giornaliera deposito bagagli, ${days}, ${start}–${end}`,
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5521977157530';

// El texto de "días" por defecto (sin backend disponible) depende del
// idioma; el valor real, cuando el backend sí responde, es contenido
// editable por el dueño desde /admin/pricing.html (queda tal cual venga).
const DEFAULT_DAYS_TEXT: Record<Locale, string> = {
  pt: 'Todos os dias',
  es: 'Todos los días',
  en: 'Every day',
  de: 'Täglich',
  fr: 'Tous les jours',
  it: 'Tutti i giorni',
};

const DEFAULT_LUGGAGE_STORAGE = {
  price: 30,
  days: 'Todos los días',
  startTime: '08:00',
  endTime: '22:00',
};

/** Editable desde /admin/pricing.html (system_config.luggage_storage). */
async function getLuggageStorage(locale: Locale): Promise<typeof DEFAULT_LUGGAGE_STORAGE> {
  const fallback = { ...DEFAULT_LUGGAGE_STORAGE, days: DEFAULT_DAYS_TEXT[locale] };
  try {
    const res = await fetch(`${API_URL}/rooms`, { next: { revalidate: 300 } });
    if (!res.ok) {
      return fallback;
    }
    const json = await res.json();
    const ls = json?.data?.policies?.luggageStorage;
    if (!ls || typeof ls.price !== 'number' || !ls.days || !ls.startTime || !ls.endTime) {
      return fallback;
    }
    return { price: ls.price, days: ls.days, startTime: ls.startTime, endTime: ls.endTime };
  } catch {
    return fallback;
  }
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const resolvedLocale = (locales.includes(locale as Locale) ? locale : defaultLocale) as Locale;
  const { metaTitle: title, metaDescription: description } = CONTENT[resolvedLocale];
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

export default async function GuardavolumesPage({ params }: { params: { locale: string } }) {
  const locale = (
    locales.includes(params.locale as Locale) ? params.locale : defaultLocale
  ) as Locale;
  setRequestLocale(locale);
  const c = CONTENT[locale];
  const luggageStorage = await getLuggageStorage(locale);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Guarda-equipaje Lapa Casa — Santa Teresa',
    description: c.serviceDescription,
    provider: { '@type': 'LodgingBusiness', name: 'Lapa Casa', url: SITE_URL },
    areaServed: { '@type': 'City', name: 'Rio de Janeiro', addressCountry: 'BR' },
    offers: {
      '@type': 'Offer',
      price: String(luggageStorage.price),
      priceCurrency: 'BRL',
      description: c.offerDescription(luggageStorage.days, luggageStorage.startTime, luggageStorage.endTime),
    },
  };

  return (
    <main className="min-h-screen bg-background">
      <StructuredData data={schema} />

      {/* ── Hero con imagen de los Arcos da Lapa — la misma que usa el header del motor de hostel ── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <Image
            src="/img/arcos-lapa.jpg"
            alt="Arcos da Lapa, Rio de Janeiro"
            fill
            priority
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 to-black/65" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 pt-6">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {c.home}
          </Link>
        </div>
        <div className="relative max-w-3xl mx-auto px-4 pb-14 pt-6">
          <p className="text-xs font-display font-semibold tracking-widest uppercase text-white/60 mb-5">
            {c.eyebrow}
          </p>
          <h1
            className="font-serif font-semibold leading-[1.1] text-white mb-5"
            style={{ fontSize: 'clamp(2.4rem, 6vw, 3.6rem)' }}
          >
            {c.h1}
          </h1>
          <p className="text-lg text-white/80 leading-relaxed max-w-2xl">
            {c.heroText}
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
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.daily}</div>
              <div className="text-lg font-semibold text-foreground">R$ {luggageStorage.price}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.schedule}</div>
              <div className="text-lg font-semibold text-foreground">
                {luggageStorage.startTime}–{luggageStorage.endTime}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Luggage className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.days}</div>
              <div className="text-lg font-semibold text-foreground">{luggageStorage.days}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Casos de uso ── */}
      <div className="max-w-3xl mx-auto px-4">
        <section className="py-12 border-b border-border">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-6">
            {c.useCasesHeading}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {c.useCases.map((uc, i) => (
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
              {c.ctaHeading}
            </h2>
            <p className="text-muted-foreground mb-6">
              {c.ctaText}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(c.whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
              >
                💬 {c.ctaButton}
              </a>
            </div>
          </div>
        </section>
      </div>

      <SiteFooter locale={locale} />
    </main>
  );
}
