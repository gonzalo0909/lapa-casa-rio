// lapa-casa-hostel/frontend/src/app/[locale]/termos-hospede/page.tsx
//
// Termo de Reserva e Hospedagem — página real, antes inexistente.
// apartment-guest-form.tsx linkeaba a "/termos-hospede" (checkbox de
// aceite obligatorio para reservar) mas a rota nunca existió: 404 en
// producción en un paso crítico del flujo de pago (sección 14, auditoría
// de 17 secciones).
//
// Contenido basado únicamente en políticas verificadas en el código real:
// - Depósito no reembolsable ante cancelación o no-show, sin excepción
//   (migración backend/database/migrations/0014_no_refund_cancellation_policy.sql)
// - Horarios y reglas de check-in/check-out (hostel-info-banner.tsx)
// No incluye cláusulas que no se pudieron verificar en el sistema real.

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';
const LAST_UPDATED = '2026-08-31';

const META: Record<Locale, { title: string; description: string }> = {
  pt: {
    title: 'Termo de Reserva e Hospedagem — Lapa Casa Rio',
    description: 'Condições de reserva, política de cancelamento, check-in/check-out e regras da casa do Lapa Casa Rio.',
  },
  es: {
    title: 'Términos de Reserva y Hospedaje — Lapa Casa Rio',
    description: 'Condiciones de reserva, política de cancelación, check-in/check-out y normas de la casa de Lapa Casa Rio.',
  },
  en: {
    title: 'Booking & Stay Terms — Lapa Casa Rio',
    description: 'Booking conditions, cancellation policy, check-in/check-out and house rules for Lapa Casa Rio.',
  },
  de: {
    title: 'Buchungs- und Aufenthaltsbedingungen — Lapa Casa Rio',
    description: 'Buchungsbedingungen, Stornierungsrichtlinie, Check-in/Check-out und Hausordnung des Lapa Casa Rio.',
  },
  fr: {
    title: 'Conditions de Réservation et de Séjour — Lapa Casa Rio',
    description: "Conditions de réservation, politique d'annulation, arrivée/départ et règlement intérieur du Lapa Casa Rio.",
  },
  it: {
    title: 'Termini di Prenotazione e Soggiorno — Lapa Casa Rio',
    description: 'Condizioni di prenotazione, politica di cancellazione, check-in/check-out e regolamento della casa del Lapa Casa Rio.',
  },
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
      canonical: `${SITE_URL}/${locale}/termos-hospede`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/termos-hospede`])),
    },
    robots: { index: true, follow: true },
  };
}

interface Section {
  title: string;
  body: string;
  items?: string[];
}

interface Content {
  headline: string;
  updatedLabel: string;
  intro: string;
  sections: Section[];
  privacyLinkText: string;
}

const CONTENT: Record<Locale, Content> = {
  pt: {
    headline: 'Termo de Reserva e Hospedagem',
    updatedLabel: 'Última atualização',
    intro: 'Este termo se aplica a todas as reservas feitas no Lapa Casa Rio (dormitórios compartilhados e apartamentos), Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro. Ao marcar a caixa de aceite no formulário de reserva, você confirma que leu e concorda com as condições abaixo.',
    sections: [
      {
        title: '1. Confirmação da reserva',
        body: 'A reserva só é confirmada após o pagamento do depósito exibido na tela de pagamento. O valor restante é pago no check-in.',
        items: [
          'Formas de pagamento do depósito: PIX ou cartão de crédito/débito',
          'O valor restante é pago no check-in, diretamente à equipe do hostel (PIX ou cartão, conforme disponibilidade no momento)',
        ],
      },
      {
        title: '2. Política de cancelamento e no-show',
        body: 'O depósito pago no ato da reserva não é reembolsável em nenhuma circunstância — seja por cancelamento a qualquer momento, seja por no-show (não comparecimento) —, independentemente da antecedência do aviso.',
      },
      {
        title: '3. Check-in e check-out',
        body: 'Horários padrão de entrada e saída:',
        items: [
          'Check-in: das 14h às 22h',
          'Check-out: até as 12h',
          'Chegadas fora do horário de check-in ou saídas mais tarde precisam ser combinadas com antecedência e podem exigir a reserva de uma noite adicional',
        ],
      },
      {
        title: '4. Documentação e idade mínima',
        body: 'O envio da foto de um documento de identidade válido é obrigatório para todos os hóspedes, sem exceção. A hospedagem é restrita a maiores de 18 anos.',
      },
      {
        title: '5. Regras da casa',
        body: 'É proibido fumar dentro do hostel e em todas as áreas comuns.',
      },
      {
        title: '6. Dados pessoais',
        body: 'Os dados fornecidos na reserva (nome, documento, contato) são usados exclusivamente para processar a hospedagem e cumprir obrigações legais de registro de hóspedes.',
      },
      {
        title: '7. Alterações a este termo',
        body: 'Este termo pode ser atualizado para refletir mudanças nas políticas operacionais do hostel. A versão vigente é sempre a publicada nesta página no momento da reserva.',
      },
    ],
    privacyLinkText: 'Veja também nossa Política de Privacidade',
  },

  es: {
    headline: 'Términos de Reserva y Hospedaje',
    updatedLabel: 'Última actualización',
    intro: 'Estos términos se aplican a todas las reservas realizadas en Lapa Casa Rio (dormitorios compartidos y apartamentos), Rua Silvio Romero 22, Santa Teresa, Río de Janeiro. Al marcar la casilla de aceptación en el formulario de reserva, confirmás que leíste y aceptás las condiciones a continuación.',
    sections: [
      {
        title: '1. Confirmación de la reserva',
        body: 'La reserva se confirma únicamente tras el pago del depósito indicado en la pantalla de pago. El saldo restante se abona en el check-in.',
        items: [
          'Formas de pago del depósito: PIX o tarjeta de crédito/débito',
          'El saldo se abona en el check-in, directamente al personal del hostel (PIX o tarjeta, según disponibilidad en el momento)',
        ],
      },
      {
        title: '2. Política de cancelación y no-show',
        body: 'El depósito abonado al reservar no es reembolsable bajo ninguna circunstancia — ya sea por cancelación en cualquier momento o por no-show (no presentarse) —, sin importar la anticipación del aviso.',
      },
      {
        title: '3. Check-in y check-out',
        body: 'Horarios estándar de entrada y salida:',
        items: [
          'Check-in: de 14h a 22h',
          'Check-out: hasta las 12h',
          'Llegadas fuera del horario de check-in o salidas más tarde deben coordinarse con anticipación y pueden requerir reservar una noche adicional',
        ],
      },
      {
        title: '4. Documentación y edad mínima',
        body: 'El envío de la foto de un documento de identidad válido es obligatorio para todos los huéspedes, sin excepción. El hospedaje está restringido a mayores de 18 años.',
      },
      {
        title: '5. Normas de la casa',
        body: 'Está prohibido fumar dentro del hostel y en todas las áreas comunes.',
      },
      {
        title: '6. Datos personales',
        body: 'Los datos proporcionados en la reserva (nombre, documento, contacto) se usan exclusivamente para gestionar el hospedaje y cumplir obligaciones legales de registro de huéspedes.',
      },
      {
        title: '7. Cambios a estos términos',
        body: 'Estos términos pueden actualizarse para reflejar cambios en las políticas operativas del hostel. La versión vigente es siempre la publicada en esta página al momento de la reserva.',
      },
    ],
    privacyLinkText: 'Consultá también nuestra Política de Privacidad',
  },

  en: {
    headline: 'Booking & Stay Terms',
    updatedLabel: 'Last updated',
    intro: 'These terms apply to all bookings made at Lapa Casa Rio (shared dorms and apartments), Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro. By checking the acceptance box on the booking form, you confirm you have read and agree to the conditions below.',
    sections: [
      {
        title: '1. Booking confirmation',
        body: 'The booking is confirmed only after payment of the deposit shown on the payment screen. The remaining balance is paid at check-in.',
        items: [
          'Deposit payment methods: PIX or credit/debit card',
          'The remaining balance is paid at check-in, directly to hostel staff (PIX or card, subject to availability at the time)',
        ],
      },
      {
        title: '2. Cancellation and no-show policy',
        body: 'The deposit paid at booking is non-refundable under any circumstance — whether due to cancellation at any time or no-show — regardless of how much notice is given.',
      },
      {
        title: '3. Check-in and check-out',
        body: 'Standard arrival and departure times:',
        items: [
          'Check-in: 2 pm to 10 pm',
          'Check-out: by 12 pm',
          'Arrivals outside check-in hours or later departures must be arranged in advance and may require booking an extra night',
        ],
      },
      {
        title: '4. Documentation and minimum age',
        body: 'Uploading a photo of a valid ID is mandatory for all guests, no exceptions. Accommodation is restricted to guests 18 or older.',
      },
      {
        title: '5. House rules',
        body: 'Smoking is prohibited inside the hostel and in all common areas.',
      },
      {
        title: '6. Personal data',
        body: 'Data provided at booking (name, ID, contact details) is used exclusively to process the stay and comply with legal guest-registration requirements.',
      },
      {
        title: '7. Changes to these terms',
        body: 'These terms may be updated to reflect changes in the hostel\'s operating policies. The version in effect is always the one published on this page at the time of booking.',
      },
    ],
    privacyLinkText: 'See also our Privacy Policy',
  },

  de: {
    headline: 'Buchungs- und Aufenthaltsbedingungen',
    updatedLabel: 'Zuletzt aktualisiert',
    intro: 'Diese Bedingungen gelten für alle Buchungen im Lapa Casa Rio (Gemeinschaftsschlafsäle und Apartments), Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro. Mit dem Ankreuzen des Zustimmungsfelds im Buchungsformular bestätigen Sie, die folgenden Bedingungen gelesen zu haben und ihnen zuzustimmen.',
    sections: [
      {
        title: '1. Buchungsbestätigung',
        body: 'Die Buchung wird erst nach Zahlung der auf dem Zahlungsbildschirm angezeigten Anzahlung bestätigt. Der Restbetrag wird beim Check-in bezahlt.',
        items: [
          'Zahlungsarten für die Anzahlung: PIX oder Kredit-/Debitkarte',
          'Der Restbetrag wird beim Check-in direkt beim Hostelpersonal bezahlt (PIX oder Karte, je nach Verfügbarkeit vor Ort)',
        ],
      },
      {
        title: '2. Stornierungs- und No-Show-Richtlinie',
        body: 'Die bei der Buchung gezahlte Anzahlung ist unter keinen Umständen erstattungsfähig — weder bei Stornierung zu irgendeinem Zeitpunkt noch bei Nichterscheinen —, unabhängig von der Vorlaufzeit der Mitteilung.',
      },
      {
        title: '3. Check-in und Check-out',
        body: 'Standardzeiten für Ankunft und Abreise:',
        items: [
          'Check-in: 14 bis 22 Uhr',
          'Check-out: bis 12 Uhr',
          'Ankünfte außerhalb der Check-in-Zeiten oder spätere Abreisen müssen im Voraus vereinbart werden und können die Buchung einer zusätzlichen Nacht erfordern',
        ],
      },
      {
        title: '4. Dokumentation und Mindestalter',
        body: 'Das Hochladen eines Fotos eines gültigen Ausweisdokuments ist für alle Gäste verpflichtend, ohne Ausnahme. Die Unterkunft ist Gästen ab 18 Jahren vorbehalten.',
      },
      {
        title: '5. Hausordnung',
        body: 'Rauchen ist im gesamten Hostel und in allen Gemeinschaftsbereichen verboten.',
      },
      {
        title: '6. Personenbezogene Daten',
        body: 'Die bei der Buchung angegebenen Daten (Name, Ausweis, Kontaktdaten) werden ausschließlich zur Abwicklung des Aufenthalts und zur Erfüllung gesetzlicher Meldepflichten verwendet.',
      },
      {
        title: '7. Änderungen dieser Bedingungen',
        body: 'Diese Bedingungen können aktualisiert werden, um Änderungen der Betriebsrichtlinien des Hostels widerzuspiegeln. Maßgeblich ist immer die zum Zeitpunkt der Buchung auf dieser Seite veröffentlichte Fassung.',
      },
    ],
    privacyLinkText: 'Siehe auch unsere Datenschutzrichtlinie',
  },

  fr: {
    headline: 'Conditions de Réservation et de Séjour',
    updatedLabel: 'Dernière mise à jour',
    intro: "Ces conditions s'appliquent à toutes les réservations effectuées au Lapa Casa Rio (dortoirs partagés et appartements), Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro. En cochant la case d'acceptation du formulaire de réservation, vous confirmez avoir lu et accepté les conditions ci-dessous.",
    sections: [
      {
        title: '1. Confirmation de la réservation',
        body: "La réservation n'est confirmée qu'après le paiement de l'acompte indiqué sur l'écran de paiement. Le solde restant est réglé à l'arrivée.",
        items: [
          "Moyens de paiement de l'acompte : PIX ou carte de crédit/débit",
          "Le solde est réglé à l'arrivée, directement auprès du personnel du hostel (PIX ou carte, selon disponibilité sur place)",
        ],
      },
      {
        title: "2. Politique d'annulation et de non-présentation",
        body: "L'acompte versé lors de la réservation n'est remboursable en aucune circonstance — que ce soit en cas d'annulation à tout moment ou de non-présentation (no-show) —, quel que soit le délai de préavis.",
      },
      {
        title: '3. Arrivée et départ',
        body: "Horaires standard d'arrivée et de départ :",
        items: [
          'Arrivée : de 14h à 22h',
          'Départ : avant 12h',
          "Les arrivées en dehors des horaires ou les départs plus tardifs doivent être convenus à l'avance et peuvent nécessiter la réservation d'une nuit supplémentaire",
        ],
      },
      {
        title: "4. Pièce d'identité et âge minimum",
        body: "L'envoi de la photo d'une pièce d'identité valide est obligatoire pour tous les clients, sans exception. L'hébergement est réservé aux personnes de 18 ans et plus.",
      },
      {
        title: '5. Règlement intérieur',
        body: "Il est interdit de fumer à l'intérieur du hostel et dans tous les espaces communs.",
      },
      {
        title: '6. Données personnelles',
        body: 'Les données fournies lors de la réservation (nom, pièce d\'identité, coordonnées) sont utilisées exclusivement pour gérer le séjour et respecter les obligations légales d\'enregistrement des clients.',
      },
      {
        title: '7. Modifications de ces conditions',
        body: "Ces conditions peuvent être mises à jour pour refléter des changements dans les politiques opérationnelles du hostel. La version en vigueur est toujours celle publiée sur cette page au moment de la réservation.",
      },
    ],
    privacyLinkText: 'Consultez aussi notre Politique de Confidentialité',
  },

  it: {
    headline: 'Termini di Prenotazione e Soggiorno',
    updatedLabel: 'Ultimo aggiornamento',
    intro: 'Questi termini si applicano a tutte le prenotazioni effettuate presso il Lapa Casa Rio (dormitori condivisi e appartamenti), Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro. Selezionando la casella di accettazione nel modulo di prenotazione, confermi di aver letto e accettato le condizioni seguenti.',
    sections: [
      {
        title: '1. Conferma della prenotazione',
        body: 'La prenotazione viene confermata solo dopo il pagamento della caparra indicata nella schermata di pagamento. Il saldo restante viene versato al check-in.',
        items: [
          'Metodi di pagamento della caparra: PIX o carta di credito/debito',
          "Il saldo viene versato al check-in, direttamente al personale dell'hostel (PIX o carta, in base alla disponibilità sul momento)",
        ],
      },
      {
        title: '2. Politica di cancellazione e no-show',
        body: 'La caparra pagata al momento della prenotazione non è rimborsabile in nessuna circostanza — sia in caso di cancellazione in qualsiasi momento sia in caso di no-show —, indipendentemente dal preavviso.',
      },
      {
        title: '3. Check-in e check-out',
        body: 'Orari standard di arrivo e partenza:',
        items: [
          'Check-in: dalle 14 alle 22',
          'Check-out: entro le 12',
          'Arrivi fuori orario o partenze posticipate devono essere concordati in anticipo e possono richiedere la prenotazione di una notte aggiuntiva',
        ],
      },
      {
        title: '4. Documento e età minima',
        body: "L'invio della foto di un documento d'identità valido è obbligatorio per tutti gli ospiti, senza eccezioni. Il soggiorno è riservato a persone maggiorenni (18+).",
      },
      {
        title: '5. Regolamento della casa',
        body: "È vietato fumare all'interno dell'hostel e in tutte le aree comuni.",
      },
      {
        title: '6. Dati personali',
        body: 'I dati forniti al momento della prenotazione (nome, documento, contatti) vengono utilizzati esclusivamente per gestire il soggiorno e adempiere agli obblighi legali di registrazione degli ospiti.',
      },
      {
        title: '7. Modifiche a questi termini',
        body: "Questi termini possono essere aggiornati per riflettere modifiche alle politiche operative dell'hostel. La versione in vigore è sempre quella pubblicata in questa pagina al momento della prenotazione.",
      },
    ],
    privacyLinkText: 'Consulta anche la nostra Informativa sulla Privacy',
  },
};

export default function TermsPage({ params }: { params: { locale: string } }) {
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
        {c.sections.map((section, i) => (
          <section key={i} className="py-10 border-b border-border">
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">
              {section.title}
            </h2>
            <p className="text-muted-foreground mb-4">{section.body}</p>
            {section.items && (
              <ul className="space-y-2">
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

        <div className="py-8 text-sm text-muted-foreground">
          <Link href={`/${locale}/privacy`} className="underline hover:text-foreground transition-colors">
            {c.privacyLinkText}
          </Link>
        </div>
      </div>

      <SiteFooter locale={locale} />
    </main>
  );
}
