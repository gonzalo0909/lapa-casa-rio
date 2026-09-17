// lapa-casa-hostel/frontend/src/app/[locale]/grupos/page.tsx
// Long-tail SEO + AEO page: group travel in Rio de Janeiro
// Target keywords: "hostel grupos rio de janeiro", "viagem em grupo rio", "hospedagem grupos desconto"

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { StructuredData, HOSTEL_GEO } from '@/components/seo/structured-data';
import { locales, defaultLocale, type Locale } from '@/i18n';
import { SiteFooter } from '@/components/layout/site-footer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

// ─── Per-locale metadata ───────────────────────────────────────────────────────
const META: Record<Locale, { title: string; description: string }> = {
  pt: {
    title: 'Hospedagem para Grupos em Rio de Janeiro | Lapa Casa Rio',
    description:
      'Viagem em grupo para o Rio? Reserve seu grupo no Lapa Casa Rio em Santa Teresa. Desconto especial para grupos, quartos privativos e dormitórios, check-in flexível.',
  },
  en: {
    title: 'Group Accommodation in Rio de Janeiro | Lapa Casa Rio',
    description:
      'Planning a group trip to Rio de Janeiro? Lapa Casa Rio offers group discounts, private rooms and dorms in Santa Teresa. Book directly and save.',
  },
  es: {
    title: 'Alojamiento para Grupos en Río de Janeiro | Lapa Casa Rio',
    description:
      'Viaje en grupo a Río de Janeiro? Lapa Casa Rio ofrece descuentos para grupos, habitaciones privadas y dormitorios en Santa Teresa. Reserva directa.',
  },
  de: {
    title: 'Gruppenunterkunft in Rio de Janeiro | Lapa Casa Rio',
    description:
      'Gruppenreise nach Rio de Janeiro? Lapa Casa Rio in Santa Teresa bietet Gruppenrabatte, Privatzimmer und Schlafsäle. Direkt buchen und sparen.',
  },
  fr: {
    title: 'Hébergement de Groupe à Rio de Janeiro | Lapa Casa Rio',
    description:
      'Voyage en groupe à Rio de Janeiro? Lapa Casa Rio offre des réductions de groupe, des chambres privées et des dortoirs à Santa Teresa. Réservez directement.',
  },
  it: {
    title: 'Alloggio per Gruppi a Rio de Janeiro | Lapa Casa Rio',
    description:
      'Viaggio di gruppo a Rio de Janeiro? Il Lapa Casa Rio a Santa Teresa offre sconti per gruppi, camere private e dormitori. Prenota direttamente e risparmia.',
  },
};

// ─── Full content per locale ───────────────────────────────────────────────────
interface Section {
  heading: string;
  body: string;
  bullets?: string[];
}
interface FAQ {
  question: string;
  answer: string;
}
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

const CONTENT: Record<Locale, Content> = {
  pt: {
    headline: 'Viagem em Grupo para o Rio de Janeiro',
    intro:
      'Planejar uma viagem em grupo para o Rio de Janeiro pode ser desafiador — encontrar acomodação que caiba no orçamento de todos, no mesmo lugar, com espaço de convivência. No Lapa Casa Rio, em Santa Teresa, pensamos nisso para você.',
    sections: [
      {
        heading: 'Desconto Especial para Grupos',
        body: 'Grupos de 6 ou mais pessoas têm acesso a condições especiais no Lapa Casa:',
        bullets: [
          '10% de desconto para grupos de 6 a 9 pessoas',
          '15% de desconto para grupos de 10 ou mais pessoas',
          'Cotação personalizada para grupos acima de 20 pessoas',
          'Possibilidade de reservar dormitório inteiro com exclusividade',
          'Reserva de apartamento privativo para o grupo',
        ],
      },
      {
        heading: 'Por que Santa Teresa?',
        body: 'Santa Teresa é o bairro mais charmoso e bohêmio do Rio. Para grupos de viajantes que buscam autenticidade, é a escolha certa:',
        bullets: [
          'A 10 minutos de bonde (VLT) do Centro do Rio',
          'Perto do Museu do Amanhã, AquaRio e Lapa (vida noturna)',
          'Seguro, tranquilo e com excelente gastronomia local',
          'Vista panorâmica para a Baía de Guanabara e o centro histórico',
          'Cultura e arte em cada esquina — ateliers, galerias, feira de artesanato',
        ],
      },
      {
        heading: 'Opções de Acomodação para Grupos',
        body: 'Temos diferentes formatos para atender seu grupo:',
        bullets: [
          'Dormitórios mistos (7 a 12 camas) — opção econômica para grupos menores',
          'Dormitório feminino — para grupos só de mulheres',
          'Quartos privativos — para casais ou sub-grupos que preferem privacidade',
          'Apartamentos independentes — para grupos que querem cozinha e sala próprias',
          'Combinações mistas (dorm + privativo) para grupos com preferências diferentes',
        ],
      },
      {
        heading: 'Como Reservar para um Grupo',
        body: 'O processo é simples e direto — não precisa de intermediários:',
        bullets: [
          '1. Fale com a gente pelo WhatsApp com datas, número de pessoas e tipo de quarto',
          '2. Receba uma cotação personalizada em até 2 horas',
          '3. Confirme com sinal de 30% via PIX ou cartão',
          '4. O saldo é pago na chegada — aceitamos PIX, cartão débito/crédito',
          '5. Check-in flexível para grupos — avisando com antecedência',
        ],
      },
      {
        heading: 'O Que Está Incluído',
        body: 'Para todos os hóspedes, independente do tipo de acomodação:',
        bullets: [
          'Wi-Fi de alta velocidade em todo o hostel',
          'Cozinha compartilhada equipada (geladeira, fogão, micro-ondas)',
          'Área de convivência ampla — perfeita para o grupo se reunir',
          'Armários individuais com cadeado',
          'Dicas de passeios e restaurantes para grupos',
          'Suporte em português, inglês, espanhol e francês',
        ],
      },
    ],
    faq: [
      {
        question: 'Qual o tamanho mínimo de grupo para ter desconto?',
        answer:
          'A partir de 6 pessoas você já tem direito a 10% de desconto na reserva direta. Para grupos de 10 ou mais, o desconto sobe para 15%. Grupos acima de 20 pessoas recebem uma cotação personalizada.',
      },
      {
        question: 'Posso reservar o dormitório inteiro para meu grupo?',
        answer:
          'Sim! É possível reservar o dormitório inteiro com exclusividade para seu grupo. Isso garante privacidade e é mais econômico que alugar quartos privativos para todos. Entre em contato pelo WhatsApp para verificar disponibilidade.',
      },
      {
        question: 'Quais formas de pagamento são aceitas para grupos?',
        answer:
          'Aceitamos PIX (com desconto adicional), cartão de crédito (até 6x sem juros) e cartão de débito. Para grupos, pedimos um sinal de 30% na confirmação e o saldo na chegada. Emitimos nota fiscal.',
      },
      {
        question: 'É possível fazer check-in em horários diferentes para um grupo?',
        answer:
          'Sim, entendemos que grupos viajam juntos mas chegam em horários diferentes. Basta nos avisar com antecedência e guardamos as bagagens com segurança até que todos possam fazer o check-in oficial.',
      },
      {
        question: 'O hostel tem espaço para reuniões ou jantares de grupo?',
        answer:
          'Temos uma área de convivência ampla e varanda com vista. Para grupos maiores (15+ pessoas) com necessidade de espaço exclusivo para evento ou reunião, consulte disponibilidade e condições pelo WhatsApp.',
      },
    ],
    ctaTitle: 'Monte seu Grupo e Reserve Agora',
    ctaBody:
      'Entre em contato pelo WhatsApp para receber uma cotação personalizada para seu grupo. Respondemos em até 2 horas!',
    ctaBtn: 'Ver Opções de Quartos',
    ctaWa: 'Quero cotar para o meu grupo',
  },

  en: {
    headline: 'Group Trips to Rio de Janeiro',
    intro:
      "Organizing a group trip to Rio de Janeiro? Finding accommodation that fits everyone's budget, in the same place, with common areas to hang out can be tricky. At Lapa Casa Rio in Santa Teresa, we've thought it all through.",
    sections: [
      {
        heading: 'Special Group Discounts',
        body: 'Groups of 6 or more people get special rates at Lapa Casa:',
        bullets: [
          '10% discount for groups of 6 to 9 people',
          '15% discount for groups of 10 or more people',
          'Custom quote for groups of 20 or more',
          'Option to book an entire dorm exclusively for your group',
          'Private apartment rentals also available',
        ],
      },
      {
        heading: 'Why Santa Teresa?',
        body: "Santa Teresa is Rio's most charming and bohemian neighborhood — the perfect base for a group:",
        bullets: [
          '10 minutes by tram to downtown Rio',
          'Close to Museum of Tomorrow, AquaRio, and Lapa nightlife',
          'Safe, calm, with excellent local food scene',
          'Panoramic views of Guanabara Bay and the historic city center',
          'Art, culture, ateliers, and galleries around every corner',
        ],
      },
      {
        heading: 'Accommodation Options for Groups',
        body: "We offer flexible setups to fit your group's needs:",
        bullets: [
          'Mixed dorms (7–12 beds) — budget-friendly for smaller groups',
          'Female-only dorm — for women-only groups',
          'Private rooms — for couples or sub-groups wanting privacy',
          'Independent apartments — with kitchen and living area',
          'Mixed combos (dorm + private) for groups with different preferences',
        ],
      },
      {
        heading: 'How to Book as a Group',
        body: 'Simple, direct, no middlemen:',
        bullets: [
          '1. WhatsApp us with your dates, headcount, and room preferences',
          '2. Receive a custom quote within 2 hours',
          '3. Confirm with a 30% deposit via PIX or card',
          '4. Balance paid on arrival — PIX, debit, or credit card accepted',
          '5. Flexible check-in for groups — just let us know in advance',
        ],
      },
      {
        heading: "What's Included",
        body: 'For all guests, regardless of accommodation type:',
        bullets: [
          'High-speed Wi-Fi throughout the hostel',
          'Fully equipped shared kitchen (fridge, stove, microwave)',
          'Spacious common area — perfect for the group to gather',
          'Individual lockers with padlocks',
          'Local tips for group tours and restaurants',
          'Support in Portuguese, English, Spanish, and French',
        ],
      },
    ],
    faq: [
      {
        question: 'What is the minimum group size to get a discount?',
        answer:
          'Groups of 6 or more qualify for a 10% discount on direct bookings. Groups of 10 or more get 15% off. Groups of 20+ receive a custom quote.',
      },
      {
        question: 'Can I book an entire dorm exclusively for my group?',
        answer:
          'Yes! You can book an entire dorm exclusively for your group. This ensures privacy and is more cost-effective than booking private rooms for everyone. Contact us on WhatsApp to check availability.',
      },
      {
        question: 'What payment methods do you accept for groups?',
        answer:
          'We accept PIX (with an extra discount), credit card (up to 6 installments interest-free), and debit card. For groups, we require a 30% deposit upon confirmation and the balance on arrival. We issue invoices.',
      },
      {
        question: 'Can different members of the group check in at different times?',
        answer:
          "Absolutely. We understand groups travel together but may arrive at different times. Just let us know in advance and we'll securely store luggage until everyone can officially check in.",
      },
      {
        question: 'Is there space for group meetings or dinners?',
        answer:
          'We have a spacious common area and a terrace with a view. For larger groups (15+) needing exclusive event or meeting space, contact us on WhatsApp for availability and conditions.',
      },
    ],
    ctaTitle: 'Gather Your Group and Book Now',
    ctaBody:
      'Contact us on WhatsApp to receive a personalized quote for your group. We reply within 2 hours!',
    ctaBtn: 'View Room Options',
    ctaWa: 'I want a quote for my group',
  },

  es: {
    headline: 'Viaje en Grupo a Río de Janeiro',
    intro:
      'Organizar un viaje en grupo a Río de Janeiro puede ser todo un reto: encontrar alojamiento que se adapte al presupuesto de todos, en el mismo lugar, con espacios para compartir. En Lapa Casa Rio, en Santa Teresa, lo tenemos todo pensado.',
    sections: [
      {
        heading: 'Descuentos Especiales para Grupos',
        body: 'Los grupos de 6 o más personas tienen condiciones especiales en Lapa Casa:',
        bullets: [
          '10% de descuento para grupos de 6 a 9 personas',
          '15% de descuento para grupos de 10 o más personas',
          'Presupuesto personalizado para grupos de más de 20 personas',
          'Posibilidad de reservar el dormitorio completo de forma exclusiva',
          'Apartamentos privados también disponibles',
        ],
      },
      {
        heading: '¿Por qué Santa Teresa?',
        body: 'Santa Teresa es el barrio más bohemio y encantador de Río — la base perfecta para un grupo:',
        bullets: [
          'A 10 minutos en tranvía del centro de Río',
          'Cerca del Museo del Mañana, AquaRio y Lapa (vida nocturna)',
          'Seguro, tranquilo y con excelente gastronomía local',
          'Vistas panorámicas a la Bahía de Guanabara y el centro histórico',
          'Arte, cultura, talleres y galerías en cada esquina',
        ],
      },
      {
        heading: 'Opciones de Alojamiento para Grupos',
        body: 'Tenemos diferentes formatos para adaptarnos a tu grupo:',
        bullets: [
          'Dormitorios mixtos (7-12 camas) — opción económica para grupos pequeños',
          'Dormitorio solo para mujeres — para grupos femeninos',
          'Habitaciones privadas — para parejas o subgrupos que prefieren privacidad',
          'Apartamentos independientes — con cocina y sala propia',
          'Combinaciones mixtas (dorm + privado) para grupos con distintas preferencias',
        ],
      },
      {
        heading: 'Cómo Reservar como Grupo',
        body: 'El proceso es simple y directo — sin intermediarios:',
        bullets: [
          '1. Escríbenos por WhatsApp con fechas, número de personas y tipo de habitación',
          '2. Recibe un presupuesto personalizado en menos de 2 horas',
          '3. Confirma con un depósito del 30% por PIX o tarjeta',
          '4. El saldo se paga a la llegada — PIX, débito o crédito',
          '5. Check-in flexible para grupos — avisando con antelación',
        ],
      },
      {
        heading: 'Qué Está Incluido',
        body: 'Para todos los huéspedes, independientemente del tipo de alojamiento:',
        bullets: [
          'Wi-Fi de alta velocidad en todo el hostel',
          'Cocina compartida totalmente equipada (nevera, cocina, microondas)',
          'Área común amplia — perfecta para que el grupo se reúna',
          'Taquillas individuales con candado',
          'Recomendaciones de tours y restaurantes para grupos',
          'Atención en portugués, inglés, español y francés',
        ],
      },
    ],
    faq: [
      {
        question: '¿Cuál es el tamaño mínimo de grupo para obtener descuento?',
        answer:
          'A partir de 6 personas ya tienes derecho a un 10% de descuento en reserva directa. Para grupos de 10 o más, el descuento sube al 15%. Los grupos de más de 20 personas reciben un presupuesto personalizado.',
      },
      {
        question: '¿Puedo reservar el dormitorio completo para mi grupo?',
        answer:
          'Sí. Puedes reservar el dormitorio entero de forma exclusiva para tu grupo. Esto garantiza privacidad y es más económico que reservar habitaciones privadas para todos. Consulta disponibilidad por WhatsApp.',
      },
      {
        question: '¿Qué formas de pago aceptan para grupos?',
        answer:
          'Aceptamos PIX (con descuento adicional), tarjeta de crédito (hasta 6 cuotas sin interés) y tarjeta de débito. Para grupos pedimos un depósito del 30% al confirmar y el saldo a la llegada. Emitimos facturas.',
      },
      {
        question: '¿Pueden los miembros del grupo hacer check-in en horarios distintos?',
        answer:
          'Por supuesto. Entendemos que los grupos viajan juntos pero pueden llegar en momentos distintos. Solo avísanos con antelación y guardamos el equipaje con seguridad hasta que todos puedan hacer el check-in oficial.',
      },
      {
        question: '¿Hay espacio para reuniones o cenas de grupo?',
        answer:
          'Tenemos un amplio espacio común y una terraza con vistas. Para grupos más grandes (15+ personas) que necesiten un espacio exclusivo para evento o reunión, consulta disponibilidad y condiciones por WhatsApp.',
      },
    ],
    ctaTitle: 'Organiza tu Grupo y Reserva Ya',
    ctaBody:
      'Contáctanos por WhatsApp para recibir un presupuesto personalizado para tu grupo. ¡Respondemos en menos de 2 horas!',
    ctaBtn: 'Ver Opciones de Habitaciones',
    ctaWa: 'Quiero una cotización para mi grupo',
  },

  de: {
    headline: 'Gruppenreise nach Rio de Janeiro',
    intro:
      'Eine Gruppenreise nach Rio de Janeiro zu planen kann herausfordernd sein: eine Unterkunft finden, die zum Budget aller passt, am selben Ort, mit Gemeinschaftsbereichen zum Zusammensein. Im Lapa Casa Rio in Santa Teresa haben wir genau daran gedacht.',
    sections: [
      {
        heading: 'Spezielle Gruppenrabatte',
        body: 'Gruppen ab 6 Personen erhalten besondere Konditionen bei Lapa Casa:',
        bullets: [
          '10% Rabatt für Gruppen von 6 bis 9 Personen',
          '15% Rabatt für Gruppen ab 10 Personen',
          'Individuelles Angebot für Gruppen über 20 Personen',
          'Möglichkeit, ein ganzes Schlafsaal exklusiv zu buchen',
          'Private Apartments ebenfalls verfügbar',
        ],
      },
      {
        heading: 'Warum Santa Teresa?',
        body: 'Santa Teresa ist Rios charmantestes und bohemistisches Viertel — die perfekte Basis für eine Gruppe:',
        bullets: [
          '10 Minuten per Straßenbahn ins Stadtzentrum',
          'In der Nähe des Museums der Zukunft, AquaRio und Lapa (Nachtleben)',
          'Sicher, ruhig, mit hervorragender lokaler Gastronomie',
          'Panoramablick auf die Guanabara-Bucht und die historische Innenstadt',
          'Kunst, Kultur, Ateliers und Galerien an jeder Ecke',
        ],
      },
      {
        heading: 'Unterkunftsoptionen für Gruppen',
        body: 'Wir bieten verschiedene Formate für Ihre Gruppe:',
        bullets: [
          'Gemischte Schlafsäle (7–12 Betten) — günstig für kleinere Gruppen',
          'Nur-für-Frauen-Schlafsaal — für reine Frauengruppen',
          'Privatzimmer — für Paare oder Untergruppen, die Privatsphäre wünschen',
          'Unabhängige Apartments — mit Küche und Wohnbereich',
          'Gemischte Kombinationen (Schlafsaal + Privat) für Gruppen mit unterschiedlichen Wünschen',
        ],
      },
      {
        heading: 'So Buchen Sie als Gruppe',
        body: 'Einfach und direkt — ohne Zwischenhändler:',
        bullets: [
          '1. Schreiben Sie uns auf WhatsApp mit Daten, Personenzahl und Zimmerwunsch',
          '2. Erhalten Sie ein individuelles Angebot innerhalb von 2 Stunden',
          '3. Bestätigen mit 30% Anzahlung per PIX oder Karte',
          '4. Restbetrag bei Ankunft — PIX, Debit- oder Kreditkarte akzeptiert',
          '5. Flexibler Check-in für Gruppen — einfach im Voraus informieren',
        ],
      },
      {
        heading: 'Was Inbegriffen Ist',
        body: 'Für alle Gäste, unabhängig von der Unterkunftsart:',
        bullets: [
          'Schnelles WLAN im gesamten Hostel',
          'Voll ausgestattete Gemeinschaftsküche (Kühlschrank, Herd, Mikrowelle)',
          'Großzügiger Gemeinschaftsbereich — ideal für das Treffen der Gruppe',
          'Individuelle Schließfächer mit Schloss',
          'Tipps für Gruppentouren und Restaurants',
          'Unterstützung auf Portugiesisch, Englisch, Spanisch und Französisch',
        ],
      },
    ],
    faq: [
      {
        question: 'Wie groß muss die Gruppe mindestens sein, um einen Rabatt zu erhalten?',
        answer:
          'Ab 6 Personen erhalten Sie 10% Rabatt bei Direktbuchung. Gruppen ab 10 Personen bekommen 15%. Gruppen über 20 Personen erhalten ein individuelles Angebot.',
      },
      {
        question: 'Kann ich einen ganzen Schlafsaal exklusiv für meine Gruppe buchen?',
        answer:
          'Ja! Es ist möglich, einen gesamten Schlafsaal exklusiv für Ihre Gruppe zu buchen. Das garantiert Privatsphäre und ist günstiger als Privatzimmer für alle. Fragen Sie auf WhatsApp nach der Verfügbarkeit.',
      },
      {
        question: 'Welche Zahlungsmethoden werden für Gruppen akzeptiert?',
        answer:
          'Wir akzeptieren PIX (mit zusätzlichem Rabatt), Kreditkarte (bis zu 6 zinsfreie Raten) und Debitkarte. Für Gruppen verlangen wir eine 30%-Anzahlung bei Bestätigung, der Rest wird bei Ankunft bezahlt. Wir stellen Rechnungen aus.',
      },
      {
        question: 'Können Gruppenmitglieder zu verschiedenen Zeiten einchecken?',
        answer:
          'Absolut. Wir verstehen, dass Gruppen zusammen reisen, aber zu verschiedenen Zeiten ankommen können. Informieren Sie uns einfach im Voraus und wir verwahren das Gepäck sicher, bis alle offiziell einchecken können.',
      },
      {
        question: 'Gibt es Platz für Gruppentreffen oder -abendessen?',
        answer:
          'Wir haben einen großzügigen Gemeinschaftsbereich und eine Terrasse mit Ausblick. Für größere Gruppen (15+) die einen exklusiven Veranstaltungs- oder Besprechungsraum benötigen, fragen Sie auf WhatsApp nach Verfügbarkeit und Konditionen.',
      },
    ],
    ctaTitle: 'Buchen Sie Jetzt als Gruppe',
    ctaBody:
      'Kontaktieren Sie uns auf WhatsApp für ein individuelles Angebot für Ihre Gruppe. Wir antworten innerhalb von 2 Stunden!',
    ctaBtn: 'Zimmeroptionen Ansehen',
    ctaWa: 'Ich möchte ein Angebot für meine Gruppe',
  },

  fr: {
    headline: 'Voyage en Groupe à Rio de Janeiro',
    intro:
      'Organiser un voyage en groupe à Rio de Janeiro peut être un vrai défi : trouver un hébergement qui convient au budget de tous, au même endroit, avec des espaces communs pour se retrouver. Au Lapa Casa Rio, à Santa Teresa, nous avons tout prévu.',
    sections: [
      {
        heading: 'Réductions Spéciales pour les Groupes',
        body: 'Les groupes de 6 personnes ou plus bénéficient de conditions spéciales au Lapa Casa :',
        bullets: [
          '10% de réduction pour les groupes de 6 à 9 personnes',
          '15% de réduction pour les groupes de 10 personnes ou plus',
          'Devis personnalisé pour les groupes de plus de 20 personnes',
          'Possibilité de réserver un dortoir entier en exclusivité pour votre groupe',
          'Appartements privés également disponibles',
        ],
      },
      {
        heading: 'Pourquoi Santa Teresa ?',
        body: 'Santa Teresa est le quartier le plus bohème et charmant de Rio — la base idéale pour un groupe :',
        bullets: [
          'À 10 minutes en tram du centre-ville de Rio',
          'Près du Musée de Demain, AquaRio et Lapa (vie nocturne)',
          'Sûr, calme, avec une excellente scène gastronomique locale',
          'Vues panoramiques sur la baie de Guanabara et le centre historique',
          'Art, culture, ateliers et galeries à chaque coin de rue',
        ],
      },
      {
        heading: "Options d'Hébergement pour les Groupes",
        body: 'Nous proposons différentes formules pour répondre aux besoins de votre groupe :',
        bullets: [
          'Dortoirs mixtes (7 à 12 lits) — option économique pour les petits groupes',
          'Dortoir réservé aux femmes — pour les groupes féminins',
          "Chambres privées — pour les couples ou sous-groupes souhaitant plus d'intimité",
          'Appartements indépendants — avec cuisine et salon',
          'Combinaisons mixtes (dortoir + privé) pour des groupes aux préférences variées',
        ],
      },
      {
        heading: 'Comment Réserver en Groupe',
        body: 'Simple, direct, sans intermédiaire :',
        bullets: [
          '1. Contactez-nous sur WhatsApp avec vos dates, nombre de personnes et préférences',
          '2. Recevez un devis personnalisé en moins de 2 heures',
          '3. Confirmez avec un acompte de 30% par PIX ou carte',
          "4. Le solde est payé à l'arrivée — PIX, débit ou crédit acceptés",
          "5. Check-in flexible pour les groupes — prévenez-nous à l'avance",
        ],
      },
      {
        heading: 'Ce Qui Est Inclus',
        body: "Pour tous les clients, quel que soit le type d'hébergement :",
        bullets: [
          "Wi-Fi haut débit dans tout l'hostel",
          'Cuisine commune entièrement équipée (réfrigérateur, cuisinière, micro-ondes)',
          'Grand espace commun — parfait pour rassembler le groupe',
          'Casiers individuels avec cadenas',
          'Recommandations de visites et restaurants pour groupes',
          'Assistance en portugais, anglais, espagnol et français',
        ],
      },
    ],
    faq: [
      {
        question: "Quelle est la taille minimale du groupe pour bénéficier d'une réduction ?",
        answer:
          'À partir de 6 personnes, vous bénéficiez de 10% de réduction sur la réservation directe. Pour les groupes de 10 personnes ou plus, la réduction monte à 15%. Les groupes de plus de 20 personnes reçoivent un devis personnalisé.',
      },
      {
        question: 'Puis-je réserver un dortoir entier exclusivement pour mon groupe ?',
        answer:
          "Oui ! Il est possible de réserver un dortoir entier en exclusivité pour votre groupe. Cela garantit l'intimité et est plus économique que de réserver des chambres privées pour tous. Contactez-nous sur WhatsApp pour vérifier la disponibilité.",
      },
      {
        question: 'Quels modes de paiement sont acceptés pour les groupes ?',
        answer:
          "Nous acceptons PIX (avec une réduction supplémentaire), carte de crédit (jusqu'à 6 versements sans intérêt) et carte de débit. Pour les groupes, nous demandons un acompte de 30% à la confirmation et le solde à l'arrivée. Nous émettons des factures.",
      },
      {
        question: "Les membres du groupe peuvent-ils s'enregistrer à des horaires différents ?",
        answer:
          "Absolument. Nous comprenons que les groupes voyagent ensemble mais peuvent arriver à des moments différents. Prévenez-nous simplement à l'avance et nous gardons les bagages en sécurité jusqu'à ce que tout le monde puisse s'enregistrer officiellement.",
      },
      {
        question: "Y a-t-il de l'espace pour des réunions ou dîners de groupe ?",
        answer:
          "Nous disposons d'un grand espace commun et d'une terrasse avec vue. Pour les groupes plus importants (15+ personnes) ayant besoin d'un espace exclusif pour un événement ou une réunion, consultez la disponibilité et les conditions sur WhatsApp.",
      },
    ],
    ctaTitle: 'Rassemblez Votre Groupe et Réservez Maintenant',
    ctaBody:
      'Contactez-nous sur WhatsApp pour recevoir un devis personnalisé pour votre groupe. Nous répondons en moins de 2 heures !',
    ctaBtn: 'Voir les Options de Chambres',
    ctaWa: 'Je veux un devis pour mon groupe',
  },

  it: {
    headline: 'Viaggio di Gruppo a Rio de Janeiro',
    intro:
      'Organizzare un viaggio di gruppo a Rio de Janeiro può essere impegnativo — trovare un alloggio che rientri nel budget di tutti, nello stesso posto, con spazi comuni per stare insieme. Al Lapa Casa Rio, a Santa Teresa, ci abbiamo pensato noi.',
    sections: [
      {
        heading: 'Sconto Speciale per Gruppi',
        body: 'I gruppi di 6 o più persone hanno accesso a condizioni speciali al Lapa Casa:',
        bullets: [
          '10% di sconto per gruppi da 6 a 9 persone',
          '15% di sconto per gruppi di 10 o più persone',
          'Preventivo personalizzato per gruppi oltre le 20 persone',
          'Possibilità di prenotare un dormitorio intero in esclusiva',
          'Prenotazione di appartamento privato per il gruppo',
        ],
      },
      {
        heading: 'Perché Santa Teresa?',
        body: 'Santa Teresa è il quartiere più affascinante e bohémien di Rio. Per gruppi di viaggiatori in cerca di autenticità, è la scelta giusta:',
        bullets: [
          'A 10 minuti di tram (VLT) dal centro di Rio',
          'Vicino al Museo del Domani, AquaRio e Lapa (vita notturna)',
          "Sicuro, tranquillo e con un'ottima gastronomia locale",
          'Vista panoramica sulla Baia di Guanabara e il centro storico',
          'Cultura e arte a ogni angolo — atelier, gallerie, mercato artigianale',
        ],
      },
      {
        heading: 'Opzioni di Alloggio per Gruppi',
        body: 'Abbiamo diverse soluzioni per il tuo gruppo:',
        bullets: [
          'Dormitori misti (da 7 a 12 letti) — opzione economica per gruppi più piccoli',
          'Dormitorio femminile — per gruppi di sole donne',
          'Camere private — per coppie o sottogruppi che preferiscono la privacy',
          'Appartamenti indipendenti — per gruppi che vogliono cucina e soggiorno propri',
          'Combinazioni miste (dormitorio + privato) per gruppi con esigenze diverse',
        ],
      },
      {
        heading: 'Come Prenotare per un Gruppo',
        body: 'Il processo è semplice e diretto — senza intermediari:',
        bullets: [
          '1. Scrivici su WhatsApp con le date, il numero di persone e il tipo di camera',
          '2. Ricevi un preventivo personalizzato entro 2 ore',
          '3. Conferma con una caparra del 30% via PIX o carta',
          "4. Il saldo si paga all'arrivo — accettiamo PIX, carta di debito/credito",
          '5. Check-in flessibile per gruppi — avvisando in anticipo',
        ],
      },
      {
        heading: 'Cosa È Incluso',
        body: 'Per tutti gli ospiti, indipendentemente dal tipo di alloggio:',
        bullets: [
          "Wi-Fi ad alta velocità in tutto l'hostel",
          'Cucina condivisa attrezzata (frigorifero, fornelli, microonde)',
          'Ampio spazio comune — perfetto per riunire il gruppo',
          'Armadietti individuali con lucchetto',
          'Consigli su escursioni e ristoranti per gruppi',
          'Assistenza in portoghese, inglese, spagnolo e francese',
        ],
      },
    ],
    faq: [
      {
        question: 'Qual è la dimensione minima del gruppo per avere lo sconto?',
        answer:
          'A partire da 6 persone hai già diritto al 10% di sconto sulla prenotazione diretta. Per gruppi di 10 o più persone, lo sconto sale al 15%. I gruppi oltre le 20 persone ricevono un preventivo personalizzato.',
      },
      {
        question: 'Posso prenotare il dormitorio intero per il mio gruppo?',
        answer:
          'Sì! È possibile prenotare il dormitorio intero in esclusiva per il tuo gruppo. Questo garantisce privacy ed è più economico che affittare camere private per tutti. Contattaci su WhatsApp per verificare la disponibilità.',
      },
      {
        question: 'Quali metodi di pagamento sono accettati per i gruppi?',
        answer:
          "Accettiamo PIX (con sconto aggiuntivo), carta di credito (fino a 6 rate senza interessi) e carta di debito. Per i gruppi chiediamo una caparra del 30% alla conferma e il saldo all'arrivo. Emettiamo fattura.",
      },
      {
        question: 'È possibile fare il check-in in orari diversi per un gruppo?',
        answer:
          'Sì, sappiamo che i gruppi viaggiano insieme ma arrivano in orari diversi. Basta avvisarci in anticipo e conserviamo i bagagli in sicurezza finché tutti non possono completare il check-in ufficiale.',
      },
      {
        question: "L'hostel ha uno spazio per riunioni o cene di gruppo?",
        answer:
          'Abbiamo un ampio spazio comune e una terrazza panoramica. Per gruppi più numerosi (15+ persone) che necessitano di uno spazio esclusivo per un evento o una riunione, verifica disponibilità e condizioni su WhatsApp.',
      },
    ],
    ctaTitle: 'Organizza il tuo Gruppo e Prenota Ora',
    ctaBody:
      'Contattaci su WhatsApp per ricevere un preventivo personalizzato per il tuo gruppo. Rispondiamo entro 2 ore!',
    ctaBtn: 'Vedi le Opzioni di Camere',
    ctaWa: 'Vorrei un preventivo per il mio gruppo',
  },
};

// ─── JSON-LD schemas ────────────────────────────────────────────────────────────
function buildGroupLodgingSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: 'Lapa Casa Rio',
    description:
      'Hostel boutique in Santa Teresa, Rio de Janeiro offering group accommodations with discounts for 6+ people.',
    url: `${SITE_URL}/grupos`,
    image: `${SITE_URL}/og-image.jpg`,
    telephone: '+55-21-97715-7530',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Rua Silvio Romero 22',
      addressLocality: 'Santa Teresa',
      addressRegion: 'RJ',
      postalCode: '20241-120',
      addressCountry: 'BR',
    },
    geo: HOSTEL_GEO,
    priceRange: 'R$ 60-100',
    specialOffer: [
      {
        '@type': 'Offer',
        name: 'Desconto para grupos de 6-9 pessoas / Group discount 6–9 people',
        description: '10% discount for groups of 6 to 9 people on direct booking',
        eligibleQuantity: {
          '@type': 'QuantitativeValue',
          minValue: 6,
          maxValue: 9,
          unitText: 'people',
        },
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          priceCurrency: 'BRL',
          referenceQuantity: {
            '@type': 'QuantitativeValue',
            value: 1,
            unitText: 'night',
          },
        },
      },
      {
        '@type': 'Offer',
        name: 'Desconto para grupos de 10+ pessoas / Group discount 10+ people',
        description: '15% discount for groups of 10 or more people on direct booking',
        eligibleQuantity: {
          '@type': 'QuantitativeValue',
          minValue: 10,
          unitText: 'people',
        },
      },
    ],
  };
}

function buildGroupHowToSchema(locale: Locale) {
  const steps: Record<Locale, string[]> = {
    pt: [
      'Entre em contato pelo WhatsApp com suas datas e número de pessoas',
      'Receba a cotação personalizada em até 2 horas',
      'Confirme a reserva com sinal de 30%',
      'O saldo é pago na chegada em PIX ou cartão',
      'Aproveite seu grupo em Santa Teresa, Rio de Janeiro',
    ],
    en: [
      'Contact us on WhatsApp with your dates and headcount',
      'Receive a custom quote within 2 hours',
      'Confirm the booking with a 30% deposit',
      'Pay the balance on arrival by PIX or card',
      'Enjoy your group stay in Santa Teresa, Rio de Janeiro',
    ],
    es: [
      'Contáctanos por WhatsApp con tus fechas y número de personas',
      'Recibe el presupuesto personalizado en menos de 2 horas',
      'Confirma la reserva con un depósito del 30%',
      'El saldo se paga a la llegada por PIX o tarjeta',
      'Disfruta de tu viaje en grupo en Santa Teresa, Río de Janeiro',
    ],
    de: [
      'Schreiben Sie uns auf WhatsApp mit Daten und Personenzahl',
      'Erhalten Sie ein individuelles Angebot innerhalb von 2 Stunden',
      'Bestätigen Sie die Buchung mit 30% Anzahlung',
      'Restbetrag wird bei Ankunft per PIX oder Karte bezahlt',
      'Genießen Sie Ihren Gruppenaufenthalt in Santa Teresa, Rio de Janeiro',
    ],
    fr: [
      'Contactez-nous sur WhatsApp avec vos dates et nombre de personnes',
      'Recevez un devis personnalisé en moins de 2 heures',
      'Confirmez la réservation avec un acompte de 30%',
      "Le solde est payé à l'arrivée par PIX ou carte",
      'Profitez de votre séjour de groupe à Santa Teresa, Rio de Janeiro',
    ],
    it: [
      'Scrivici su WhatsApp con le tue date e il numero di persone',
      'Ricevi il preventivo personalizzato entro 2 ore',
      'Conferma la prenotazione con una caparra del 30%',
      "Il saldo si paga all'arrivo via PIX o carta",
      'Goditi il tuo soggiorno di gruppo a Santa Teresa, Rio de Janeiro',
    ],
  };
  const names: Record<Locale, string> = {
    pt: 'Como Reservar para um Grupo no Lapa Casa Rio',
    en: 'How to Book a Group Stay at Lapa Casa Rio',
    es: 'Cómo Reservar como Grupo en Lapa Casa Rio',
    de: 'So Buchen Sie Ihren Gruppenaufenthalt im Lapa Casa Rio',
    fr: 'Comment Réserver en Groupe au Lapa Casa Rio',
    it: 'Come Prenotare per un Gruppo al Lapa Casa Rio',
  };
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: names[locale]!,
    description:
      locale === 'pt'
        ? 'Passo a passo para reservar seu grupo no Lapa Casa Rio em Santa Teresa, Rio de Janeiro'
        : locale === 'en'
          ? 'Step-by-step guide to booking your group stay at Lapa Casa Rio in Santa Teresa, Rio de Janeiro'
          : locale === 'es'
            ? 'Guía paso a paso para reservar tu grupo en Lapa Casa Rio en Santa Teresa, Río de Janeiro'
            : locale === 'de'
              ? 'Schritt-für-Schritt-Anleitung zur Buchung Ihres Gruppenaufenthalts im Lapa Casa Rio in Santa Teresa, Rio de Janeiro'
              : locale === 'it'
                ? 'Guida passo passo per prenotare il tuo gruppo al Lapa Casa Rio a Santa Teresa, Rio de Janeiro'
                : 'Guide étape par étape pour réserver votre séjour de groupe au Lapa Casa Rio à Santa Teresa, Rio de Janeiro',
    step: (steps[locale] ?? []).map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text,
    })),
    totalTime: 'PT10M',
    tool: [
      { '@type': 'HowToTool', name: 'WhatsApp' },
      { '@type': 'HowToTool', name: 'PIX / cartão de crédito' },
    ],
  };
}

function buildGroupFAQSchema(locale: Locale) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const c = CONTENT[locale]!;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.faq.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

// ─── Metadata ──────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const l = (locales.includes(locale as Locale) ? locale : defaultLocale) as Locale;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { title, description } = META[l]!;
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${l}/grupos`,
      languages: Object.fromEntries(locales.map((loc) => [loc, `${SITE_URL}/${loc}/grupos`])),
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${l}/grupos`,
      siteName: 'Lapa Casa',
      locale: l,
      type: 'website',
      images: [{ url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/og-image.jpg`],
    },
  };
}

// ─── Page component ────────────────────────────────────────────────────────────
export default async function GruposPage({ params }: { params: { locale: string } }) {
  const locale = (
    locales.includes(params.locale as Locale) ? params.locale : defaultLocale
  ) as Locale;
  setRequestLocale(locale);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const c = CONTENT[locale]!;

  const WA_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5521977157530';
  const waMsg = encodeURIComponent(c.ctaWa);
  const waUrl = `https://wa.me/${WA_PHONE}?text=${waMsg}`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* JSON-LD structured data */}
      <StructuredData data={buildGroupLodgingSchema()} />
      <StructuredData data={buildGroupHowToSchema(locale)} />
      <StructuredData data={buildGroupFAQSchema(locale)} />

      {/* Hero */}
      <section className="bg-primary/10 border-b border-primary/20 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          {/* Eyebrow */}
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3 speakable">
            Lapa Casa Rio · Santa Teresa · Rio de Janeiro
          </p>
          <h1
            className="text-3xl md:text-5xl font-bold leading-tight mb-5 speakable"
            data-speakable
          >
            {c.headline}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 speakable">
            {c.intro}
          </p>
          {/* Discount badges */}
          <div className="flex flex-wrap justify-center gap-3">
            <span className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-full">
              6–9 pessoas → 10% OFF
            </span>
            <span className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-full">
              10+ pessoas → 15% OFF
            </span>
            <span className="bg-secondary text-secondary-foreground text-sm font-semibold px-4 py-2 rounded-full">
              20+ → cotação especial
            </span>
          </div>
        </div>
      </section>

      {/* Content sections */}
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">
        {c.sections.map((section, i) => (
          <section key={i} aria-labelledby={`section-${i}`}>
            <h2
              id={`section-${i}`}
              className="text-2xl font-bold mb-4 text-foreground speakable"
              data-speakable
            >
              {section.heading}
            </h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">{section.body}</p>
            {section.bullets && (
              <ul className="space-y-2">
                {section.bullets.map((bullet, j) => (
                  <li key={j} className="flex items-start gap-2 text-foreground">
                    <span className="text-primary mt-1 flex-shrink-0" aria-hidden="true">
                      ✓
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* FAQ */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-bold mb-6 speakable" data-speakable>
            {locale === 'pt'
              ? 'Perguntas Frequentes sobre Grupos'
              : locale === 'en'
                ? 'Frequently Asked Questions — Groups'
                : locale === 'es'
                  ? 'Preguntas Frecuentes sobre Grupos'
                  : locale === 'de'
                    ? 'Häufige Fragen zu Gruppen'
                    : locale === 'it'
                      ? 'Domande Frequenti sui Gruppi'
                      : 'Questions Fréquentes sur les Groupes'}
          </h2>
          <dl className="space-y-4">
            {c.faq.map((item, i) => (
              <details key={i} className="group border border-border rounded-lg overflow-hidden">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer font-medium text-foreground hover:bg-muted/40 transition-colors list-none">
                  <dt className="flex-1">{item.question}</dt>
                  <span
                    className="flex-shrink-0 text-primary transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </summary>
                <dd className="px-5 pb-4 pt-2 text-muted-foreground leading-relaxed border-t border-border">
                  {item.answer}
                </dd>
              </details>
            ))}
          </dl>
        </section>
      </div>

      {/* Cross-link */}
      <div className="max-w-3xl mx-auto px-4 pb-2 text-sm text-muted-foreground">
        <a
          href={`/${locale}/santa-teresa`}
          className="underline hover:text-foreground transition-colors"
        >
          {locale === 'pt'
            ? '🗺️ Conheça Santa Teresa — o bairro onde estamos'
            : locale === 'en'
              ? '🗺️ Discover Santa Teresa — our neighborhood'
              : locale === 'es'
                ? '🗺️ Conoce Santa Teresa — el barrio donde estamos'
                : locale === 'de'
                  ? '🗺️ Santa Teresa entdecken — unser Stadtviertel'
                  : locale === 'it'
                    ? '🗺️ Scopri Santa Teresa — il nostro quartiere'
                    : '🗺️ Découvrez Santa Teresa — notre quartier'}
        </a>
      </div>

      {/* CTA */}
      <section className="bg-primary/10 border-t border-primary/20 py-14 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 speakable" data-speakable>
            {c.ctaTitle}
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">{c.ctaBody}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold px-7 py-3 rounded-full hover:bg-[#20bd5a] transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
            <a
              href={`/${locale}/hostel`}
              className="inline-flex items-center justify-center bg-primary text-primary-foreground font-semibold px-7 py-3 rounded-full hover:bg-primary/90 transition-colors"
            >
              {c.ctaBtn}
            </a>
          </div>
        </div>
      </section>

      {/* Breadcrumb nav */}
      <nav
        aria-label="breadcrumb"
        className="max-w-3xl mx-auto px-4 py-6 text-sm text-muted-foreground"
      >
        <ol className="flex items-center gap-2">
          <li>
            <a href={`/${locale}`} className="hover:text-foreground transition-colors">
              Lapa Casa
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground font-medium">
            {locale === 'pt'
              ? 'Grupos'
              : locale === 'en'
                ? 'Groups'
                : locale === 'es'
                  ? 'Grupos'
                  : locale === 'de'
                    ? 'Gruppen'
                    : locale === 'it'
                      ? 'Gruppi'
                      : 'Groupes'}
          </li>
        </ol>
      </nav>
      <SiteFooter locale={locale} />
    </main>
  );
}
