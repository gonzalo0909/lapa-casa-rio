// lapa-casa-hostel/frontend/src/app/[locale]/tour/page.tsx
//
// Página de producto: Paquete Hospedaje + Tour por Rio de Janeiro.
// Tour guiado por Rio incluido en la estadía (hostel o apartamento).
// Guía turístico profesional asociado.
//
// Target keywords:
//   pt: "tour rio de janeiro com guia", "hostel com tour incluído rio"
//   en: "rio de janeiro guided tour hostel package", "tour included hostel rio"
//   es: "tour río de janeiro con guía incluido hostel"
//
// AEO: responde preguntas de viajeros sobre tours en Rio antes de reservar.

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import {
  Check,
  ArrowRight,
  MapPin,
  Calendar,
  MessageCircle,
  ChevronLeft,
  Clock,
  Users,
  Globe,
} from 'lucide-react';
import { StructuredData } from '@/components/seo/structured-data';
import { SiteFooter } from '@/components/layout/site-footer';
import { TourConfigurator } from '@/components/tour/tour-configurator';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

// ─── Metadata por idioma ───────────────────────────────────────────────────

const META: Record<string, { title: string; description: string }> = {
  pt: {
    title: 'Tour pelo Rio de Janeiro incluído · Lapa Casa Rio',
    description:
      'Reserve sua hospedagem no Lapa Casa Rio e ganhe um tour guiado pelo Rio de Janeiro: Cristo Redentor, Pão de Açúcar, praias e mais. Guia profissional incluso.',
  },
  en: {
    title: 'Rio de Janeiro Guided Tour Included · Lapa Casa Rio',
    description:
      'Book your stay at Lapa Casa Rio and get a guided tour of Rio de Janeiro: Christ the Redeemer, Sugarloaf, beaches and more. Professional guide included.',
  },
  es: {
    title: 'Tour por Río de Janeiro incluido · Lapa Casa Rio',
    description:
      'Reserva tu alojamiento en Lapa Casa Rio e incluye un tour guiado por Río: Cristo Redentor, Pan de Azúcar, playas y más. Guía profesional incluido.',
  },
  de: {
    title: 'Rio de Janeiro geführte Tour inklusive · Lapa Casa Rio',
    description:
      'Buche deinen Aufenthalt im Lapa Casa Rio und erhalte eine geführte Tour durch Rio: Christusstatue, Zuckerhut, Strände und mehr.',
  },
  fr: {
    title: 'Tour guidé de Rio de Janeiro inclus · Lapa Casa Rio',
    description:
      'Réservez votre séjour au Lapa Casa Rio et profitez d\'une visite guidée de Rio: Christ Rédempteur, Pain de Sucre, plages et plus encore.',
  },
  it: {
    title: 'Tour guidato di Rio de Janeiro incluso · Lapa Casa Rio',
    description:
      'Prenota il tuo soggiorno al Lapa Casa Rio e ottieni un tour guidato di Rio: Cristo Redentore, Sugarloaf, spiagge e molto altro.',
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
      canonical: `${SITE_URL}/${locale}/tour`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/tour`])),
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `${SITE_URL}/${locale}/tour`,
      siteName: 'Lapa Casa',
      locale,
      type: 'article',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description },
  };
}

// ─── Contenido por idioma ──────────────────────────────────────────────────

interface TourStop {
  name: string;
  description: string;
}

interface Content {
  headline: string;
  tagline: string;
  intro: string;
  packageTitle: string;
  packageItems: string[];
  stopsTitle: string;
  stops: TourStop[];
  whoTitle: string;
  whoBody: string;
  practicalTitle: string;
  practicalItems: string[];
  faq: FAQ[];
  ctaTitle: string;
  ctaBody: string;
  ctaBtn: string;
  ctaWa: string;
  backLabel: string;
}

interface FAQ {
  q: string;
  a: string;
}

const CONTENT: Record<string, Content> = {
  pt: {
    headline: 'Hospedagem + Tour pelo Rio',
    tagline: 'Uma experiência completa, do hostel às maravilhas do Rio',
    intro:
      'O Lapa Casa Rio oferece um pacote exclusivo: fique conosco e descubra o Rio de Janeiro com um guia turístico profissional. Visitas aos pontos mais icônicos da cidade em um único dia — ideal para quem quer aproveitar ao máximo a estadia.',
    packageTitle: 'O que está incluído',
    packageItems: [
      'Tour guiado de um dia completo por Rio de Janeiro',
      'Guia turístico profissional com experiência em grupos internacionais',
      'Visitas a Cristo Redentor, Pão de Açúcar, Centro Histórico e mais',
      'Transporte durante o tour (van ou carro compartilhado)',
      'Disponível para hóspedes do hostel e dos apartamentos',
    ],
    stopsTitle: 'Principais paradas do tour',
    stops: [
      {
        name: 'Cristo Redentor',
        description:
          'A icônica estátua no topo do Corcovado, com vista panorâmica de 360° da cidade.',
      },
      {
        name: 'Pão de Açúcar',
        description:
          'Subida de bondinho até o cume com vista da Baía de Guanabara e da Urca.',
      },
      {
        name: 'Praias da Zona Sul',
        description:
          'Copacabana e Ipanema — as praias mais famosas do mundo, a 20 min do hostel.',
      },
      {
        name: 'Centro Histórico',
        description:
          'Lapa, Arcos, Cinelândia, Escadaria Selarón e o centro cultural da cidade.',
      },
      {
        name: 'Santa Teresa',
        description:
          'Seu próprio bairro! O guia apresenta a história e os segredos do bairro mais bohémio do Rio.',
      },
    ],
    whoTitle: 'Guia profissional',
    whoBody:
      'O tour é conduzido por um guia turístico certificado, parceiro do Lapa Casa Rio, com anos de experiência recebendo viajantes internacionais. Fala português, inglês e espanhol. Grupos pequenos para uma experiência mais personalizada.',
    practicalTitle: 'Informações práticas',
    practicalItems: [
      'Duração: 8 a 10 horas (saída às 8h, retorno ao hostel ao entardecer)',
      'Grupos pequenos: até 8 pessoas por saída',
      'Idiomas: português, inglês e espanhol',
      'Disponível de segunda a sábado, sujeito à disponibilidade',
      'Inclui transporte — sem necessidade de pegar táxi ou metrô',
      'Ingresso ao Pão de Açúcar e Cristo Redentor não inclusos (o guia ajuda a organizar)',
      'Agendamento via WhatsApp com antecedência mínima de 24h',
    ],
    faq: [
      {
        q: 'O tour está incluso no preço da hospedagem?',
        a: 'O tour faz parte de um pacote especial. Ao reservar, informe no WhatsApp que tem interesse no pacote com tour — a equipe confirma a disponibilidade e combina os detalhes.',
      },
      {
        q: 'Posso contratar o tour sem me hospedar no Lapa Casa?',
        a: 'O tour é pensado especialmente para hóspedes do Lapa Casa Rio (hostel e apartamentos). Entre em contato pelo WhatsApp para verificar disponibilidade para externos.',
      },
      {
        q: 'O tour serve para grupos?',
        a: 'Sim! Grupos de até 8 pessoas em uma saída. Para grupos maiores, é possível organizar saídas separadas. Fale com a equipe pelo WhatsApp.',
      },
      {
        q: 'Os ingressos do Cristo e do Pão de Açúcar estão incluídos?',
        a: 'Os ingressos não estão inclusos no pacote, mas o guia auxilia na compra antecipada online para evitar filas. Os valores são pagos diretamente nas atrações.',
      },
      {
        q: 'O tour sai mesmo com chuva?',
        a: 'Na maioria dos casos sim, com adaptações no roteiro. Em caso de chuva forte, o guia avisa com antecedência e reagenda sem custo adicional.',
      },
    ],
    ctaTitle: 'Reserve seu pacote com tour',
    ctaBody:
      'Hospede-se no Lapa Casa Rio e viva o Rio como nunca. Fale com a equipe pelo WhatsApp para reservar o pacote com tour incluído.',
    ctaBtn: 'Reservar hospedagem',
    ctaWa: 'Falar no WhatsApp',
    backLabel: 'Voltar',
  },

  en: {
    headline: 'Stay + Rio de Janeiro Tour',
    tagline: 'A complete experience — from the hostel to Rio\'s wonders',
    intro:
      'Lapa Casa Rio offers an exclusive package: stay with us and discover Rio de Janeiro with a professional tour guide. Visit the city\'s most iconic spots in a single day — perfect for those who want to make the most of their stay.',
    packageTitle: 'What\'s included',
    packageItems: [
      'Full-day guided tour of Rio de Janeiro',
      'Professional guide experienced with international groups',
      'Visits to Christ the Redeemer, Sugarloaf Mountain, Historic Center and more',
      'Transportation during the tour (shared van or car)',
      'Available to both hostel and apartment guests',
    ],
    stopsTitle: 'Main tour stops',
    stops: [
      {
        name: 'Christ the Redeemer',
        description:
          'The iconic statue atop Corcovado, with a 360° panoramic view of the city.',
      },
      {
        name: 'Sugarloaf Mountain',
        description:
          'Cable car ride to the summit with views of Guanabara Bay and Urca.',
      },
      {
        name: 'South Zone Beaches',
        description:
          'Copacabana and Ipanema — the world\'s most famous beaches, 20 min from the hostel.',
      },
      {
        name: 'Historic Center',
        description:
          'Lapa, the Arches, Cinelândia, Selarón Steps and the city\'s cultural heart.',
      },
      {
        name: 'Santa Teresa',
        description:
          'Your own neighborhood! The guide shares the history and secrets of Rio\'s most bohemian area.',
      },
    ],
    whoTitle: 'Professional guide',
    whoBody:
      'The tour is led by a certified tour guide, a partner of Lapa Casa Rio, with years of experience hosting international travelers. Speaks Portuguese, English and Spanish. Small groups for a more personalized experience.',
    practicalTitle: 'Practical info',
    practicalItems: [
      'Duration: 8 to 10 hours (departs at 8am, returns to hostel by evening)',
      'Small groups: up to 8 people per departure',
      'Languages: Portuguese, English and Spanish',
      'Available Monday to Saturday, subject to availability',
      'Transportation included — no need to catch a taxi or metro',
      'Sugarloaf and Christ the Redeemer entrance fees not included (guide helps organize)',
      'Booking via WhatsApp at least 24h in advance',
    ],
    faq: [
      {
        q: 'Is the tour included in the accommodation price?',
        a: 'The tour is part of a special package. When booking, let us know via WhatsApp that you\'re interested in the tour package — the team will confirm availability and arrange the details.',
      },
      {
        q: 'Can I book the tour without staying at Lapa Casa?',
        a: 'The tour is designed especially for Lapa Casa Rio guests (hostel and apartments). Contact us via WhatsApp to check availability for non-guests.',
      },
      {
        q: 'Does the tour work for groups?',
        a: 'Yes! Groups of up to 8 people per departure. For larger groups, separate departures can be arranged. Chat with the team via WhatsApp.',
      },
      {
        q: 'Are the Christ and Sugarloaf tickets included?',
        a: 'Entrance tickets are not included in the package, but the guide helps with advance online purchase to avoid queues. Fees are paid directly at the attractions.',
      },
      {
        q: 'Does the tour run in the rain?',
        a: 'In most cases yes, with itinerary adjustments. In case of heavy rain, the guide gives advance notice and reschedules at no extra cost.',
      },
    ],
    ctaTitle: 'Book your package with tour',
    ctaBody:
      'Stay at Lapa Casa Rio and experience Rio like never before. Contact the team via WhatsApp to reserve the package with tour included.',
    ctaBtn: 'Book accommodation',
    ctaWa: 'WhatsApp us',
    backLabel: 'Back',
  },

  es: {
    headline: 'Alojamiento + Tour por Río',
    tagline: 'Una experiencia completa, del hostel a las maravillas de Río',
    intro:
      'Lapa Casa Rio ofrece un paquete exclusivo: alójate con nosotros y descubre Río de Janeiro con un guía turístico profesional. Visitas a los puntos más icónicos de la ciudad en un solo día — ideal para quienes quieren aprovechar al máximo su estadía.',
    packageTitle: 'Qué está incluido',
    packageItems: [
      'Tour guiado de un día completo por Río de Janeiro',
      'Guía turístico profesional con experiencia en grupos internacionales',
      'Visitas a Cristo Redentor, Pan de Azúcar, Centro Histórico y más',
      'Transporte durante el tour (van o auto compartido)',
      'Disponible para huéspedes del hostel y de los apartamentos',
    ],
    stopsTitle: 'Principales paradas del tour',
    stops: [
      {
        name: 'Cristo Redentor',
        description:
          'La icónica estatua en la cima del Corcovado, con vista panorámica de 360° de la ciudad.',
      },
      {
        name: 'Pan de Azúcar',
        description:
          'Subida en teleférico hasta la cima con vistas a la Bahía de Guanabara y Urca.',
      },
      {
        name: 'Playas de Zona Sur',
        description:
          'Copacabana e Ipanema — las playas más famosas del mundo, a 20 min del hostel.',
      },
      {
        name: 'Centro Histórico',
        description:
          'Lapa, los Arcos, Cinelândia, Escalera Selarón y el corazón cultural de la ciudad.',
      },
      {
        name: 'Santa Teresa',
        description:
          '¡Tu propio barrio! El guía cuenta la historia y los secretos del barrio más bohemio de Río.',
      },
    ],
    whoTitle: 'Guía profesional',
    whoBody:
      'El tour es conducido por un guía turístico certificado, socio del Lapa Casa Rio, con años de experiencia recibiendo viajeros internacionales. Habla portugués, inglés y español. Grupos pequeños para una experiencia más personalizada.',
    practicalTitle: 'Información práctica',
    practicalItems: [
      'Duración: 8 a 10 horas (salida a las 8h, regreso al hostel al atardecer)',
      'Grupos pequeños: hasta 8 personas por salida',
      'Idiomas: portugués, inglés y español',
      'Disponible de lunes a sábado, sujeto a disponibilidad',
      'Transporte incluido — sin necesidad de tomar taxi o metro',
      'Entradas al Pan de Azúcar y al Cristo no incluidas (el guía ayuda a organizarlas)',
      'Reserva por WhatsApp con mínimo 24h de anticipación',
    ],
    faq: [
      {
        q: '¿El tour está incluido en el precio del alojamiento?',
        a: 'El tour forma parte de un paquete especial. Al reservar, indicá por WhatsApp que te interesa el paquete con tour — el equipo confirma la disponibilidad y coordina los detalles.',
      },
      {
        q: '¿Puedo contratar el tour sin alojarme en Lapa Casa?',
        a: 'El tour está pensado especialmente para huéspedes del Lapa Casa Rio (hostel y apartamentos). Contactanos por WhatsApp para consultar disponibilidad para externos.',
      },
      {
        q: '¿El tour sirve para grupos?',
        a: 'Sí. Grupos de hasta 8 personas por salida. Para grupos más grandes, se pueden organizar salidas separadas. Hablá con el equipo por WhatsApp.',
      },
      {
        q: '¿Las entradas al Cristo y al Pan de Azúcar están incluidas?',
        a: 'Las entradas no están incluidas en el paquete, pero el guía ayuda a comprarlas anticipadamente online para evitar filas. Los costos se pagan directamente en las atracciones.',
      },
      {
        q: '¿El tour sale aunque llueva?',
        a: 'En la mayoría de los casos sí, con adaptaciones en el itinerario. En caso de lluvia intensa, el guía avisa con anticipación y reprograma sin costo adicional.',
      },
    ],
    ctaTitle: 'Reservá tu paquete con tour',
    ctaBody:
      'Alójate en Lapa Casa Rio y viví Río como nunca antes. Hablá con el equipo por WhatsApp para reservar el paquete con tour incluido.',
    ctaBtn: 'Reservar alojamiento',
    ctaWa: 'WhatsApp',
    backLabel: 'Volver',
  },

  de: {
    headline: 'Unterkunft + Rio-Tour',
    tagline: 'Ein vollständiges Erlebnis — vom Hostel zu Rios Wundern',
    intro:
      'Lapa Casa Rio bietet ein exklusives Paket: Übernachte bei uns und entdecke Rio de Janeiro mit einem professionellen Reiseführer. Besuche die ikonischsten Sehenswürdigkeiten der Stadt an einem einzigen Tag.',
    packageTitle: 'Was ist enthalten',
    packageItems: [
      'Ganztägige geführte Tour durch Rio de Janeiro',
      'Professioneller Guide mit Erfahrung in internationalen Gruppen',
      'Besuch von Christusstatue, Zuckerhut, Historischem Zentrum und mehr',
      'Transport während der Tour (Kleinbus oder geteiltes Auto)',
      'Verfügbar für Hostel- und Apartment-Gäste',
    ],
    stopsTitle: 'Hauptstationen der Tour',
    stops: [
      {
        name: 'Christusstatue (Corcovado)',
        description: 'Die ikonische Statue auf dem Corcovado mit 360°-Panoramablick über die Stadt.',
      },
      {
        name: 'Zuckerhut (Pão de Açúcar)',
        description: 'Seilbahnfahrt zum Gipfel mit Blick auf die Guanabara-Bucht und Urca.',
      },
      {
        name: 'Strände der Südzone',
        description: 'Copacabana und Ipanema — die berühmtesten Strände der Welt, 20 Min. vom Hostel.',
      },
      {
        name: 'Historisches Zentrum',
        description: 'Lapa, die Bögen, Cinelândia, Selarón-Treppe und das kulturelle Herz der Stadt.',
      },
      {
        name: 'Santa Teresa',
        description: 'Ihr eigenes Viertel! Der Guide erzählt die Geschichte des bohemianischsten Stadtteils Rios.',
      },
    ],
    whoTitle: 'Professioneller Reiseführer',
    whoBody:
      'Die Tour wird von einem zertifizierten Reiseführer geleitet, einem Partner von Lapa Casa Rio, mit jahrelanger Erfahrung mit internationalen Reisenden. Spricht Portugiesisch, Englisch und Spanisch. Kleine Gruppen für ein persönlicheres Erlebnis.',
    practicalTitle: 'Praktische Informationen',
    practicalItems: [
      'Dauer: 8 bis 10 Stunden (Abfahrt um 8 Uhr, Rückkehr zum Hostel am Abend)',
      'Kleine Gruppen: bis zu 8 Personen pro Abfahrt',
      'Sprachen: Portugiesisch, Englisch und Spanisch',
      'Verfügbar Montag bis Samstag, je nach Verfügbarkeit',
      'Transport inbegriffen — kein Taxi oder U-Bahn nötig',
      'Eintrittskarten für Zuckerhut und Christusstatue nicht enthalten (Guide hilft bei der Organisation)',
      'Buchung per WhatsApp mindestens 24 Stunden im Voraus',
    ],
    faq: [
      {
        q: 'Ist die Tour im Übernachtungspreis inbegriffen?',
        a: 'Die Tour ist Teil eines Sonderpakets. Teile uns beim Buchen per WhatsApp mit, dass du am Tour-Paket interessiert bist — das Team bestätigt die Verfügbarkeit und klärt die Details.',
      },
      {
        q: 'Kann ich die Tour ohne Übernachtung im Lapa Casa buchen?',
        a: 'Die Tour ist speziell für Lapa Casa Rio-Gäste (Hostel und Apartments) konzipiert. Kontaktiere uns per WhatsApp, um die Verfügbarkeit für Nicht-Gäste zu erfragen.',
      },
      {
        q: 'Funktioniert die Tour auch für Gruppen?',
        a: 'Ja! Gruppen mit bis zu 8 Personen pro Abfahrt. Für größere Gruppen können separate Abfahrten organisiert werden. Sprich mit dem Team per WhatsApp.',
      },
      {
        q: 'Sind die Eintrittskarten für Christus und Zuckerhut enthalten?',
        a: 'Eintrittskarten sind nicht im Paket enthalten, aber der Guide hilft beim Online-Vorabkauf, um Warteschlangen zu vermeiden. Gebühren werden direkt an den Sehenswürdigkeiten bezahlt.',
      },
    ],
    ctaTitle: 'Buche dein Paket mit Tour',
    ctaBody:
      'Übernachte im Lapa Casa Rio und erlebe Rio wie nie zuvor. Kontaktiere das Team per WhatsApp, um das Paket mit inkludierter Tour zu buchen.',
    ctaBtn: 'Unterkunft buchen',
    ctaWa: 'WhatsApp',
    backLabel: 'Zurück',
  },

  fr: {
    headline: 'Hébergement + Tour de Rio',
    tagline: 'Une expérience complète — de l\'auberge aux merveilles de Rio',
    intro:
      'Lapa Casa Rio propose un forfait exclusif : séjournez chez nous et découvrez Rio de Janeiro avec un guide touristique professionnel. Visitez les sites les plus emblématiques de la ville en une seule journée — idéal pour profiter au maximum de votre séjour.',
    packageTitle: 'Ce qui est inclus',
    packageItems: [
      'Visite guidée d\'une journée complète de Rio de Janeiro',
      'Guide professionnel expérimenté avec les groupes internationaux',
      'Visites du Christ Rédempteur, du Pain de Sucre, du Centre Historique et plus',
      'Transport pendant la visite (minibus ou voiture partagée)',
      'Disponible pour les clients de l\'auberge et des appartements',
    ],
    stopsTitle: 'Principaux arrêts de la visite',
    stops: [
      {
        name: 'Christ Rédempteur',
        description: 'L\'emblématique statue au sommet du Corcovado, avec une vue panoramique à 360° sur la ville.',
      },
      {
        name: 'Pain de Sucre',
        description: 'Montée en téléphérique jusqu\'au sommet avec vue sur la baie de Guanabara et Urca.',
      },
      {
        name: 'Plages de la Zone Sud',
        description: 'Copacabana et Ipanema — les plages les plus célèbres du monde, à 20 min de l\'auberge.',
      },
      {
        name: 'Centre Historique',
        description: 'Lapa, les arches, Cinelândia, l\'Escalier Selarón et le cœur culturel de la ville.',
      },
      {
        name: 'Santa Teresa',
        description: 'Votre propre quartier ! Le guide partage l\'histoire et les secrets du quartier le plus bohème de Rio.',
      },
    ],
    whoTitle: 'Guide professionnel',
    whoBody:
      'La visite est animée par un guide touristique certifié, partenaire de Lapa Casa Rio, avec des années d\'expérience auprès de voyageurs internationaux. Parle portugais, anglais et espagnol. Petits groupes pour une expérience plus personnalisée.',
    practicalTitle: 'Informations pratiques',
    practicalItems: [
      'Durée : 8 à 10 heures (départ à 8h, retour à l\'auberge en soirée)',
      'Petits groupes : jusqu\'à 8 personnes par départ',
      'Langues : portugais, anglais et espagnol',
      'Disponible du lundi au samedi, sous réserve de disponibilité',
      'Transport inclus — pas besoin de taxi ou de métro',
      'Billets d\'entrée au Pain de Sucre et au Christ non inclus (le guide aide à les organiser)',
      'Réservation par WhatsApp au moins 24h à l\'avance',
    ],
    faq: [
      {
        q: 'La visite est-elle incluse dans le prix de l\'hébergement ?',
        a: 'La visite fait partie d\'un forfait spécial. Lors de la réservation, indiquez par WhatsApp que vous êtes intéressé par le forfait avec visite — l\'équipe confirme la disponibilité et arrange les détails.',
      },
      {
        q: 'Puis-je réserver la visite sans séjourner au Lapa Casa ?',
        a: 'La visite est conçue spécialement pour les clients de Lapa Casa Rio (auberge et appartements). Contactez-nous par WhatsApp pour vérifier la disponibilité pour les non-résidents.',
      },
      {
        q: 'La visite convient-elle aux groupes ?',
        a: 'Oui ! Groupes jusqu\'à 8 personnes par départ. Pour les groupes plus importants, des départs séparés peuvent être organisés. Parlez à l\'équipe par WhatsApp.',
      },
      {
        q: 'Les billets pour le Christ et le Pain de Sucre sont-ils inclus ?',
        a: 'Les billets d\'entrée ne sont pas inclus dans le forfait, mais le guide aide à les acheter en ligne à l\'avance pour éviter les files d\'attente. Les frais sont payés directement aux attractions.',
      },
    ],
    ctaTitle: 'Réservez votre forfait avec visite',
    ctaBody:
      'Séjournez au Lapa Casa Rio et vivez Rio comme jamais. Contactez l\'équipe par WhatsApp pour réserver le forfait avec visite incluse.',
    ctaBtn: 'Réserver l\'hébergement',
    ctaWa: 'WhatsApp',
    backLabel: 'Retour',
  },

  it: {
    headline: 'Soggiorno + Tour di Rio',
    tagline: 'Un\'esperienza completa, dall\'ostello alle meraviglie di Rio',
    intro:
      'Lapa Casa Rio offre un pacchetto esclusivo: soggiorna da noi e scopri Rio de Janeiro con una guida turistica professionale. Visita i luoghi più iconici della città in un\'unica giornata — perfetto per chi vuole sfruttare al massimo il soggiorno.',
    packageTitle: 'Cosa è incluso',
    packageItems: [
      'Tour guidato di un\'intera giornata per Rio de Janeiro',
      'Guida professionale con esperienza in gruppi internazionali',
      'Visite al Cristo Redentore, Pan di Zucchero, Centro Storico e altro',
      'Trasporto durante il tour (van o auto condivisa)',
      'Disponibile per gli ospiti dell\'ostello e degli appartamenti',
    ],
    stopsTitle: 'Principali tappe del tour',
    stops: [
      {
        name: 'Cristo Redentore',
        description: 'L\'iconica statua in cima al Corcovado, con vista panoramica a 360° sulla città.',
      },
      {
        name: 'Pan di Zucchero',
        description: 'Salita in funivia fino alla vetta con vista sulla Baia di Guanabara e Urca.',
      },
      {
        name: 'Spiagge della Zona Sud',
        description: 'Copacabana e Ipanema — le spiagge più famose del mondo, a 20 min dall\'ostello.',
      },
      {
        name: 'Centro Storico',
        description: 'Lapa, gli Archi, Cinelândia, la Scalinata Selarón e il cuore culturale della città.',
      },
      {
        name: 'Santa Teresa',
        description: 'Il tuo stesso quartiere! La guida racconta la storia e i segreti del quartiere più bohémien di Rio.',
      },
    ],
    whoTitle: 'Guida professionale',
    whoBody:
      'Il tour è condotto da una guida turistica certificata, partner di Lapa Casa Rio, con anni di esperienza nell\'accoglienza di viaggiatori internazionali. Parla portoghese, inglese e spagnolo. Gruppi piccoli per un\'esperienza più personalizzata.',
    practicalTitle: 'Informazioni pratiche',
    practicalItems: [
      'Durata: 8-10 ore (partenza alle 8:00, ritorno all\'ostello in serata)',
      'Gruppi piccoli: fino a 8 persone per partenza',
      'Lingue: portoghese, inglese e spagnolo',
      'Disponibile dal lunedì al sabato, soggetto a disponibilità',
      'Trasporto incluso — senza bisogno di taxi o metro',
      'Biglietti d\'ingresso al Pan di Zucchero e al Cristo non inclusi (la guida aiuta ad organizzarli)',
      'Prenotazione via WhatsApp con almeno 24h di anticipo',
    ],
    faq: [
      {
        q: 'Il tour è incluso nel prezzo dell\'alloggio?',
        a: 'Il tour fa parte di un pacchetto speciale. Al momento della prenotazione, comunica via WhatsApp il tuo interesse per il pacchetto con tour — il team confermerà la disponibilità e organizzerà i dettagli.',
      },
      {
        q: 'Posso prenotare il tour senza soggiornare al Lapa Casa?',
        a: 'Il tour è pensato appositamente per gli ospiti del Lapa Casa Rio (ostello e appartamenti). Contattaci via WhatsApp per verificare la disponibilità per i non ospiti.',
      },
      {
        q: 'Il tour è adatto ai gruppi?',
        a: 'Sì! Gruppi fino a 8 persone per partenza. Per gruppi più numerosi, è possibile organizzare partenze separate. Parla con il team via WhatsApp.',
      },
      {
        q: 'I biglietti per il Cristo e il Pan di Zucchero sono inclusi?',
        a: 'I biglietti d\'ingresso non sono inclusi nel pacchetto, ma la guida aiuta con l\'acquisto online anticipato per evitare le code. I costi si pagano direttamente alle attrazioni.',
      },
    ],
    ctaTitle: 'Prenota il tuo pacchetto con tour',
    ctaBody:
      'Soggiorna al Lapa Casa Rio e vivi Rio come mai prima. Contatta il team via WhatsApp per prenotare il pacchetto con tour incluso.',
    ctaBtn: 'Prenota alloggio',
    ctaWa: 'Scrivici su WhatsApp',
    backLabel: 'Indietro',
  },
};

// ─── JSON-LD schema ─────────────────────────────────────────────────────────

const TourSchema = {
  '@context': 'https://schema.org',
  '@type': 'TouristTrip',
  name: 'Lapa Casa Rio — Rio de Janeiro Guided Tour Package',
  description:
    'Full-day guided tour of Rio de Janeiro included in your stay at Lapa Casa Rio. Visit Christ the Redeemer, Sugarloaf Mountain, beaches and historic center with a professional guide.',
  url: 'https://lapacasario.com/en/tour',
  touristType: ['Backpacker', 'Group traveler', 'Cultural tourist', 'Solo traveler'],
  availableLanguage: ['Portuguese', 'English', 'Spanish'],
  itinerary: {
    '@type': 'ItemList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Christ the Redeemer' },
      { '@type': 'ListItem', position: 2, name: 'Sugarloaf Mountain' },
      { '@type': 'ListItem', position: 3, name: 'Copacabana & Ipanema beaches' },
      { '@type': 'ListItem', position: 4, name: 'Historic Center & Lapa' },
      { '@type': 'ListItem', position: 5, name: 'Santa Teresa' },
    ],
  },
  provider: {
    '@type': 'LodgingBusiness',
    name: 'Lapa Casa Rio',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Rua Silvio Romero, 22',
      addressLocality: 'Santa Teresa',
      addressRegion: 'Rio de Janeiro',
      addressCountry: 'BR',
    },
    telephone: '+5521977157530',
  },
};

// ─── Page component ────────────────────────────────────────────────────────

export default async function TourPage({ params }: { params: { locale: string } }) {
  const locale = (
    locales.includes(params.locale as Locale) ? params.locale : defaultLocale
  ) as Locale;
  setRequestLocale(locale);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const c = CONTENT[locale]!;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <main className="min-h-screen bg-background">
      <StructuredData data={TourSchema} />
      <StructuredData data={faqSchema} />

      {/* ── Hero con imagen de los Arcos da Lapa ── */}
      <section className="relative overflow-hidden border-b border-border">
        {/* imagen de fondo — la misma que usa el header del motor de hostel */}
        <div className="absolute inset-0">
          <Image
            src="/img/arcos-lapa.png"
            alt="Arcos da Lapa, Rio de Janeiro"
            fill
            priority
            className="object-cover object-center"
          />
          {/* overlay oscuro para legibilidad del texto */}
          <div className="absolute inset-0 bg-foreground/60" />
        </div>

        {/* back link */}
        <div className="relative max-w-3xl mx-auto px-4 pt-6">
          <Link
            href={`/${locale}/hostel`}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {c.backLabel}
          </Link>
        </div>

        {/* contenido del hero */}
        <div className="relative max-w-3xl mx-auto px-4 pb-14 pt-6">
          <p className="text-xs font-display font-semibold tracking-[0.18em] uppercase text-white/60 mb-5 flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            Rio de Janeiro · Brasil
          </p>
          <h1
            className="font-serif font-semibold leading-[1.1] text-white mb-5"
            style={{ fontSize: 'clamp(2.4rem, 6vw, 3.6rem)' }}
          >
            {c.headline}
          </h1>
          <p className="font-display font-medium text-lg text-white/80 mb-5 tracking-tight">
            {c.tagline}
          </p>
          <p className="text-sm text-white/70 leading-relaxed max-w-2xl">{c.intro}</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4">

        {/* ── Package included ── */}
        <section className="py-12 border-b border-border">
          <h2 className="font-display font-semibold text-xl text-foreground mb-5 tracking-tight">
            {c.packageTitle}
          </h2>
          <ul className="space-y-3.5">
            {c.packageItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground leading-relaxed">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Tour stops ── */}
        <section className="py-12 border-b border-border">
          <h2 className="font-display font-semibold text-xl text-foreground mb-7 tracking-tight">
            {c.stopsTitle}
          </h2>
          <div className="space-y-6">
            {c.stops.map((stop, i) => (
              <div key={i} className="flex gap-4 items-start">
                {/* número */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full border border-primary/30 bg-primary/8 text-primary flex items-center justify-center text-xs font-display font-bold tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="pt-1">
                  <p className="font-serif font-semibold text-[1.1rem] text-foreground leading-tight">
                    {stop.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {stop.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Practical info — 3 pills + lista ── */}
        <section className="py-12 border-b border-border">
          <h2 className="font-display font-semibold text-xl text-foreground mb-6 tracking-tight">
            {c.practicalTitle}
          </h2>
          {/* chips de datos clave */}
          <div className="flex flex-wrap gap-2.5 mb-7">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-display font-medium text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              8–10 h
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-display font-medium text-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              máx. 8
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-display font-medium text-foreground">
              <Globe className="h-3.5 w-3.5 text-primary" />
              PT · EN · ES
            </span>
          </div>
          <ul className="space-y-3">
            {c.practicalItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground leading-relaxed">
                <ArrowRight className="h-3.5 w-3.5 text-secondary mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Guide ── */}
        <section className="py-12 border-b border-border">
          <h2 className="font-display font-semibold text-xl text-foreground mb-4 tracking-tight">
            {c.whoTitle}
          </h2>
          <p className="text-muted-foreground leading-relaxed text-sm">{c.whoBody}</p>
        </section>

        {/* ── FAQ ── */}
        <section className="py-12 border-b border-border">
          <h2 className="font-display font-semibold text-xl text-foreground mb-7 tracking-tight">
            FAQ
          </h2>
          <div className="space-y-2.5">
            {c.faq.map((item, i) => (
              <details
                key={i}
                className="group border border-border rounded-xl bg-card overflow-hidden"
              >
                <summary className="flex justify-between items-center gap-4 px-5 py-4 cursor-pointer text-sm font-display font-medium text-foreground list-none select-none hover:bg-muted/40 transition-colors">
                  {item.q}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 rotate-90 group-open:-rotate-90 transition-transform duration-200" />
                </summary>
                <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground leading-relaxed border-t border-border">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Tour configurator ── */}
        <TourConfigurator locale={locale} />

        {/* ── Cross-link ── */}
        <div className="py-6 border-b border-border text-sm text-muted-foreground">
          <Link
            href={`/${locale}/santa-teresa`}
            className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
          >
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="underline underline-offset-2">
              {locale === 'pt'
                ? 'Conheça o bairro de Santa Teresa antes de chegar'
                : locale === 'en'
                  ? 'Learn about the Santa Teresa neighborhood before you arrive'
                  : locale === 'es'
                    ? 'Conocé el barrio de Santa Teresa antes de llegar'
                    : locale === 'de'
                      ? 'Entdecke das Viertel Santa Teresa vor deiner Ankunft'
                      : locale === 'it'
                        ? 'Scopri il quartiere di Santa Teresa prima di arrivare'
                        : 'Découvrez le quartier de Santa Teresa avant votre arrivée'}
            </span>
          </Link>
        </div>

        {/* ── CTA ── */}
        <section className="py-12">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-10">
            <h2
              className="font-serif font-semibold text-foreground mb-3"
              style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.1rem)' }}
            >
              {c.ctaTitle}
            </h2>
            <p className="text-sm text-muted-foreground mb-7 leading-relaxed max-w-lg">{c.ctaBody}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/hostel`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-display font-semibold hover:opacity-90 transition-opacity"
              >
                <Calendar className="h-4 w-4" />
                {c.ctaBtn}
              </Link>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5521977157530'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#25D366] text-white text-sm font-display font-semibold hover:opacity-90 transition-opacity"
              >
                <MessageCircle className="h-4 w-4" />
                {c.ctaWa}
              </a>
            </div>
          </div>
        </section>
      </div>

      <SiteFooter locale={locale} />
    </main>
  );
}
