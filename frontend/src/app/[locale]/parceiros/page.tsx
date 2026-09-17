// lapa-casa-hostel/frontend/src/app/[locale]/parceiros/page.tsx
// Página pública del contrato de asociación para administradores de propiedad.
// URL: /[locale]/parceiros

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from '@/i18n';
import { PartnerContractPage } from '@/components/partners/partner-contract-page';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'seo' });
  const title = t('partnersTitle');
  const description = t('partnersDescription');
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}/parceiros`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/parceiros`])),
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}/parceiros`,
      siteName: 'Lapa Casa',
      locale,
      type: 'website',
    },
  };
}

// ── Partner FAQ content (B2B — property administrators) ──────────────────────
type FaqEntry = { q: string; a: string };
const PARTNER_FAQ: Record<Locale, FaqEntry[]> = {
  pt: [
    {
      q: 'Qual é a comissão cobrada pela Lapa Casa?',
      a: 'A comissão é de 5% sobre o valor líquido de cada reserva confirmada. Não há taxas de adesão nem mensalidade — você só paga quando recebe.',
    },
    {
      q: 'Quem realiza o check-in e o atendimento aos hóspedes?',
      a: 'A Lapa Casa cuida de todo o processo operacional: check-in, check-out, atendimento durante a estadia e comunicação com os hóspedes. Você não precisa estar disponível no imóvel.',
    },
    {
      q: 'Como faço para cadastrar meu imóvel?',
      a: 'Preencha o formulário de contato nesta página com os dados do imóvel. Nossa equipe entrará em contato em até 48 horas úteis para agendar uma visita de avaliação e apresentar o contrato completo.',
    },
  ],
  en: [
    {
      q: 'What commission does Lapa Casa charge?',
      a: 'The commission is 5% of the net value of each confirmed booking. There are no sign-up fees or monthly charges — you only pay when you earn.',
    },
    {
      q: 'Who handles guest check-in and support?',
      a: 'Lapa Casa manages the entire operational side: check-in, check-out, in-stay support, and guest communication. You do not need to be on-site.',
    },
    {
      q: 'How do I register my property?',
      a: 'Fill out the contact form on this page with your property details. Our team will reach out within 48 business hours to schedule a property assessment and walk you through the full contract.',
    },
  ],
  es: [
    {
      q: '¿Qué comisión cobra Lapa Casa?',
      a: 'La comisión es del 5% sobre el valor neto de cada reserva confirmada. No hay tarifas de inscripción ni mensualidad — solo pagas cuando cobras.',
    },
    {
      q: '¿Quién se encarga del check-in y la atención a los huéspedes?',
      a: 'Lapa Casa gestiona todo el proceso operativo: check-in, check-out, atención durante la estadía y comunicación con los huéspedes. No necesitas estar en el inmueble.',
    },
    {
      q: '¿Cómo registro mi propiedad?',
      a: 'Completa el formulario de contacto en esta página con los datos de tu propiedad. Nuestro equipo se pondrá en contacto en un plazo de 48 horas hábiles para programar una visita de evaluación y presentarte el contrato completo.',
    },
  ],
  de: [
    {
      q: 'Welche Provision verlangt Lapa Casa?',
      a: 'Die Provision beträgt 5% des Nettowerts jeder bestätigten Buchung. Es gibt keine Anmeldegebühren oder monatliche Kosten — Sie zahlen nur, wenn Sie verdienen.',
    },
    {
      q: 'Wer kümmert sich um Check-in und Gästebetreuung?',
      a: 'Lapa Casa übernimmt den gesamten operativen Bereich: Check-in, Check-out, Betreuung während des Aufenthalts und Gästekommunikation. Sie müssen nicht vor Ort sein.',
    },
    {
      q: 'Wie registriere ich meine Immobilie?',
      a: 'Füllen Sie das Kontaktformular auf dieser Seite mit Ihren Immobiliendaten aus. Unser Team meldet sich innerhalb von 48 Arbeitsstunden, um eine Besichtigung zu vereinbaren und Ihnen den vollständigen Vertrag vorzustellen.',
    },
  ],
  fr: [
    {
      q: 'Quelle commission Lapa Casa prélève-t-elle?',
      a: "La commission est de 5% de la valeur nette de chaque réservation confirmée. Aucun frais d'inscription ni abonnement mensuel — vous ne payez que lorsque vous encaissez.",
    },
    {
      q: "Qui gère le check-in et l'accueil des voyageurs?",
      a: "Lapa Casa prend en charge l'ensemble du processus opérationnel : check-in, check-out, assistance pendant le séjour et communication avec les voyageurs. Vous n'avez pas besoin d'être sur place.",
    },
    {
      q: 'Comment inscrire mon bien immobilier?',
      a: "Remplissez le formulaire de contact sur cette page avec les informations de votre bien. Notre équipe vous contactera sous 48 heures ouvrables pour planifier une visite d'évaluation et vous présenter le contrat complet.",
    },
  ],
  it: [
    {
      q: 'Quale commissione applica Lapa Casa?',
      a: 'La commissione è del 5% sul valore netto di ogni prenotazione confermata. Non ci sono costi di iscrizione né canoni mensili — paghi solo quando incassi.',
    },
    {
      q: "Chi si occupa del check-in e dell'assistenza agli ospiti?",
      a: "Lapa Casa gestisce l'intero processo operativo: check-in, check-out, assistenza durante il soggiorno e comunicazione con gli ospiti. Non è necessario essere presenti nell'immobile.",
    },
    {
      q: 'Come registro il mio immobile?',
      a: "Compila il modulo di contatto in questa pagina con i dati dell'immobile. Il nostro team ti contatterà entro 48 ore lavorative per fissare un sopralluogo di valutazione e presentarti il contratto completo.",
    },
  ],
};

// ── Service JSON-LD (B2B hospitality management) ─────────────────────────────
function ServiceJsonLd({ locale }: { locale: Locale }) {
  const faqItems = PARTNER_FAQ[locale];
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${SITE_URL}/${locale}/parceiros#service`,
        name:
          locale === 'pt'
            ? 'Gestão hoteleira para administradores de imóveis — Lapa Casa'
            : locale === 'en'
              ? 'Hospitality management for property owners — Lapa Casa'
              : locale === 'es'
                ? 'Gestión hotelera para administradores de inmuebles — Lapa Casa'
                : locale === 'de'
                  ? 'Hotelmanagement für Immobilienverwalter — Lapa Casa'
                  : locale === 'it'
                    ? 'Gestione alberghiera per proprietari di immobili — Lapa Casa'
                    : 'Gestion hôtelière pour propriétaires — Lapa Casa',
        description:
          locale === 'pt'
            ? 'Programa de parceiros Lapa Casa: gerencie seu imóvel em Santa Teresa com 5% de comissão, check-in operacional completo e repasse mensal garantido.'
            : locale === 'en'
              ? 'Lapa Casa partner program: manage your Santa Teresa property with a 5% commission, full check-in operations, and guaranteed monthly payouts.'
              : locale === 'es'
                ? 'Programa de socios Lapa Casa: gestione su inmueble en Santa Teresa con 5% de comisión, operaciones de check-in completas y pagos mensuales garantizados.'
                : locale === 'de'
                  ? 'Lapa Casa Partnerprogramm: Verwalten Sie Ihre Immobilie in Santa Teresa mit 5% Provision, vollständigem Check-in-Service und garantierten monatlichen Auszahlungen.'
                  : locale === 'it'
                    ? 'Programma partner Lapa Casa: gestisci il tuo immobile a Santa Teresa con il 5% di commissione, operazioni di check-in complete e pagamenti mensili garantiti.'
                    : 'Programme partenaire Lapa Casa : gérez votre bien à Santa Teresa avec 5% de commission, opérations de check-in complètes et virements mensuels garantis.',
        provider: {
          '@type': 'LodgingBusiness',
          '@id': `${SITE_URL}/#organization`,
          name: 'Lapa Casa',
          url: SITE_URL,
        },
        areaServed: {
          '@type': 'City',
          name: 'Rio de Janeiro',
          addressCountry: 'BR',
        },
        serviceType:
          locale === 'pt'
            ? 'Gestão hoteleira e aluguel por temporada'
            : locale === 'en'
              ? 'Hospitality management and short-term rental'
              : locale === 'es'
                ? 'Gestión hotelera y alquiler vacacional'
                : locale === 'de'
                  ? 'Hotelmanagement und Kurzzeitvermietung'
                  : locale === 'it'
                    ? 'Gestione alberghiera e affitto breve'
                    : 'Gestion hôtelière et location saisonnière',
        offers: {
          '@type': 'Offer',
          name:
            locale === 'pt'
              ? 'Comissão de 5% por reserva confirmada'
              : locale === 'en'
                ? '5% commission per confirmed booking'
                : locale === 'es'
                  ? 'Comisión del 5% por reserva confirmada'
                  : locale === 'de'
                    ? '5% Provision pro bestätigter Buchung'
                    : locale === 'it'
                      ? '5% di commissione per ogni prenotazione confermata'
                      : '5% de commission par réservation confirmée',
          price: '5',
          priceCurrency: 'BRL',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            referenceQuantity: {
              '@type': 'QuantitativeValue',
              value: '100',
              unitText: 'percent of booking value',
            },
          },
        },
        url: `${SITE_URL}/${locale}/parceiros`,
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/${locale}/parceiros#faq`,
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ── Partner FAQ UI section ───────────────────────────────────────────────────
function PartnerFaqSection({ locale }: { locale: Locale }) {
  const faqItems = PARTNER_FAQ[locale];
  const heading =
    locale === 'pt'
      ? 'Perguntas frequentes de parceiros'
      : locale === 'en'
        ? 'Partner FAQ'
        : locale === 'es'
          ? 'Preguntas frecuentes de socios'
          : locale === 'de'
            ? 'Häufige Fragen für Partner'
            : locale === 'it'
              ? 'Domande frequenti dei partner'
              : 'Questions fréquentes des partenaires';

  return (
    <section
      aria-label={heading}
      className="max-w-3xl mx-auto px-4 py-10 border-t border-border mt-6"
    >
      <h2 className="text-xl font-semibold text-foreground mb-6">{heading}</h2>
      <dl className="space-y-6">
        {faqItems.map((item, i) => (
          <div key={i}>
            <dt className="font-medium text-foreground">{item.q}</dt>
            <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function ParceirosPage({ params }: { params: { locale: string } }) {
  const locale = (
    locales.includes(params.locale as Locale) ? params.locale : defaultLocale
  ) as Locale;
  setRequestLocale(locale);

  return (
    <>
      <ServiceJsonLd locale={locale} />
      <PartnerContractPage locale={locale} />
      <PartnerFaqSection locale={locale} />
    </>
  );
}
