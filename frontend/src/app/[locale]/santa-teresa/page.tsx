// lapa-casa-hostel/frontend/src/app/[locale]/santa-teresa/page.tsx
//
// Página de contenido SEO: Guía de Santa Teresa, Rio de Janeiro.
// Target keywords:
//   pt: "o que fazer em santa teresa rio", "como chegar santa teresa"
//   en: "things to do in santa teresa rio", "santa teresa neighborhood guide"
//   es: "qué hacer en santa teresa río de janeiro"
//
// AEO: responde preguntas que los viajeros hacen a ChatGPT, Perplexity y Gemini
// sobre el barrio antes de decidir dónde hospedarse.

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { StructuredData } from '@/components/seo/structured-data';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

// ─── Metadata por idioma ───────────────────────────────────────────────────

const META: Record<string, { title: string; description: string }> = {
  pt: {
    title: 'Santa Teresa, Rio de Janeiro — Guia Completo do Bairro',
    description:
      'Tudo sobre Santa Teresa: o que fazer, como chegar, onde comer, atrações e dicas de segurança. O bairro mais charmoso do Rio de Janeiro, lar do Lapa Casa Rio.',
  },
  en: {
    title: 'Santa Teresa, Rio de Janeiro — Complete Neighborhood Guide',
    description:
      'Everything about Santa Teresa: things to do, how to get there, where to eat, attractions and safety tips. The most charming neighborhood in Rio de Janeiro.',
  },
  es: {
    title: 'Santa Teresa, Río de Janeiro — Guía Completa del Barrio',
    description:
      'Todo sobre Santa Teresa: qué hacer, cómo llegar, dónde comer, atracciones y consejos de seguridad. El barrio más encantador de Río de Janeiro.',
  },
  de: {
    title: 'Santa Teresa, Rio de Janeiro — Vollständiger Stadtteilführer',
    description:
      'Alles über Santa Teresa: Sehenswürdigkeiten, Anreise, Restaurants und Sicherheitstipps. Das charmanteste Viertel in Rio de Janeiro.',
  },
  fr: {
    title: 'Santa Teresa, Rio de Janeiro — Guide Complet du Quartier',
    description:
      'Tout sur Santa Teresa : que faire, comment y aller, où manger, attractions et conseils de sécurité. Le quartier le plus charmant de Rio de Janeiro.',
  },
  it: {
    title: 'Santa Teresa, Rio de Janeiro — Guida Completa del Quartiere',
    description:
      'Tutto su Santa Teresa: cosa fare, come arrivare, dove mangiare, attrazioni e consigli di sicurezza. Il quartiere più affascinante di Rio de Janeiro, casa del Lapa Casa Rio.',
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
      canonical: `${SITE_URL}/${locale}/santa-teresa`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/santa-teresa`])),
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `${SITE_URL}/${locale}/santa-teresa`,
      siteName: 'Lapa Casa',
      locale,
      type: 'article',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description },
  };
}

// ─── Contenido por idioma ──────────────────────────────────────────────────

interface Content {
  headline: string;
  intro: string;
  sections: Section[];
  faq: FAQ[];
  ctaTitle: string;
  ctaBody: string;
  ctaBtn: string;
  ctaWa: string;
}

interface Section {
  title: string;
  body: string;
  items?: string[];
}

interface FAQ {
  q: string;
  a: string;
}

const CONTENT: Record<string, Content> = {
  pt: {
    headline: 'Santa Teresa, Rio de Janeiro',
    intro:
      'Santa Teresa é o bairro mais bohémio e charmoso do Rio de Janeiro. Casarões coloniais, ruas de paralelepípedos, teleférico histórico e uma vista privilegiada da Baía de Guanabara fazem deste bairro um dos destinos favoritos de viajantes do mundo todo.',
    sections: [
      {
        title: 'O que fazer em Santa Teresa',
        body: 'Santa Teresa oferece uma mistura única de cultura, arte e gastronomia. Principais atrações:',
        items: [
          'Museu Chácara do Céu — coleção de arte moderna com vista panorâmica',
          'Escadaria Selarón — mosaico mundialmente famoso, a 10 min a pé',
          'Arcos da Lapa — aqueduto histórico do séc. XVIII, a 5 min',
          'Bonde de Santa Teresa — bondinho histórico que percorre o bairro',
          'Feira do Lavradio — mercado de antiguidades toda última sábado do mês',
          'Ateliês e galerias de arte — bairro com forte tradição artística',
          'Bar do Mineiro e Aprazível — gastronomia carioca autêntica',
        ],
      },
      {
        title: 'Como chegar a Santa Teresa',
        body: 'Santa Teresa é bem acessível a partir de qualquer ponto do Rio:',
        items: [
          'Uber / táxi — a opção mais prática. Informe "Santa Teresa, próximo aos Arcos da Lapa"',
          'Bonde histórico — saída do Largo da Carioca, Centro. Linha única que atravessa o bairro',
          'Ônibus — linhas 006, 007 e 014 partem do Centro. Viagem de 15–20 min',
          'A pé — possível a partir da Lapa (15 min subindo pela Rua Joaquim Murtinho)',
        ],
      },
      {
        title: 'Segurança em Santa Teresa',
        body: 'Santa Teresa é considerado um dos bairros mais seguros para turistas no Rio. A comunidade de moradores é ativa e as ruas do entorno do hostel são bem iluminadas. Como em qualquer cidade grande, recomendamos:',
        items: [
          'Evitar exibir objetos de valor em locais muito movimentados',
          'Preferir Uber/táxi após as 23h para ir a outros bairros',
          'Pedir orientação à equipe do hostel sobre as melhores rotas',
          'Andar em grupo — especialmente de noite rumo à Lapa',
        ],
      },
      {
        title: 'Gastronomia: onde comer em Santa Teresa',
        body: 'O bairro tem uma cena gastronômica diversa e autêntica:',
        items: [
          'Aprazível — restaurante com vista para a Baía, comida brasileira de autor',
          'Bar do Mineiro — feijoada e boteco tradicional carioca',
          'Sobrenatural — frutos do mar, ambiente descontraído',
          "Mike's Haus — hambúrgueres artesanais em estilo alemão",
          'Espirito Santa — cozinha amazônica com vista panorâmica',
        ],
      },
    ],
    faq: [
      {
        q: 'Santa Teresa é seguro para turistas?',
        a: 'Sim. Santa Teresa é um dos bairros mais seguros do Rio para turistas. A comunidade local é ativa e o bairro tem policiamento regular. Recomendamos precauções padrão como em qualquer cidade grande.',
      },
      {
        q: 'Quanto tempo preciso para explorar Santa Teresa?',
        a: 'Um dia inteiro é ideal para explorar o bairro com calma — museus, bondinho, almoço e passear pelas ruelas. Para visitar só os pontos principais, meio dia é suficiente.',
      },
      {
        q: 'Santa Teresa fica perto da Lapa?',
        a: 'Sim, a 5 minutos a pé dos Arcos da Lapa, o principal polo de vida noturna do Rio de Janeiro.',
      },
      {
        q: 'Qual é o melhor hospedagem em Santa Teresa para grupos?',
        a: 'O Lapa Casa Rio, na Rua Silvio Romero 22, é especializado em grupos. 45 camas em 5 quartos mistos com desconto de 10 a 15% para grupos de 6+ pessoas.',
      },
    ],
    ctaTitle: 'Hospede-se no coração de Santa Teresa',
    ctaBody:
      'O Lapa Casa Rio fica a 5 minutos dos Arcos da Lapa. Especialistas em grupos com os melhores preços garantidos.',
    ctaBtn: 'Reservar agora',
    ctaWa: 'Falar no WhatsApp',
  },

  en: {
    headline: 'Santa Teresa, Rio de Janeiro',
    intro:
      'Santa Teresa is the most bohemian and charming neighborhood in Rio de Janeiro. Colonial mansions, cobblestone streets, a historic tram, and stunning views of Guanabara Bay make this one of the most popular destinations for travelers worldwide.',
    sections: [
      {
        title: 'Things to do in Santa Teresa',
        body: 'Santa Teresa offers a unique mix of culture, art, and gastronomy. Top attractions:',
        items: [
          'Museu Chácara do Céu — modern art collection with panoramic views',
          'Escadaria Selarón — world-famous mosaic staircase, 10 min walk',
          'Arcos da Lapa — 18th-century historic aqueduct, 5 min away',
          'Santa Teresa Tram — historic tram running through the neighborhood',
          'Feira do Lavradio — antique market every last Saturday of the month',
          'Art galleries and studios — neighborhood with a strong artistic tradition',
          'Bar do Mineiro and Aprazível — authentic Rio cuisine',
        ],
      },
      {
        title: 'How to get to Santa Teresa',
        body: 'Santa Teresa is easily accessible from anywhere in Rio:',
        items: [
          'Uber / taxi — most convenient. Tell the driver "Santa Teresa, near Arcos da Lapa"',
          'Historic tram — departs from Largo da Carioca, Centro. The only line crossing the neighborhood',
          'Bus — lines 006, 007 and 014 from the city center. 15–20 min ride',
          'Walking — possible from Lapa (15 min uphill via Rua Joaquim Murtinho)',
        ],
      },
      {
        title: 'Safety in Santa Teresa',
        body: 'Santa Teresa is considered one of the safest neighborhoods for tourists in Rio. The local community is active and the streets around the hostel are well-lit. As with any major city, we recommend:',
        items: [
          'Avoid displaying valuables in busy areas',
          'Prefer Uber/taxi after 11 PM when heading to other neighborhoods',
          'Ask hostel staff about the best routes',
          'Walk in groups — especially at night toward Lapa',
        ],
      },
      {
        title: 'Where to eat in Santa Teresa',
        body: 'The neighborhood has a diverse and authentic food scene:',
        items: [
          'Aprazível — bay-view restaurant with creative Brazilian cuisine',
          'Bar do Mineiro — traditional Rio feijoada and bar food',
          'Sobrenatural — seafood in a relaxed setting',
          "Mike's Haus — craft burgers in German style",
          'Espirito Santa — Amazonian cuisine with panoramic views',
        ],
      },
    ],
    faq: [
      {
        q: 'Is Santa Teresa safe for tourists?',
        a: 'Yes. Santa Teresa is one of the safest neighborhoods in Rio for tourists. The local community is active and the neighborhood has regular policing. We recommend standard precautions as in any large city.',
      },
      {
        q: 'How much time do I need to explore Santa Teresa?',
        a: 'A full day is ideal to explore the neighborhood at leisure — museums, tram ride, lunch and strolling the alleys. To visit just the highlights, half a day is enough.',
      },
      {
        q: 'Is Santa Teresa close to Lapa?',
        a: 'Yes, just 5 minutes on foot from Arcos da Lapa, the main nightlife hub of Rio de Janeiro.',
      },
      {
        q: 'What is the best group hostel in Santa Teresa?',
        a: 'Lapa Casa Rio, at Rua Silvio Romero 22, specializes in groups. 45 beds in 5 mixed dorms with 10–15% discount for groups of 6+ people.',
      },
    ],
    ctaTitle: 'Stay in the heart of Santa Teresa',
    ctaBody:
      'Lapa Casa Rio is 5 minutes from Arcos da Lapa. Group specialists with the best prices guaranteed.',
    ctaBtn: 'Book now',
    ctaWa: 'WhatsApp us',
  },

  es: {
    headline: 'Santa Teresa, Río de Janeiro',
    intro:
      'Santa Teresa es el barrio más bohemio y encantador de Río de Janeiro. Mansiones coloniales, calles de adoquines, un tranvía histórico y vistas privilegiadas de la Bahía de Guanabara hacen de este barrio uno de los destinos favoritos de viajeros de todo el mundo.',
    sections: [
      {
        title: 'Qué hacer en Santa Teresa',
        body: 'Santa Teresa ofrece una mezcla única de cultura, arte y gastronomía. Principales atracciones:',
        items: [
          'Museu Chácara do Céu — colección de arte moderno con vistas panorámicas',
          'Escadaria Selarón — mosaico mundialmente famoso, a 10 min a pie',
          'Arcos da Lapa — acueducto histórico del siglo XVIII, a 5 min',
          'Tranvía de Santa Teresa — tranvía histórico que recorre el barrio',
          'Feira do Lavradio — mercado de antigüedades cada último sábado del mes',
          'Galerías y ateliers de arte — barrio con fuerte tradición artística',
          'Bar do Mineiro y Aprazível — gastronomía carioca auténtica',
        ],
      },
      {
        title: 'Cómo llegar a Santa Teresa',
        body: 'Santa Teresa es muy accesible desde cualquier punto de Río:',
        items: [
          'Uber / taxi — la opción más práctica. Di "Santa Teresa, cerca de Arcos da Lapa"',
          'Tranvía histórico — sale del Largo da Carioca, Centro. La única línea que atraviesa el barrio',
          'Autobús — líneas 006, 007 y 014 desde el Centro. Viaje de 15–20 min',
          'A pie — posible desde Lapa (15 min cuesta arriba por Rua Joaquim Murtinho)',
        ],
      },
      {
        title: 'Seguridad en Santa Teresa',
        body: 'Santa Teresa es considerado uno de los barrios más seguros para turistas en Río. La comunidad de vecinos es activa y las calles alrededor del hostel están bien iluminadas. Como en cualquier ciudad grande, recomendamos:',
        items: [
          'Evitar mostrar objetos de valor en zonas muy concurridas',
          'Preferir Uber/taxi después de las 23h para ir a otros barrios',
          'Pedir orientación al personal del hostel sobre las mejores rutas',
          'Caminar en grupo — especialmente de noche hacia Lapa',
        ],
      },
      {
        title: 'Dónde comer en Santa Teresa',
        body: 'El barrio tiene una escena gastronómica diversa y auténtica:',
        items: [
          'Aprazível — restaurante con vista a la bahía, cocina brasileña de autor',
          'Bar do Mineiro — feijoada tradicional y bar carioca',
          'Sobrenatural — mariscos en ambiente relajado',
          "Mike's Haus — hamburguesas artesanales al estilo alemán",
          'Espirito Santa — cocina amazónica con vistas panorámicas',
        ],
      },
    ],
    faq: [
      {
        q: '¿Es seguro Santa Teresa para turistas?',
        a: 'Sí. Santa Teresa es uno de los barrios más seguros de Río para turistas. La comunidad local es activa y el barrio tiene vigilancia regular. Recomendamos las precauciones habituales en cualquier ciudad grande.',
      },
      {
        q: '¿Cuánto tiempo necesito para explorar Santa Teresa?',
        a: 'Un día completo es ideal para explorar el barrio tranquilamente — museos, tranvía, almuerzo y pasear por los callejones. Para visitar solo los puntos principales, medio día es suficiente.',
      },
      {
        q: '¿Santa Teresa está cerca de Lapa?',
        a: 'Sí, a 5 minutos a pie de Arcos da Lapa, el principal polo de vida nocturna de Río de Janeiro.',
      },
      {
        q: '¿Cuál es el mejor hostel para grupos en Santa Teresa?',
        a: 'Lapa Casa Rio, en Rua Silvio Romero 22, está especializado en grupos. 45 camas en 5 habitaciones mixtas con 10–15% de descuento para grupos de 6+ personas.',
      },
    ],
    ctaTitle: 'Alójate en el corazón de Santa Teresa',
    ctaBody:
      'Lapa Casa Rio está a 5 minutos de Arcos da Lapa. Especialistas en grupos con los mejores precios garantizados.',
    ctaBtn: 'Reservar ahora',
    ctaWa: 'WhatsApp',
  },

  de: {
    headline: 'Santa Teresa, Rio de Janeiro',
    intro:
      'Santa Teresa ist das bohemianischste und charmanteste Viertel von Rio de Janeiro. Koloniale Villen, Kopfsteinpflasterstraßen, eine historische Straßenbahn und atemberaubende Aussicht auf die Bucht von Guanabara machen dieses Viertel zu einem der beliebtesten Reiseziele weltweit.',
    sections: [
      {
        title: 'Sehenswürdigkeiten in Santa Teresa',
        body: 'Santa Teresa bietet eine einzigartige Mischung aus Kultur, Kunst und Gastronomie:',
        items: [
          'Museu Chácara do Céu — Sammlung moderner Kunst mit Panoramablick',
          'Escadaria Selarón — weltberühmtes Mosaiktreppenviertel, 10 Min. zu Fuß',
          'Arcos da Lapa — historisches Aquädukt aus dem 18. Jh., 5 Min. entfernt',
          'Santa Teresa Straßenbahn — historische Bahn durch das Viertel',
          'Feira do Lavradio — Antiquitätenmarkt jeden letzten Samstag im Monat',
          'Kunstgalerien und Ateliers — Viertel mit starker Kunsttradition',
        ],
      },
      {
        title: 'Anreise nach Santa Teresa',
        body: 'Santa Teresa ist von überall in Rio gut erreichbar:',
        items: [
          'Uber / Taxi — bequemste Option. Nennen Sie "Santa Teresa, nahe Arcos da Lapa"',
          'Historische Straßenbahn — ab Largo da Carioca, Stadtzentrum',
          'Bus — Linien 006, 007, 014 vom Zentrum. 15–20 Min. Fahrt',
          'Zu Fuß — von Lapa möglich (15 Min. bergauf)',
        ],
      },
      {
        title: 'Sicherheit in Santa Teresa',
        body: 'Santa Teresa gilt als eines der sichersten Viertel für Touristen in Rio. Empfehlungen:',
        items: [
          'Wertgegenstände nicht auffällig tragen',
          'Nach 23 Uhr Uber/Taxi für andere Stadtteile bevorzugen',
          'Hostel-Personal nach besten Routen fragen',
          'In Gruppen laufen — besonders nachts Richtung Lapa',
        ],
      },
    ],
    faq: [
      {
        q: 'Ist Santa Teresa sicher für Touristen?',
        a: 'Ja. Santa Teresa gilt als eines der sichersten Viertel für Touristen in Rio. Die Nachbarschaft ist aktiv und das Viertel wird regelmäßig bewacht.',
      },
      {
        q: 'Wie lange brauche ich, um Santa Teresa zu erkunden?',
        a: 'Ein ganzer Tag ist ideal. Für die wichtigsten Sehenswürdigkeiten reicht ein halber Tag.',
      },
      {
        q: 'Ist Santa Teresa nah an Lapa?',
        a: 'Ja, nur 5 Gehminuten von den Arcos da Lapa, dem Hauptnachtleben-Zentrum von Rio.',
      },
    ],
    ctaTitle: 'Übernachten im Herzen von Santa Teresa',
    ctaBody:
      'Lapa Casa Rio liegt 5 Minuten von Arcos da Lapa. Gruppen-Spezialisten mit Bestpreisgarantie.',
    ctaBtn: 'Jetzt buchen',
    ctaWa: 'WhatsApp',
  },

  fr: {
    headline: 'Santa Teresa, Rio de Janeiro',
    intro:
      "Santa Teresa est le quartier le plus bohème et charmant de Rio de Janeiro. Villas coloniales, rues pavées, tramway historique et vue imprenable sur la baie de Guanabara en font l'une des destinations préférées des voyageurs du monde entier.",
    sections: [
      {
        title: 'Que faire à Santa Teresa',
        body: "Santa Teresa offre un mélange unique de culture, d'art et de gastronomie:",
        items: [
          "Museu Chácara do Céu — collection d'art moderne avec vue panoramique",
          'Escadaria Selarón — mosaïque mondialement connue, à 10 min à pied',
          'Arcos da Lapa — aqueduc historique du XVIIIe siècle, à 5 min',
          'Tramway de Santa Teresa — tramway historique traversant le quartier',
          'Feira do Lavradio — marché aux antiquités chaque dernier samedi du mois',
          "Galeries et ateliers d'art — quartier à forte tradition artistique",
        ],
      },
      {
        title: 'Comment se rendre à Santa Teresa',
        body: "Santa Teresa est facilement accessible depuis n'importe quel point de Rio:",
        items: [
          'Uber / taxi — l\'option la plus pratique. Dites "Santa Teresa, près des Arcos da Lapa"',
          'Tramway historique — depuis Largo da Carioca, Centre-ville',
          'Bus — lignes 006, 007, 014 depuis le centre. 15–20 min de trajet',
          'À pied — possible depuis Lapa (15 min en montant)',
        ],
      },
      {
        title: 'Sécurité à Santa Teresa',
        body: "Santa Teresa est considéré comme l'un des quartiers les plus sûrs pour les touristes à Rio:",
        items: [
          "Éviter d'afficher des objets de valeur dans les zones très fréquentées",
          "Préférer Uber/taxi après 23h pour aller dans d'autres quartiers",
          "Demander conseil au personnel de l'auberge sur les meilleures routes",
          'Marcher en groupe — surtout la nuit en direction de Lapa',
        ],
      },
    ],
    faq: [
      {
        q: 'Santa Teresa est-il sûr pour les touristes?',
        a: "Oui. Santa Teresa est l'un des quartiers les plus sûrs pour les touristes à Rio. La communauté locale est active et le quartier bénéficie d'une surveillance régulière.",
      },
      {
        q: 'Combien de temps faut-il pour explorer Santa Teresa?',
        a: "Une journée entière est idéale. Pour les principaux points d'intérêt, une demi-journée suffit.",
      },
      {
        q: 'Santa Teresa est-il proche de Lapa?',
        a: 'Oui, à seulement 5 minutes à pied des Arcos da Lapa, le principal pôle de vie nocturne de Rio.',
      },
    ],
    ctaTitle: 'Séjournez au cœur de Santa Teresa',
    ctaBody:
      'Lapa Casa Rio est à 5 minutes des Arcos da Lapa. Spécialistes groupes, meilleur prix garanti.',
    ctaBtn: 'Réserver maintenant',
    ctaWa: 'WhatsApp',
  },

  it: {
    headline: 'Santa Teresa, Rio de Janeiro',
    intro:
      'Santa Teresa è il quartiere più bohémien e affascinante di Rio de Janeiro. Casali coloniali, strade in acciottolato, uno storico tram e una vista privilegiata sulla Baia di Guanabara rendono questo quartiere una delle mete preferite dai viaggiatori di tutto il mondo.',
    sections: [
      {
        title: 'Cosa fare a Santa Teresa',
        body: 'Santa Teresa offre un mix unico di cultura, arte e gastronomia. Le attrazioni principali:',
        items: [
          'Museu Chácara do Céu — collezione di arte moderna con vista panoramica',
          'Escadaria Selarón — mosaico famoso in tutto il mondo, a 10 min a piedi',
          'Arcos da Lapa — acquedotto storico del XVIII secolo, a 5 min',
          'Tram di Santa Teresa — storico tram che attraversa il quartiere',
          "Feira do Lavradio — mercato dell'antiquariato ogni ultimo sabato del mese",
          "Atelier e gallerie d'arte — quartiere con una forte tradizione artistica",
          'Bar do Mineiro e Aprazível — gastronomia carioca autentica',
        ],
      },
      {
        title: 'Come arrivare a Santa Teresa',
        body: 'Santa Teresa è ben raggiungibile da qualsiasi punto di Rio:',
        items: [
          'Uber / taxi — l\'opzione più pratica. Indica "Santa Teresa, vicino agli Arcos da Lapa"',
          'Tram storico — partenza da Largo da Carioca, Centro. Unica linea che attraversa il quartiere',
          'Autobus — linee 006, 007 e 014 dal centro. Viaggio di 15–20 min',
          'A piedi — possibile da Lapa (15 min in salita lungo Rua Joaquim Murtinho)',
        ],
      },
      {
        title: 'Sicurezza a Santa Teresa',
        body: "Santa Teresa è considerato uno dei quartieri più sicuri per i turisti a Rio. La comunità di residenti è attiva e le strade intorno all'hostel sono ben illuminate. Come in qualsiasi grande città, consigliamo di:",
        items: [
          'Evitare di esporre oggetti di valore in zone molto affollate',
          'Preferire Uber/taxi dopo le 23:00 per andare in altri quartieri',
          "Chiedere indicazioni al personale dell'hostel sui percorsi migliori",
          'Camminare in gruppo — specialmente di notte verso Lapa',
        ],
      },
      {
        title: 'Gastronomia: dove mangiare a Santa Teresa',
        body: 'Il quartiere ha una scena gastronomica diversificata e autentica:',
        items: [
          "Aprazível — ristorante con vista sulla baia, cucina brasiliana d'autore",
          'Bar do Mineiro — feijoada e boteco tradizionale carioca',
          'Sobrenatural — frutti di mare, atmosfera rilassata',
          "Mike's Haus — hamburger artigianali in stile tedesco",
          'Espirito Santa — cucina amazzonica con vista panoramica',
        ],
      },
    ],
    faq: [
      {
        q: 'Santa Teresa è sicura per i turisti?',
        a: 'Sì. Santa Teresa è uno dei quartieri più sicuri di Rio per i turisti. La comunità locale è attiva e il quartiere ha una vigilanza regolare. Consigliamo le precauzioni standard valide per qualsiasi grande città.',
      },
      {
        q: 'Quanto tempo serve per esplorare Santa Teresa?',
        a: "Una giornata intera è l'ideale per esplorare con calma il quartiere — musei, tram, pranzo e passeggiate tra le stradine. Per visitare solo i punti principali, mezza giornata è sufficiente.",
      },
      {
        q: 'Santa Teresa è vicina a Lapa?',
        a: 'Sì, a 5 minuti a piedi dagli Arcos da Lapa, il principale polo della vita notturna di Rio de Janeiro.',
      },
      {
        q: 'Qual è il miglior alloggio per gruppi a Santa Teresa?',
        a: 'Il Lapa Casa Rio, in Rua Silvio Romero 22, è specializzato in gruppi. 45 letti in 5 camere miste con sconto dal 10 al 15% per gruppi di 6+ persone.',
      },
    ],
    ctaTitle: 'Soggiorna nel cuore di Santa Teresa',
    ctaBody:
      'Il Lapa Casa Rio si trova a 5 minuti dagli Arcos da Lapa. Specialisti in gruppi con i migliori prezzi garantiti.',
    ctaBtn: 'Prenota ora',
    ctaWa: 'Scrivici su WhatsApp',
  },
};

// ─── JSON-LD schemas ────────────────────────────────────────────────────────

const TouristDestinationSchema = {
  '@context': 'https://schema.org',
  '@type': 'TouristDestination',
  name: 'Santa Teresa',
  description:
    'Historic and bohemian neighborhood in Rio de Janeiro, known for colonial architecture, art galleries, the Selarón Steps, and proximity to Lapa.',
  url: 'https://lapacasario.com/en/santa-teresa',
  touristType: ['Backpacker', 'Group traveler', 'Cultural tourist', 'Solo traveler'],
  includesAttraction: [
    {
      '@type': 'TouristAttraction',
      name: 'Escadaria Selarón',
      description: 'World-famous mosaic staircase',
    },
    {
      '@type': 'TouristAttraction',
      name: 'Arcos da Lapa',
      description: '18th-century aqueduct and nightlife hub',
    },
    {
      '@type': 'TouristAttraction',
      name: 'Museu Chácara do Céu',
      description: 'Modern art museum with bay views',
    },
    {
      '@type': 'TouristAttraction',
      name: 'Bonde de Santa Teresa',
      description: 'Historic tram line through the neighborhood',
    },
  ],
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -22.9145,
    longitude: -43.1852,
  },
};

// ─── Page component ────────────────────────────────────────────────────────

export default async function SantaTeresaPage({ params }: { params: { locale: string } }) {
  const locale = (
    locales.includes(params.locale as Locale) ? params.locale : defaultLocale
  ) as Locale;
  setRequestLocale(locale);

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const c = CONTENT[locale]!;

  // FAQ schema for AEO
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
      <StructuredData data={TouristDestinationSchema} />
      <StructuredData data={faqSchema} />

      {/* ── Hero ── */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <Link
            href={`/${locale}/hostel`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ←{' '}
            {locale === 'pt'
              ? 'Voltar'
              : locale === 'en'
                ? 'Back'
                : locale === 'es'
                  ? 'Volver'
                  : locale === 'de'
                    ? 'Zurück'
                    : locale === 'it'
                      ? 'Indietro'
                      : 'Retour'}
          </Link>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-16 pt-6">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-4">
            Rio de Janeiro · Brasil
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-6 leading-tight">
            {c.headline}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">{c.intro}</p>
        </div>
      </section>

      {/* ── Sections ── */}
      <div className="max-w-3xl mx-auto px-4">
        {c.sections.map((section, i) => (
          <section key={i} className="py-12 border-b border-border">
            <h2 className="text-2xl font-display font-semibold text-foreground mb-4">
              {section.title}
            </h2>
            <p className="text-muted-foreground mb-5">{section.body}</p>
            {section.items && (
              <ul className="space-y-3">
                {section.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-foreground">
                    <span className="text-primary mt-0.5 flex-shrink-0">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* ── FAQ ── */}
        <section className="py-12 border-b border-border">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-8">FAQ</h2>
          <div className="space-y-3">
            {c.faq.map((item, i) => (
              <details
                key={i}
                className="group border border-border rounded-lg bg-card overflow-hidden"
              >
                <summary className="flex justify-between items-center gap-4 px-5 py-4 cursor-pointer text-sm font-medium text-foreground list-none select-none hover:bg-accent/30 transition-colors">
                  {item.q}
                  <span className="text-muted-foreground flex-shrink-0 text-xs">▾</span>
                </summary>
                <p className="px-5 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Cross-link ── */}
        <div className="mb-2 text-sm text-muted-foreground">
          <Link
            href={`/${locale}/grupos`}
            className="underline hover:text-foreground transition-colors"
          >
            {locale === 'pt'
              ? '🎒 Viajando em grupo? Veja nossos descontos para grupos'
              : locale === 'en'
                ? '🎒 Traveling with a group? See our group discounts'
                : locale === 'es'
                  ? '🎒 ¿Viajando en grupo? Descubre nuestros descuentos para grupos'
                  : locale === 'de'
                    ? '🎒 Als Gruppe unterwegs? Gruppenrabatte entdecken'
                    : locale === 'it'
                      ? '🎒 Viaggi in gruppo? Scopri i nostri sconti per gruppi'
                      : '🎒 En voyage de groupe ? Découvrez nos remises de groupe'}
          </Link>
        </div>

        {/* ── CTA ── */}
        <section className="py-12">
          <div className="bg-card border border-border rounded-xl p-8">
            <h2 className="text-2xl font-display font-semibold text-foreground mb-3">
              {c.ctaTitle}
            </h2>
            <p className="text-muted-foreground mb-6">{c.ctaBody}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/hostel`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                📅 {c.ctaBtn}
              </Link>
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5521977157530'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors"
              >
                💬 {c.ctaWa}
              </a>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter locale={locale} />
    </main>
  );
}
