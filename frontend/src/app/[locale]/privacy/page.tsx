// lapa-casa-hostel/frontend/src/app/[locale]/privacy/page.tsx
//
// Política de Privacidad — sección 14 auditoría de 17 secciones.
// El banner de consentimiento de cookies (components/legal/cookie-consent.tsx)
// ya linkeaba a "/privacy" pero la página no existía (404).
//
// IMPORTANTE: este contenido describe, de forma verificable en el código,
// QUÉ datos se recolectan y CON QUÉ herramientas (formulario de reserva,
// GA4, Facebook Pixel -- gateados por el propio consentimiento desde esta
// misma sección). NO incluye textos legales que requieren una decisión de
// negocio/legal que no puede inventarse por código: base legal exacta por
// actividad de tratamiento LGPD/GDPR, plazos de retención, datos de un DPO/
// encargado de privacidad, ni el procedimiento formal de ejercicio de
// derechos ARCO. Esas secciones quedan marcadas como pendientes de revisión
// legal antes de publicar en producción.

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';
const LAST_UPDATED = '2026-08-31';

const META: Record<Locale, { title: string; description: string }> = {
  pt: { title: 'Política de Privacidade — Lapa Casa Rio', description: 'Como o Lapa Casa Rio coleta e utiliza dados pessoais.' },
  es: { title: 'Política de Privacidad — Lapa Casa Rio', description: 'Cómo Lapa Casa Rio recopila y utiliza los datos personales.' },
  en: { title: 'Privacy Policy — Lapa Casa Rio', description: 'How Lapa Casa Rio collects and uses personal data.' },
  de: { title: 'Datenschutzrichtlinie — Lapa Casa Rio', description: 'Wie das Lapa Casa Rio personenbezogene Daten erhebt und verwendet.' },
  fr: { title: 'Politique de Confidentialité — Lapa Casa Rio', description: 'Comment Lapa Casa Rio collecte et utilise les données personnelles.' },
  it: { title: 'Informativa sulla Privacy — Lapa Casa Rio', description: 'Come il Lapa Casa Rio raccoglie e utilizza i dati personali.' },
};

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  setRequestLocale(locale);
  const safeLocale = (locales.includes(locale as Locale) ? locale : defaultLocale) as Locale;
  const m = META[safeLocale];
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: `${SITE_URL}/${locale}/privacy`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/privacy`])),
    },
    robots: { index: true, follow: true },
  };
}

interface Section {
  title: string;
  body: string;
  items?: string[];
  pending?: boolean;
}

interface Content {
  headline: string;
  updatedLabel: string;
  intro: string;
  sections: Section[];
  pendingNotice: string;
}

const CONTENT: Record<Locale, Content> = {
  pt: {
    headline: 'Política de Privacidade',
    updatedLabel: 'Última atualização',
    intro: 'Esta página descreve quais dados pessoais o Lapa Casa Rio coleta através deste site e como são utilizados.',
    pendingNotice: 'Seções marcadas como "pendente" ainda não foram formalizadas com assessoria jurídica e serão completadas antes de qualquer uso que exija esse detalhamento.',
    sections: [
      {
        title: '1. Dados coletados na reserva',
        body: 'Ao reservar, coletamos: nome completo, e-mail, telefone, país, documento de identidade (com foto) e horário de chegada estimado. Esses dados são necessários para processar a hospedagem e cumprir obrigações legais de registro de hóspedes.',
      },
      {
        title: '2. Cookies e ferramentas de análise',
        body: 'Utilizamos Google Analytics (GA4) e Facebook Pixel apenas se você aceitar no banner de cookies exibido na primeira visita. Sua escolha fica salva no seu navegador (localStorage) e pode ser alterada limpando os dados do site.',
      },
      {
        title: '3. Compartilhamento de dados',
        body: 'Os dados de pagamento são processados diretamente pelos provedores Stripe e Mercado Pago — o Lapa Casa Rio não armazena números de cartão. Dados de reserva podem ser compartilhados com autoridades quando exigido por lei.',
      },
      {
        title: '4. Retenção e exclusão de dados',
        body: 'Prazo exato de retenção e processo formal de solicitação de exclusão de dados pendente de definição pelo responsável do negócio.',
        pending: true,
      },
      {
        title: '5. Encarregado de dados (LGPD) / contato de privacidade',
        body: 'Canal formal de contato para questões de privacidade (LGPD/GDPR) pendente de definição pelo responsável do negócio.',
        pending: true,
      },
    ],
  },

  es: {
    headline: 'Política de Privacidad',
    updatedLabel: 'Última actualización',
    intro: 'Esta página describe qué datos personales recopila Lapa Casa Rio a través de este sitio y cómo se utilizan.',
    pendingNotice: 'Las secciones marcadas como "pendiente" aún no fueron formalizadas con asesoría legal y se completarán antes de cualquier uso que requiera ese detalle.',
    sections: [
      {
        title: '1. Datos recopilados en la reserva',
        body: 'Al reservar, recopilamos: nombre completo, email, teléfono, país, documento de identidad (con foto) y horario de llegada estimado. Estos datos son necesarios para procesar el hospedaje y cumplir obligaciones legales de registro de huéspedes.',
      },
      {
        title: '2. Cookies y herramientas de análisis',
        body: 'Usamos Google Analytics (GA4) y Facebook Pixel solo si aceptás el banner de cookies mostrado en tu primera visita. Tu elección se guarda en tu navegador (localStorage) y puede cambiarse borrando los datos del sitio.',
      },
      {
        title: '3. Compartición de datos',
        body: 'Los datos de pago son procesados directamente por Stripe y Mercado Pago — Lapa Casa Rio no almacena números de tarjeta. Los datos de reserva pueden compartirse con autoridades cuando la ley lo exija.',
      },
      {
        title: '4. Retención y eliminación de datos',
        body: 'Plazo exacto de retención y proceso formal de solicitud de eliminación de datos pendiente de definición por el responsable del negocio.',
        pending: true,
      },
      {
        title: '5. Encargado de datos (RGPD/LGPD) / contacto de privacidad',
        body: 'Canal formal de contacto para cuestiones de privacidad (RGPD/LGPD) pendiente de definición por el responsable del negocio.',
        pending: true,
      },
    ],
  },

  en: {
    headline: 'Privacy Policy',
    updatedLabel: 'Last updated',
    intro: 'This page describes what personal data Lapa Casa Rio collects through this site and how it is used.',
    pendingNotice: 'Sections marked "pending" have not yet been formalized with legal counsel and will be completed before any use that requires that detail.',
    sections: [
      {
        title: '1. Data collected at booking',
        body: 'When booking, we collect: full name, email, phone, country, ID document (with photo), and estimated arrival time. This data is necessary to process the stay and comply with legal guest-registration requirements.',
      },
      {
        title: '2. Cookies and analytics tools',
        body: 'We use Google Analytics (GA4) and Facebook Pixel only if you accept the cookie banner shown on your first visit. Your choice is stored in your browser (localStorage) and can be changed by clearing site data.',
      },
      {
        title: '3. Data sharing',
        body: 'Payment data is processed directly by Stripe and Mercado Pago — Lapa Casa Rio does not store card numbers. Booking data may be shared with authorities when required by law.',
      },
      {
        title: '4. Data retention and deletion',
        body: 'Exact retention period and formal data-deletion request process pending definition by the business owner.',
        pending: true,
      },
      {
        title: '5. Data controller (GDPR/LGPD) / privacy contact',
        body: 'Formal contact channel for privacy (GDPR/LGPD) matters pending definition by the business owner.',
        pending: true,
      },
    ],
  },

  de: {
    headline: 'Datenschutzrichtlinie',
    updatedLabel: 'Zuletzt aktualisiert',
    intro: 'Diese Seite beschreibt, welche personenbezogenen Daten das Lapa Casa Rio über diese Website erhebt und wie sie verwendet werden.',
    pendingNotice: 'Als "ausstehend" markierte Abschnitte wurden noch nicht rechtlich formalisiert und werden vor jeder Nutzung, die diese Details erfordert, vervollständigt.',
    sections: [
      {
        title: '1. Bei der Buchung erhobene Daten',
        body: 'Bei der Buchung erheben wir: vollständigen Namen, E-Mail, Telefon, Land, Ausweisdokument (mit Foto) und voraussichtliche Ankunftszeit. Diese Daten sind für die Abwicklung des Aufenthalts und zur Erfüllung gesetzlicher Meldepflichten erforderlich.',
      },
      {
        title: '2. Cookies und Analysetools',
        body: 'Wir verwenden Google Analytics (GA4) und Facebook Pixel nur, wenn Sie den beim ersten Besuch angezeigten Cookie-Hinweis akzeptieren. Ihre Wahl wird in Ihrem Browser (localStorage) gespeichert und kann durch Löschen der Website-Daten geändert werden.',
      },
      {
        title: '3. Datenweitergabe',
        body: 'Zahlungsdaten werden direkt von Stripe und Mercado Pago verarbeitet — das Lapa Casa Rio speichert keine Kartennummern. Buchungsdaten können bei gesetzlicher Verpflichtung an Behörden weitergegeben werden.',
      },
      {
        title: '4. Datenspeicherung und -löschung',
        body: 'Genaue Aufbewahrungsfrist und formeller Prozess für Löschanträge stehen noch zur Festlegung durch den Geschäftsverantwortlichen aus.',
        pending: true,
      },
      {
        title: '5. Datenschutzbeauftragter (DSGVO/LGPD) / Datenschutzkontakt',
        body: 'Formeller Kontaktkanal für Datenschutzfragen (DSGVO/LGPD) steht noch zur Festlegung durch den Geschäftsverantwortlichen aus.',
        pending: true,
      },
    ],
  },

  fr: {
    headline: 'Politique de Confidentialité',
    updatedLabel: 'Dernière mise à jour',
    intro: 'Cette page décrit quelles données personnelles Lapa Casa Rio collecte via ce site et comment elles sont utilisées.',
    pendingNotice: 'Les sections marquées "en attente" n\'ont pas encore été formalisées avec un conseil juridique et seront complétées avant toute utilisation nécessitant ce niveau de détail.',
    sections: [
      {
        title: '1. Données collectées lors de la réservation',
        body: 'Lors de la réservation, nous collectons : nom complet, e-mail, téléphone, pays, pièce d\'identité (avec photo) et heure d\'arrivée estimée. Ces données sont nécessaires pour traiter le séjour et respecter les obligations légales d\'enregistrement des clients.',
      },
      {
        title: '2. Cookies et outils d\'analyse',
        body: 'Nous utilisons Google Analytics (GA4) et Facebook Pixel uniquement si vous acceptez la bannière de cookies affichée lors de votre première visite. Votre choix est enregistré dans votre navigateur (localStorage) et peut être modifié en effaçant les données du site.',
      },
      {
        title: '3. Partage des données',
        body: 'Les données de paiement sont traitées directement par Stripe et Mercado Pago — Lapa Casa Rio ne stocke pas les numéros de carte. Les données de réservation peuvent être partagées avec les autorités lorsque la loi l\'exige.',
      },
      {
        title: '4. Conservation et suppression des données',
        body: 'Durée exacte de conservation et procédure formelle de demande de suppression des données en attente de définition par le responsable de l\'entreprise.',
        pending: true,
      },
      {
        title: '5. Responsable du traitement (RGPD/LGPD) / contact confidentialité',
        body: 'Canal de contact formel pour les questions de confidentialité (RGPD/LGPD) en attente de définition par le responsable de l\'entreprise.',
        pending: true,
      },
    ],
  },

  it: {
    headline: 'Informativa sulla Privacy',
    updatedLabel: 'Ultimo aggiornamento',
    intro: 'Questa pagina descrive quali dati personali il Lapa Casa Rio raccoglie tramite questo sito e come vengono utilizzati.',
    pendingNotice: 'Le sezioni contrassegnate come "in sospeso" non sono state ancora formalizzate con una consulenza legale e verranno completate prima di qualsiasi utilizzo che richieda tale dettaglio.',
    sections: [
      {
        title: '1. Dati raccolti al momento della prenotazione',
        body: 'Al momento della prenotazione raccogliamo: nome completo, email, telefono, paese, documento d\'identità (con foto) e orario di arrivo stimato. Questi dati sono necessari per gestire il soggiorno e adempiere agli obblighi legali di registrazione degli ospiti.',
      },
      {
        title: '2. Cookie e strumenti di analisi',
        body: 'Utilizziamo Google Analytics (GA4) e Facebook Pixel solo se accetti il banner dei cookie mostrato alla prima visita. La tua scelta viene salvata nel browser (localStorage) e può essere modificata cancellando i dati del sito.',
      },
      {
        title: '3. Condivisione dei dati',
        body: 'I dati di pagamento vengono elaborati direttamente da Stripe e Mercado Pago — il Lapa Casa Rio non memorizza i numeri di carta. I dati di prenotazione possono essere condivisi con le autorità quando richiesto dalla legge.',
      },
      {
        title: '4. Conservazione e cancellazione dei dati',
        body: 'Il periodo esatto di conservazione e la procedura formale di richiesta di cancellazione dei dati sono in attesa di definizione da parte del responsabile del business.',
        pending: true,
      },
      {
        title: '5. Responsabile del trattamento (GDPR/LGPD) / contatto privacy',
        body: 'Il canale di contatto formale per le questioni di privacy (GDPR/LGPD) è in attesa di definizione da parte del responsabile del business.',
        pending: true,
      },
    ],
  },
};

export default function PrivacyPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);
  const c = CONTENT[locale];

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3 leading-tight">
            {c.headline}
          </h1>
          <p className="text-xs text-muted-foreground mb-6">
            {c.updatedLabel}: {LAST_UPDATED}
          </p>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
            {c.intro}
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4">
        <p className="text-sm text-amber-600 dark:text-amber-400 py-6 border-b border-border">
          ⚠ {c.pendingNotice}
        </p>

        {c.sections.map((section, i) => (
          <section key={i} className="py-10 border-b border-border">
            <h2 className="text-xl font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              {section.title}
              {section.pending && (
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 border border-amber-600 dark:border-amber-400 rounded-full px-2 py-0.5">
                  pending
                </span>
              )}
            </h2>
            <p className="text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>

      <SiteFooter locale={locale} />
    </main>
  );
}
