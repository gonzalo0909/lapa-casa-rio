// lapa-casa-hostel/frontend/src/components/seo/faq-section.tsx
//
// Componente FAQ visible en la página + JSON-LD FAQPage para AEO.
// Las respuestas aparecen tanto en el HTML (para lectores y Google) como en
// el schema JSON-LD (para motores de IA: ChatGPT, Perplexity, Gemini,
// Grok, Copilot, etc.).
//
// Uso:
//   <FAQSection locale="pt" pageName="hostel" />
//   <FAQSection locale="pt" pageName="apartamentos" />

'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  /** Idioma para mostrar el contenido */
  locale: string;
  /** hostel | apartamentos — determina qué preguntas se muestran */
  pageName?: 'hostel' | 'apartamentos' | 'general';
  /** Título de la sección (opcional) */
  title?: string;
}

// ─── FAQ HOSTEL ───────────────────────────────────────────────────────────────

const FAQ_HOSTEL: Record<string, FAQItem[]> = {
  pt: [
    {
      question: 'Qual é o horário de check-in e check-out?',
      answer:
        'O check-in é a partir das 14h. O check-out é até as 12h. Não aceitamos chegadas antes do horário nem saídas após o horário.',
    },
    {
      question: 'E se eu chegar depois das 22h?',
      answer:
        'A recepção atende até as 22h. Não é possível chegar depois desse horário -- escolha um horário de chegada entre 14h e 22h ao fazer a reserva.',
    },
    {
      question: 'Quais métodos de pagamento vocês aceitam?',
      answer: 'Aceitamos cartão de crédito e PIX. Não trabalhamos com parcelamento.',
    },
    {
      question: 'Vocês oferecem descontos para grupos?',
      answer:
        'Sim! Grupos com 6 ou mais camas têm 10% de desconto. Grupos com 10 ou mais camas têm 15% de desconto.',
    },
    {
      question: 'Como funciona a reserva para grupos grandes?',
      answer:
        'Grupos podem reservar dormitórios inteiros e o responsável preenche os dados uma única vez para todo o grupo. Também é possível dividir o pagamento entre os integrantes com um link compartilhável.',
    },
    {
      question: 'Qual é a política de cancelamento?',
      answer:
        'O depósito pago na reserva não é reembolsável em caso de cancelamento ou no-show, independentemente da antecedência.',
    },
    {
      question: 'Tem Wi-Fi grátis?',
      answer: 'Sim, Wi-Fi gratuito e de alta velocidade em todo o hostel.',
    },
    {
      question: 'Café da manhã está incluído?',
      answer: 'O café da manhã não está incluído, mas temos cozinha compartilhada disponível.',
    },
    {
      question: 'Tem estacionamento?',
      answer:
        'Não temos estacionamento próprio, mas há vagas na rua próximas ao hostel em Santa Teresa.',
    },
  ],
  es: [
    {
      question: '¿Cuál es el horario de check-in y check-out?',
      answer:
        'El check-in es a partir de las 14:00. El check-out es hasta las 12:00. No aceptamos llegadas antes del horario ni salidas después.',
    },
    {
      question: '¿Qué pasa si llego después de las 22h?',
      answer:
        'La recepción atiende hasta las 22h. No es posible llegar después de ese horario -- elegí una hora de llegada entre las 14h y las 22h al reservar.',
    },
    {
      question: '¿Qué métodos de pago aceptan?',
      answer: 'Aceptamos tarjeta de crédito y PIX. No trabajamos con cuotas.',
    },
    {
      question: '¿Ofrecen descuentos para grupos?',
      answer:
        '¡Sí! Grupos de 6 o más camas tienen 10% de descuento. Grupos de 10 o más camas tienen 15% de descuento.',
    },
    {
      question: '¿Cómo funciona la reserva para grupos grandes?',
      answer:
        'Los grupos pueden reservar dormitorios completos y quien organiza completa los datos una sola vez para todo el grupo. También se puede dividir el pago entre los integrantes con un link compartible.',
    },
    {
      question: '¿Cuál es la política de cancelación?',
      answer:
        'El depósito abonado en la reserva no es reembolsable en caso de cancelación o no-show, sin importar la anticipación.',
    },
    {
      question: '¿Hay Wi-Fi gratis?',
      answer: 'Sí, Wi-Fi gratuito de alta velocidad en todo el hostel.',
    },
    {
      question: '¿El desayuno está incluido?',
      answer: 'El desayuno no está incluido, pero tenemos cocina compartida disponible.',
    },
    {
      question: '¿Hay estacionamiento?',
      answer:
        'No tenemos estacionamiento propio, pero hay lugares en la calle cerca del hostel en Santa Teresa.',
    },
  ],
  en: [
    {
      question: 'What are the check-in and check-out times?',
      answer:
        'Check-in is from 2:00 PM. Check-out is by 12:00 PM. We do not accept early arrivals or late departures outside these times.',
    },
    {
      question: 'What if I arrive after 10 PM?',
      answer:
        'Reception is open until 10 PM. Arrivals after that time are not possible -- choose an arrival time between 2 PM and 10 PM when booking.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept credit card and PIX. Installment payments are not available.',
    },
    {
      question: 'Do you offer group discounts?',
      answer: 'Yes! Groups of 6 or more beds get 10% off. Groups of 10 or more beds get 15% off.',
    },
    {
      question: 'How does booking work for large groups?',
      answer:
        'Groups can book entire dorms, and the organizer fills in the details once for the whole group. Payment can also be split among members with a shareable link.',
    },
    {
      question: 'What is the cancellation policy?',
      answer:
        'The deposit paid at booking is non-refundable in case of cancellation or no-show, regardless of notice.',
    },
    {
      question: 'Is there free Wi-Fi?',
      answer: 'Yes, free high-speed Wi-Fi throughout the hostel.',
    },
    {
      question: 'Is breakfast included?',
      answer: 'Breakfast is not included, but we have a shared kitchen available.',
    },
    {
      question: 'Is there parking?',
      answer:
        'We do not have our own parking, but there is street parking near the hostel in Santa Teresa.',
    },
  ],
  de: [
    {
      question: 'Wann sind Check-in und Check-out?',
      answer:
        'Check-in ab 14:00 Uhr. Check-out bis 12:00 Uhr. Frühankünfte oder Spätabreisen außerhalb dieser Zeiten werden nicht akzeptiert.',
    },
    {
      question: 'Was passiert, wenn ich nach 22 Uhr ankomme?',
      answer:
        'Die Rezeption ist bis 22 Uhr geöffnet. Eine Ankunft nach dieser Zeit ist nicht möglich -- wählen Sie bei der Buchung eine Ankunftszeit zwischen 14 und 22 Uhr.',
    },
    {
      question: 'Welche Zahlungsmethoden akzeptieren Sie?',
      answer: 'Wir akzeptieren Kreditkarte und PIX. Ratenzahlung ist nicht verfügbar.',
    },
    {
      question: 'Bieten Sie Gruppenrabatte an?',
      answer:
        'Ja! Gruppen ab 6 Betten erhalten 10% Rabatt. Gruppen ab 10 Betten erhalten 15% Rabatt.',
    },
    {
      question: 'Wie funktioniert die Buchung für große Gruppen?',
      answer:
        'Gruppen können ganze Schlafsäle buchen, der Organisator gibt die Daten einmal für die ganze Gruppe ein. Die Zahlung kann auch über einen teilbaren Link unter den Mitgliedern aufgeteilt werden.',
    },
    {
      question: 'Wie lautet die Stornierungsrichtlinie?',
      answer:
        'Die bei der Buchung gezahlte Anzahlung ist bei Stornierung oder Nichterscheinen nicht erstattungsfähig, unabhängig von der Vorlaufzeit.',
    },
    {
      question: 'Gibt es kostenloses WLAN?',
      answer: 'Ja, kostenloses Hochgeschwindigkeits-WLAN im gesamten Hostel.',
    },
    {
      question: 'Ist das Frühstück inbegriffen?',
      answer: 'Das Frühstück ist nicht inbegriffen, aber es gibt eine Gemeinschaftsküche.',
    },
    {
      question: 'Gibt es Parkplätze?',
      answer:
        'Wir haben keinen eigenen Parkplatz, aber es gibt Straßenparkplätze in der Nähe des Hostels in Santa Teresa.',
    },
  ],
  fr: [
    {
      question: "Quels sont les horaires d'arrivée et de départ ?",
      answer:
        "L'arrivée est à partir de 14h00. Le départ est avant 12h00. Nous n'acceptons pas les arrivées anticipées ni les départs tardifs.",
    },
    {
      question: "Que se passe-t-il si j'arrive après 22h ?",
      answer:
        "La réception est ouverte jusqu'à 22h. Il n'est pas possible d'arriver après cette heure -- choisissez une heure d'arrivée entre 14h et 22h lors de la réservation.",
    },
    {
      question: 'Quels modes de paiement acceptez-vous ?',
      answer:
        "Nous acceptons la carte de crédit et le PIX. Le paiement en plusieurs fois n'est pas disponible.",
    },
    {
      question: 'Proposez-vous des remises de groupe ?',
      answer:
        'Oui ! Les groupes de 6 lits ou plus bénéficient de 10% de réduction. Les groupes de 10 lits ou plus ont 15% de réduction.',
    },
    {
      question: 'Comment fonctionne la réservation pour les grands groupes ?',
      answer:
        "Les groupes peuvent réserver des dortoirs entiers, et l'organisateur remplit les informations une seule fois pour tout le groupe. Le paiement peut aussi être partagé entre les membres via un lien.",
    },
    {
      question: "Quelle est la politique d'annulation ?",
      answer:
        "L'acompte versé lors de la réservation n'est pas remboursable en cas d'annulation ou de non-présentation, quel que soit le délai de préavis.",
    },
    {
      question: 'Y a-t-il le Wi-Fi gratuit ?',
      answer: "Oui, Wi-Fi gratuit et haut débit dans toute l'auberge.",
    },
    {
      question: 'Le petit-déjeuner est-il inclus ?',
      answer: "Le petit-déjeuner n'est pas inclus, mais nous avons une cuisine commune disponible.",
    },
    {
      question: 'Y a-t-il un parking ?',
      answer:
        "Nous n'avons pas de parking propre, mais il y a des places dans la rue près de l'auberge.",
    },
  ],
  it: [
    {
      question: 'Quali sono gli orari di check-in e check-out?',
      answer:
        'Il check-in è dalle 14:00. Il check-out è entro le 12:00. Non accettiamo arrivi anticipati o partenze tardive.',
    },
    {
      question: 'Cosa succede se arrivo dopo le 22?',
      answer:
        "La reception è aperta fino alle 22. Non è possibile arrivare dopo quell'orario -- scegli un orario di arrivo tra le 14 e le 22 al momento della prenotazione.",
    },
    {
      question: 'Quali metodi di pagamento accettate?',
      answer: 'Accettiamo carta di credito e PIX. Il pagamento rateale non è disponibile.',
    },
    {
      question: 'Offrite sconti per gruppi?',
      answer:
        'Sì! Gruppi di 6 o più letti hanno il 10% di sconto. Gruppi di 10 o più letti hanno il 15% di sconto.',
    },
    {
      question: 'Come funziona la prenotazione per gruppi numerosi?',
      answer:
        'I gruppi possono prenotare interi dormitori e chi organizza compila i dati una sola volta per tutto il gruppo. Il pagamento può anche essere diviso tra i partecipanti con un link condivisibile.',
    },
    {
      question: 'Qual è la politica di cancellazione?',
      answer:
        'Il deposito pagato al momento della prenotazione non è rimborsabile in caso di cancellazione o no-show, indipendentemente dal preavviso.',
    },
    {
      question: "C'è il Wi-Fi gratuito?",
      answer: "Sì, Wi-Fi gratuito ad alta velocità in tutto l'ostello.",
    },
    {
      question: 'La colazione è inclusa?',
      answer: 'La colazione non è inclusa, ma abbiamo una cucina condivisa disponibile.',
    },
    {
      question: "C'è un parcheggio?",
      answer:
        "Non abbiamo un parcheggio proprio, ma ci sono posti in strada vicino all'ostello a Santa Teresa.",
    },
  ],
};

// ─── FAQ APARTAMENTOS ─────────────────────────────────────────────────────────

const FAQ_APARTMENTS: Record<string, FAQItem[]> = {
  pt: [
    {
      question: 'Qual é o horário de check-in e check-out?',
      answer:
        'O check-in é a partir das 14h. O check-out é até as 12h. Não aceitamos chegadas antes do horário nem saídas após o horário.',
    },
    {
      question: 'Quais métodos de pagamento vocês aceitam?',
      answer: 'Aceitamos cartão de crédito e PIX. Não trabalhamos com parcelamento.',
    },
    {
      question: 'Os apartamentos têm Wi-Fi?',
      answer: 'Sim, cada apartamento tem seu próprio Wi-Fi de alta velocidade incluso.',
    },
    {
      question: 'Tem cozinha nos apartamentos?',
      answer: 'Sim, cada apartamento possui sua própria cozinha privativa e equipada.',
    },
    {
      question: 'Qual é a política de cancelamento?',
      answer:
        'O depósito pago na reserva não é reembolsável em caso de cancelamento ou no-show, independentemente da antecedência.',
    },
    {
      question: 'Tem estacionamento?',
      answer:
        'Nenhum dos apartamentos possui estacionamento próprio. Cada um fica em um endereço diferente no Rio de Janeiro, então as opções de estacionamento variam conforme a região.',
    },
  ],
  es: [
    {
      question: '¿Cuál es el horario de check-in y check-out?',
      answer:
        'El check-in es a partir de las 14:00. El check-out es hasta las 12:00. No aceptamos llegadas antes del horario ni salidas después.',
    },
    {
      question: '¿Qué métodos de pago aceptan?',
      answer: 'Aceptamos tarjeta de crédito y PIX. No trabajamos con cuotas.',
    },
    {
      question: '¿Los apartamentos tienen Wi-Fi?',
      answer: 'Sí, cada apartamento tiene su propio Wi-Fi de alta velocidad incluido.',
    },
    {
      question: '¿Hay cocina en los apartamentos?',
      answer: 'Sí, cada apartamento cuenta con su propia cocina privada y equipada.',
    },
    {
      question: '¿Cuál es la política de cancelación?',
      answer:
        'El depósito abonado en la reserva no es reembolsable en caso de cancelación o no-show, sin importar la anticipación.',
    },
    {
      question: '¿Hay estacionamiento?',
      answer:
        'Ninguno de los apartamentos cuenta con estacionamiento propio. Cada uno está en una dirección distinta dentro de Río de Janeiro, por lo que las opciones de estacionamiento varían según la zona.',
    },
  ],
  en: [
    {
      question: 'What are the check-in and check-out times?',
      answer:
        'Check-in is from 2:00 PM. Check-out is by 12:00 PM. We do not accept early arrivals or late departures.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept credit card and PIX. Installment payments are not available.',
    },
    {
      question: 'Do the apartments have Wi-Fi?',
      answer: 'Yes, each apartment has its own high-speed Wi-Fi included.',
    },
    {
      question: 'Is there a kitchen in the apartments?',
      answer: 'Yes, each apartment has its own private, fully equipped kitchen.',
    },
    {
      question: 'What is the cancellation policy?',
      answer:
        'The deposit paid at booking is non-refundable in case of cancellation or no-show, regardless of notice.',
    },
    {
      question: 'Is there parking?',
      answer:
        'None of the apartments have their own parking. Each one is at a different address in Rio de Janeiro, so parking options vary by area.',
    },
  ],
  de: [
    {
      question: 'Wann sind Check-in und Check-out?',
      answer:
        'Check-in ab 14:00 Uhr. Check-out bis 12:00 Uhr. Frühankünfte oder Spätabreisen werden nicht akzeptiert.',
    },
    {
      question: 'Welche Zahlungsmethoden akzeptieren Sie?',
      answer: 'Wir akzeptieren Kreditkarte und PIX. Ratenzahlung ist nicht verfügbar.',
    },
    {
      question: 'Haben die Apartments WLAN?',
      answer: 'Ja, jedes Apartment hat sein eigenes Hochgeschwindigkeits-WLAN inklusive.',
    },
    {
      question: 'Gibt es eine Küche in den Apartments?',
      answer: 'Ja, jedes Apartment verfügt über eine eigene, voll ausgestattete Küche.',
    },
    {
      question: 'Wie lautet die Stornierungsrichtlinie?',
      answer:
        'Die bei der Buchung gezahlte Anzahlung ist bei Stornierung oder Nichterscheinen nicht erstattungsfähig, unabhängig von der Vorlaufzeit.',
    },
    {
      question: 'Gibt es Parkplätze?',
      answer:
        'Keines der Apartments verfügt über einen eigenen Parkplatz. Jedes befindet sich an einer anderen Adresse in Rio de Janeiro, daher variieren die Parkmöglichkeiten je nach Lage.',
    },
  ],
  fr: [
    {
      question: "Quels sont les horaires d'arrivée et de départ ?",
      answer:
        "L'arrivée est à partir de 14h00. Le départ est avant 12h00. Nous n'acceptons pas les arrivées anticipées ni les départs tardifs.",
    },
    {
      question: 'Quels modes de paiement acceptez-vous ?',
      answer:
        "Nous acceptons la carte de crédit et le PIX. Le paiement en plusieurs fois n'est pas disponible.",
    },
    {
      question: 'Les appartements ont-ils le Wi-Fi ?',
      answer: 'Oui, chaque appartement a son propre Wi-Fi haut débit inclus.',
    },
    {
      question: 'Y a-t-il une cuisine dans les appartements ?',
      answer: 'Oui, chaque appartement dispose de sa propre cuisine privée entièrement équipée.',
    },
    {
      question: "Quelle est la politique d'annulation ?",
      answer:
        "L'acompte versé lors de la réservation n'est pas remboursable en cas d'annulation ou de non-présentation, quel que soit le délai de préavis.",
    },
    {
      question: 'Y a-t-il un parking ?',
      answer:
        'Aucun appartement ne dispose de parking propre. Chacun se trouve à une adresse différente à Rio de Janeiro, les options de stationnement varient donc selon le quartier.',
    },
  ],
  it: [
    {
      question: 'Quali sono gli orari di check-in e check-out?',
      answer:
        'Il check-in è dalle 14:00. Il check-out è entro le 12:00. Non accettiamo arrivi anticipati o partenze tardive.',
    },
    {
      question: 'Quali metodi di pagamento accettate?',
      answer: 'Accettiamo carta di credito e PIX. Il pagamento rateale non è disponibile.',
    },
    {
      question: 'Gli appartamenti hanno il Wi-Fi?',
      answer: 'Sì, ogni appartamento ha il proprio Wi-Fi ad alta velocità incluso.',
    },
    {
      question: "C'è una cucina negli appartamenti?",
      answer:
        'Sì, ogni appartamento dispone di una propria cucina privata completamente attrezzata.',
    },
    {
      question: 'Qual è la politica di cancellazione?',
      answer:
        'Il deposito pagato al momento della prenotazione non è rimborsabile in caso di cancellazione o no-show, indipendentemente dal preavviso.',
    },
    {
      question: "C'è un parcheggio?",
      answer:
        'Nessuno degli appartamenti dispone di parcheggio proprio. Ognuno si trova in un indirizzo diverso a Rio de Janeiro, quindi le opzioni di parcheggio variano in base alla zona.',
    },
  ],
};

// ─── JSON-LD builder ──────────────────────────────────────────────────────────

function buildFAQSchema(items: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

const TITLES: Record<string, Record<string, string>> = {
  hostel: {
    pt: 'Perguntas Frequentes — Hostel',
    en: 'FAQ — Hostel',
    es: 'Preguntas Frecuentes — Hostel',
    de: 'FAQ — Hostel',
    fr: 'Questions fréquentes — Auberge',
    it: 'Domande frequenti — Ostello',
  },
  apartamentos: {
    pt: 'Perguntas Frequentes — Apartamentos',
    en: 'FAQ — Apartments',
    es: 'Preguntas Frecuentes — Apartamentos',
    de: 'FAQ — Apartments',
    fr: 'Questions fréquentes — Appartements',
    it: 'Domande frequenti — Appartamenti',
  },
  general: {
    pt: 'Perguntas Frequentes',
    en: 'Frequently Asked Questions',
    es: 'Preguntas Frecuentes',
    de: 'Häufig gestellte Fragen',
    fr: 'Questions fréquentes',
    it: 'Domande frequenti',
  },
};

export function FAQSection({ locale, pageName = 'general', title }: FAQSectionProps) {
  const lang = ['pt', 'es', 'en', 'de', 'fr', 'it'].includes(locale) ? locale : 'en';

  const contentMap =
    pageName === 'apartamentos' ? FAQ_APARTMENTS : pageName === 'hostel' ? FAQ_HOSTEL : FAQ_HOSTEL; // general usa hostel como base

  const items = contentMap[lang] ?? contentMap['en']!;
  const heading = title ?? TITLES[pageName]?.[lang] ?? 'FAQ';
  const schema = buildFAQSchema(items);

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section aria-labelledby="faq-heading" className="py-12 px-4 max-w-3xl mx-auto">
      {/* JSON-LD: consumido por Google, ChatGPT, Perplexity, Gemini, Grok, Copilot */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <h2
        id="faq-heading"
        className="text-2xl font-display font-semibold text-foreground mb-8 text-center"
      >
        {heading}
      </h2>

      <dl className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {items.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="bg-card">
              <dt>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${i}`}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left
                             text-sm font-medium text-foreground hover:bg-accent/50
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                             transition-colors"
                >
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className={`ml-4 flex-shrink-0 text-muted-foreground transition-transform duration-200
                               ${isOpen ? 'rotate-180' : ''}`}
                  >
                    ▾
                  </span>
                </button>
              </dt>
              <dd
                id={`faq-answer-${i}`}
                className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96' : 'max-h-0'}`}
              >
                <p className="px-5 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </p>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export default FAQSection;
