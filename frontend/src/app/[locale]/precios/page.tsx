// lapa-casa-hostel/frontend/src/app/[locale]/precios/page.tsx
//
// Página de contenido SEO: precios por temporada, indexable en texto
// estático rastreable (idea #35, roadmap.html -- antes el pricing por
// temporada solo vivía adentro del motor de reservas, nunca en una página
// que Google/una IA pudiera leer sin ejecutar JS).
//
// Los precios base por cuarto se piden en vivo a GET /api/v1/rooms
// (revalidados cada hora) en vez de escribirse a mano acá -- son datos
// editables por el admin (/admin/pricing.html), escribirlos fijos los
// hubiera desactualizado apenas alguien tocara un precio.

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { StructuredData } from '@/components/seo/structured-data';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lapacasario.com/api/v1';

// ─── Metadata por idioma ───────────────────────────────────────────────────

const META: Record<string, { title: string; description: string }> = {
  pt: {
    title: 'Preços por Temporada — Lapa Casa Rio',
    description:
      'Preços por cama/noite no Lapa Casa Rio em cada temporada do ano, descontos para grupos e política de depósito. Preços atualizados em tempo real.',
  },
  es: {
    title: 'Precios por Temporada — Lapa Casa Rio',
    description:
      'Precios por cama/noche en Lapa Casa Rio en cada temporada del año, descuentos para grupos y política de depósito. Precios actualizados en tiempo real.',
  },
  en: {
    title: 'Seasonal Prices — Lapa Casa Rio',
    description:
      'Per-bed nightly prices at Lapa Casa Rio across every season of the year, group discounts and deposit policy. Prices updated in real time.',
  },
  de: {
    title: 'Preise nach Saison — Lapa Casa Rio',
    description:
      'Preise pro Bett/Nacht im Lapa Casa Rio für jede Jahreszeit, Gruppenrabatte und Anzahlungsregelung. Preise in Echtzeit aktualisiert.',
  },
  fr: {
    title: 'Prix par Saison — Lapa Casa Rio',
    description:
      "Prix par lit/nuit au Lapa Casa Rio selon chaque saison de l'année, remises de groupe et politique d'acompte. Prix mis à jour en temps réel.",
  },
  it: {
    title: 'Prezzi per Stagione — Lapa Casa Rio',
    description:
      "Prezzi per letto/notte al Lapa Casa Rio in ogni stagione dell'anno, sconti per gruppi e politica di caparra. Prezzi aggiornati in tempo reale.",
  },
};

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const safeLocale = (locales.includes(locale as Locale) ? locale : defaultLocale) as Locale;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const m = META[safeLocale]!;
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: `${SITE_URL}/${locale}/precios`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/precios`])),
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `${SITE_URL}/${locale}/precios`,
      siteName: 'Lapa Casa',
      locale,
      type: 'website',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description },
  };
}

// ─── Contenido por idioma ──────────────────────────────────────────────────

interface Content {
  headline: string;
  intro: string;
  colRoom: string;
  colCapacity: string;
  colBasePrice: string;
  seasonLabels: { high: string; medium: string; low: string; carnival: string };
  seasonNote: string;
  bedsUnit: string;
  perNight: string;
  groupTitle: string;
  groupBody: string;
  depositTitle: string;
  depositBody: string;
  cancelTitle: string;
  cancelBody: string;
  errorBody: string;
  ctaTitle: string;
  ctaBody: string;
  ctaBtn: string;
}

const CONTENT: Record<string, Content> = {
  pt: {
    headline: 'Preços por temporada',
    intro:
      'Preços por cama/noite no dormitório, direto da nossa base de dados -- os mesmos valores usados no motor de reservas, sempre atualizados.',
    colRoom: 'Quarto',
    colCapacity: 'Capacidade',
    colBasePrice: 'Preço base',
    seasonLabels: {
      high: 'Alta (dez-mar)',
      medium: 'Média (abr-mai, out-nov)',
      low: 'Baixa (jun-set)',
      carnival: 'Carnaval (fev)',
    },
    seasonNote:
      'O preço final também depende do número de noites e do desconto de grupo aplicável -- o valor exato aparece no motor de reservas ao escolher as datas.',
    bedsUnit: 'camas',
    perNight: '/ noite',
    groupTitle: 'Descontos para grupos',
    groupBody:
      'Grupos de 6 ou mais camas têm 10% de desconto. Grupos de 10 ou mais camas têm 15% de desconto. O desconto é calculado sobre o total de camas de toda a reserva.',
    depositTitle: 'Depósito e forma de pagamento',
    depositBody:
      'O depósito no ato da reserva é de 30% do valor total (50% para grupos de 15+ pessoas). O restante é pago no check-in, em dinheiro ou cartão. Aceitamos cartão de crédito e PIX.',
    cancelTitle: 'Política de cancelamento',
    cancelBody:
      'O depósito pago na reserva não é reembolsável em nenhuma circunstância -- cancelamento a qualquer momento ou no-show, independentemente da antecedência.',
    errorBody:
      'Não foi possível carregar os preços em tempo real agora. Veja os preços atualizados diretamente no motor de reservas.',
    ctaTitle: 'Ver disponibilidade e reservar',
    ctaBody:
      'Escolha suas datas no motor de reservas para ver o preço exato da sua estadia, com o desconto de grupo já aplicado.',
    ctaBtn: 'Ver disponibilidade',
  },
  es: {
    headline: 'Precios por temporada',
    intro:
      'Precios por cama/noche en el dormitorio, directo de nuestra base de datos -- los mismos valores que usa el motor de reservas, siempre actualizados.',
    colRoom: 'Habitación',
    colCapacity: 'Capacidad',
    colBasePrice: 'Precio base',
    seasonLabels: {
      high: 'Alta (dic-mar)',
      medium: 'Media (abr-may, oct-nov)',
      low: 'Baja (jun-sep)',
      carnival: 'Carnaval (feb)',
    },
    seasonNote:
      'El precio final también depende del número de noches y del descuento de grupo aplicable -- el valor exacto aparece en el motor de reservas al elegir las fechas.',
    bedsUnit: 'camas',
    perNight: '/ noche',
    groupTitle: 'Descuentos para grupos',
    groupBody:
      'Grupos de 6 o más camas tienen 10% de descuento. Grupos de 10 o más camas tienen 15% de descuento. El descuento se calcula sobre el total de camas de toda la reserva.',
    depositTitle: 'Depósito y forma de pago',
    depositBody:
      'El depósito al reservar es del 30% del total (50% para grupos de 15+ personas). El resto se paga en el check-in, en efectivo o tarjeta. Aceptamos tarjeta de crédito y PIX.',
    cancelTitle: 'Política de cancelación',
    cancelBody:
      'El depósito abonado en la reserva no es reembolsable bajo ninguna circunstancia -- cancelación en cualquier momento o no-show, sin importar la anticipación.',
    errorBody:
      'No pudimos cargar los precios en tiempo real ahora. Mirá los precios actualizados directo en el motor de reservas.',
    ctaTitle: 'Ver disponibilidad y reservar',
    ctaBody:
      'Elige tus fechas en el motor de reservas para ver el precio exacto de tu estadía, con el descuento de grupo ya aplicado.',
    ctaBtn: 'Ver disponibilidad',
  },
  en: {
    headline: 'Seasonal prices',
    intro:
      'Per-bed nightly dorm prices, straight from our database -- the same values used in the booking engine, always up to date.',
    colRoom: 'Room',
    colCapacity: 'Capacity',
    colBasePrice: 'Base price',
    seasonLabels: {
      high: 'High (Dec-Mar)',
      medium: 'Medium (Apr-May, Oct-Nov)',
      low: 'Low (Jun-Sep)',
      carnival: 'Carnival (Feb)',
    },
    seasonNote:
      'The final price also depends on number of nights and any applicable group discount -- the exact amount shows up in the booking engine once you pick your dates.',
    bedsUnit: 'beds',
    perNight: '/ night',
    groupTitle: 'Group discounts',
    groupBody:
      'Groups of 6 or more beds get 10% off. Groups of 10 or more beds get 15% off. The discount is calculated on the total number of beds in the whole booking.',
    depositTitle: 'Deposit and payment method',
    depositBody:
      'The deposit at booking is 30% of the total (50% for groups of 15+ people). The remainder is paid at check-in, in cash or by card. We accept credit card and PIX.',
    cancelTitle: 'Cancellation policy',
    cancelBody:
      'The deposit paid at booking is non-refundable under any circumstance -- cancellation at any time or no-show, regardless of notice.',
    errorBody:
      'We could not load live prices right now. See up-to-date prices directly in the booking engine.',
    ctaTitle: 'Check availability and book',
    ctaBody:
      'Pick your dates in the booking engine to see the exact price for your stay, with the group discount already applied.',
    ctaBtn: 'Check availability',
  },
  de: {
    headline: 'Preise nach Saison',
    intro:
      'Preise pro Bett/Nacht im Schlafsaal, direkt aus unserer Datenbank -- dieselben Werte wie im Buchungssystem, immer aktuell.',
    colRoom: 'Zimmer',
    colCapacity: 'Kapazität',
    colBasePrice: 'Grundpreis',
    seasonLabels: {
      high: 'Hoch (Dez-Mär)',
      medium: 'Mittel (Apr-Mai, Okt-Nov)',
      low: 'Niedrig (Jun-Sep)',
      carnival: 'Karneval (Feb)',
    },
    seasonNote:
      'Der Endpreis hängt auch von der Anzahl der Nächte und einem eventuellen Gruppenrabatt ab -- der genaue Betrag erscheint im Buchungssystem nach der Datumsauswahl.',
    bedsUnit: 'Betten',
    perNight: '/ Nacht',
    groupTitle: 'Gruppenrabatte',
    groupBody:
      'Gruppen ab 6 Betten erhalten 10% Rabatt. Gruppen ab 10 Betten erhalten 15% Rabatt. Der Rabatt wird auf die Gesamtzahl der Betten der ganzen Buchung berechnet.',
    depositTitle: 'Anzahlung und Zahlungsart',
    depositBody:
      'Die Anzahlung bei der Buchung beträgt 30% des Gesamtbetrags (50% für Gruppen ab 15 Personen). Der Rest wird beim Check-in bar oder per Karte bezahlt. Wir akzeptieren Kreditkarte und PIX.',
    cancelTitle: 'Stornierungsrichtlinie',
    cancelBody:
      'Die bei der Buchung gezahlte Anzahlung ist unter keinen Umständen erstattungsfähig -- Stornierung zu jedem Zeitpunkt oder Nichterscheinen, unabhängig von der Vorlaufzeit.',
    errorBody:
      'Die Live-Preise konnten gerade nicht geladen werden. Aktuelle Preise direkt im Buchungssystem ansehen.',
    ctaTitle: 'Verfügbarkeit prüfen und buchen',
    ctaBody:
      'Wählen Sie Ihre Daten im Buchungssystem, um den genauen Preis für Ihren Aufenthalt mit bereits angewendetem Gruppenrabatt zu sehen.',
    ctaBtn: 'Verfügbarkeit prüfen',
  },
  fr: {
    headline: 'Prix par saison',
    intro:
      'Prix par lit/nuit en dortoir, directement depuis notre base de données -- les mêmes valeurs utilisées dans le moteur de réservation, toujours à jour.',
    colRoom: 'Chambre',
    colCapacity: 'Capacité',
    colBasePrice: 'Prix de base',
    seasonLabels: {
      high: 'Haute (déc-mars)',
      medium: 'Moyenne (avr-mai, oct-nov)',
      low: 'Basse (juin-sept)',
      carnival: 'Carnaval (fév)',
    },
    seasonNote:
      "Le prix final dépend aussi du nombre de nuits et d'une éventuelle remise de groupe -- le montant exact apparaît dans le moteur de réservation après le choix des dates.",
    bedsUnit: 'lits',
    perNight: '/ nuit',
    groupTitle: 'Remises de groupe',
    groupBody:
      'Les groupes de 6 lits ou plus bénéficient de 10% de réduction. Les groupes de 10 lits ou plus ont 15% de réduction. La remise est calculée sur le total des lits de toute la réservation.',
    depositTitle: 'Acompte et mode de paiement',
    depositBody:
      "L'acompte à la réservation est de 30% du total (50% pour les groupes de 15+ personnes). Le solde est payé au check-in, en espèces ou par carte. Nous acceptons la carte de crédit et le PIX.",
    cancelTitle: "Politique d'annulation",
    cancelBody:
      "L'acompte versé lors de la réservation n'est remboursable en aucune circonstance -- annulation à tout moment ou non-présentation, quel que soit le délai de préavis.",
    errorBody:
      'Impossible de charger les prix en direct pour le moment. Consultez les prix à jour directement dans le moteur de réservation.',
    ctaTitle: 'Vérifier la disponibilité et réserver',
    ctaBody:
      'Choisissez vos dates dans le moteur de réservation pour voir le prix exact de votre séjour, remise de groupe déjà appliquée.',
    ctaBtn: 'Vérifier la disponibilité',
  },
  it: {
    headline: 'Prezzi per stagione',
    intro:
      'Prezzi per letto/notte in dormitorio, direttamente dal nostro database -- gli stessi valori usati nel motore di prenotazione, sempre aggiornati.',
    colRoom: 'Camera',
    colCapacity: 'Capacità',
    colBasePrice: 'Prezzo base',
    seasonLabels: {
      high: 'Alta (dic-mar)',
      medium: 'Media (apr-mag, ott-nov)',
      low: 'Bassa (giu-set)',
      carnival: 'Carnevale (feb)',
    },
    seasonNote:
      "Il prezzo finale dipende anche dal numero di notti e da un eventuale sconto per gruppi -- l'importo esatto appare nel motore di prenotazione dopo aver scelto le date.",
    bedsUnit: 'letti',
    perNight: '/ notte',
    groupTitle: 'Sconti per gruppi',
    groupBody:
      "Gruppi di 6 o più letti hanno il 10% di sconto. Gruppi di 10 o più letti hanno il 15% di sconto. Lo sconto si calcola sul totale dei letti dell'intera prenotazione.",
    depositTitle: 'Caparra e metodo di pagamento',
    depositBody:
      'La caparra al momento della prenotazione è il 30% del totale (50% per gruppi di 15+ persone). Il resto si paga al check-in, in contanti o con carta. Accettiamo carta di credito e PIX.',
    cancelTitle: 'Politica di cancellazione',
    cancelBody:
      'La caparra pagata al momento della prenotazione non è rimborsabile in nessuna circostanza -- cancellazione in qualsiasi momento o no-show, indipendentemente dal preavviso.',
    errorBody:
      'Non è stato possibile caricare i prezzi in tempo reale ora. Guarda i prezzi aggiornati direttamente nel motore di prenotazione.',
    ctaTitle: 'Controlla disponibilità e prenota',
    ctaBody:
      'Scegli le tue date nel motore di prenotazione per vedere il prezzo esatto del tuo soggiorno, con lo sconto di gruppo già applicato.',
    ctaBtn: 'Controlla disponibilità',
  },
};

// ─── Datos en vivo ──────────────────────────────────────────────────────────

interface RoomPriceRow {
  id: string;
  name: string;
  capacity: number;
  basePrice: number;
}

interface RoomsApiResponse {
  success: boolean;
  data?: {
    rooms: RoomPriceRow[];
    pricing: {
      currency: string;
      seasonalAdjustments: Record<string, { multiplier: number }>;
    };
  };
}

async function getLiveRoomPrices(): Promise<RoomsApiResponse['data'] | null> {
  try {
    const res = await fetch(`${API_URL}/rooms`, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as RoomsApiResponse;
    return body.success ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

const fmtBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// ─── Page component ────────────────────────────────────────────────────────

export default async function PrecosPage({ params }: { params: { locale: string } }) {
  const locale = (
    locales.includes(params.locale as Locale) ? params.locale : defaultLocale
  ) as Locale;
  setRequestLocale(locale);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const c = CONTENT[locale]!;
  const data = await getLiveRoomPrices();
  const multipliers = data?.pricing.seasonalAdjustments ?? {
    high: { multiplier: 1.5 },
    medium: { multiplier: 1.0 },
    low: { multiplier: 0.8 },
    carnival: { multiplier: 2.0 },
  };

  const offersSchema = data
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: data.rooms.map((room, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: room.name,
            offers: {
              '@type': 'Offer',
              priceCurrency: data.pricing.currency,
              price: room.basePrice.toFixed(2),
              availability: 'https://schema.org/InStock',
              url: `${SITE_URL}/${locale}/hostel`,
            },
          },
        })),
      }
    : null;

  return (
    <main className="min-h-screen bg-background">
      {offersSchema && <StructuredData data={offersSchema} />}

      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-4">
            Rio de Janeiro · Brasil
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-6 leading-tight">
            {c.headline}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">{c.intro}</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4">
        {/* ── Tabla de precios ── */}
        <section className="py-12 border-b border-border">
          {data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-3 pr-3 font-semibold text-foreground">{c.colRoom}</th>
                    <th className="py-3 pr-3 font-semibold text-foreground">{c.colCapacity}</th>
                    <th className="py-3 pr-3 font-semibold text-foreground">{c.colBasePrice}</th>
                    <th className="py-3 pr-3 font-semibold text-foreground">
                      {c.seasonLabels.low}
                    </th>
                    <th className="py-3 pr-3 font-semibold text-foreground">
                      {c.seasonLabels.medium}
                    </th>
                    <th className="py-3 pr-3 font-semibold text-foreground">
                      {c.seasonLabels.high}
                    </th>
                    <th className="py-3 font-semibold text-foreground">
                      {c.seasonLabels.carnival}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rooms.map((room) => (
                    <tr key={room.id} className="border-b border-border/60">
                      <td className="py-3 pr-3 text-foreground">{room.name}</td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {room.capacity} {c.bedsUnit}
                      </td>
                      <td className="py-3 pr-3 text-foreground font-medium">
                        {fmtBRL(room.basePrice)}
                        {c.perNight}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {fmtBRL(room.basePrice * (multipliers.low?.multiplier ?? 0.8))}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {fmtBRL(room.basePrice * (multipliers.medium?.multiplier ?? 1.0))}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {fmtBRL(room.basePrice * (multipliers.high?.multiplier ?? 1.5))}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {fmtBRL(room.basePrice * (multipliers.carnival?.multiplier ?? 2.0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">{c.errorBody}</p>
          )}
          <p className="text-xs text-muted-foreground mt-4">{c.seasonNote}</p>
        </section>

        {/* ── Grupos / depósito / cancelación ── */}
        <section className="py-12 border-b border-border space-y-8">
          <div>
            <h2 className="text-xl font-display font-semibold text-foreground mb-2">
              {c.groupTitle}
            </h2>
            <p className="text-muted-foreground">{c.groupBody}</p>
          </div>
          <div>
            <h2 className="text-xl font-display font-semibold text-foreground mb-2">
              {c.depositTitle}
            </h2>
            <p className="text-muted-foreground">{c.depositBody}</p>
          </div>
          <div>
            <h2 className="text-xl font-display font-semibold text-foreground mb-2">
              {c.cancelTitle}
            </h2>
            <p className="text-muted-foreground">{c.cancelBody}</p>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-12">
          <div className="bg-card border border-border rounded-xl p-8">
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              {c.ctaTitle}
            </h2>
            <p className="text-muted-foreground mb-6">{c.ctaBody}</p>
            <Link
              href={`/${locale}/hostel`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              📅 {c.ctaBtn}
            </Link>
          </div>
        </section>
      </div>
      <SiteFooter locale={locale} />
    </main>
  );
}
