//
// Termo de Reserva — Apartamentos. Solo apartamentos (sin dirección física,
// sin referencias al hostel). El hostel tiene su página: /termos-hospede.

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { SiteFooter } from '@/components/layout/site-footer';
import { locales, defaultLocale, type Locale } from '@/i18n';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://lapacasario.com';
const LAST_UPDATED = '2026-10-06';

const META: Record<Locale, { title: string; description: string }> = {
  pt: {
    title: "Termo de Reserva — Apartamentos — Lapa Casa Rio",
    description: "Condições de reserva, pagamento, cancelamento, check-in/check-out e regras dos apartamentos do Lapa Casa Rio.",
  },
  es: {
    title: "Términos de Reserva — Apartamentos — Lapa Casa Rio",
    description: "Condiciones de reserva, pago, cancelación, check-in/check-out y normas de los apartamentos de Lapa Casa Rio.",
  },
  en: {
    title: "Booking Terms — Apartments — Lapa Casa Rio",
    description: "Booking conditions, payment, cancellation, check-in/check-out and rules for the Lapa Casa Rio apartments.",
  },
  de: {
    title: "Buchungsbedingungen — Apartments — Lapa Casa Rio",
    description: "Buchungsbedingungen, Zahlung, Stornierung, Check-in/Check-out und Regeln der Apartments von Lapa Casa Rio.",
  },
  fr: {
    title: "Conditions de Réservation — Appartements — Lapa Casa Rio",
    description: "Conditions de réservation, paiement, annulation, arrivée/départ et règles des appartements de Lapa Casa Rio.",
  },
  it: {
    title: "Termini di Prenotazione — Appartamenti — Lapa Casa Rio",
    description: "Condizioni di prenotazione, pagamento, cancellazione, check-in/check-out e regole degli appartamenti di Lapa Casa Rio.",
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
      canonical: `${SITE_URL}/${locale}/termos-apartamentos`,
      languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}/termos-apartamentos`])),
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
    headline: "Termo de Reserva — Apartamentos",
    updatedLabel: "Última atualização",
    intro: "Este termo se aplica a todas as reservas de apartamentos feitas no Lapa Casa Rio. Ao marcar a caixa de aceite no formulário de reserva, você confirma que leu e concorda com as condições abaixo.",
    sections: [
      {
        title: "1. Confirmação da reserva e pagamento",
        body: "A reserva só é confirmada após o pagamento do sinal de 30% exibido na tela de pagamento.",
        items: [
          "Formas de pagamento do sinal: cartão de crédito ou PIX",
          "O saldo restante é pago pela plataforma (Stripe, PIX ou cartão), no dia do check-in, por link enviado na manhã do check-in",
          "Pagamentos com cartão têm acréscimo de 10%, cobrado do hóspede",
        ],
      },
      {
        title: "2. Política de cancelamento e no-show",
        body: "O depósito pago no ato da reserva é reembolsável (descontada a comissão do Lapa Casa Rio) em cancelamentos feitos com 7 dias ou mais de antecedência do check-in. Cancelamentos com menos de 7 dias de antecedência, ou no-show (não comparecimento), não têm direito a reembolso. Do sinal de 30% é deduzida a comissão do Lapa Casa Rio e o restante é reembolsado, respeitando os prazos de reembolso do processador de pagamento (Stripe).",
      },
      {
        title: "3. Check-in e check-out",
        body: "Os horários variam conforme o apartamento:",
        items: [
          "Check-in: a partir das 14h ou das 16h (dependendo do apartamento), até as 22h",
          "Check-out: até as 10h ou até as 12h, dependendo do apartamento",
          "O horário exato do seu apartamento aparece em \"Informações importantes\" na tela de reserva e é confirmado pela equipe antes da chegada",
        ],
      },
      {
        title: "4. Documentação e idade mínima",
        body: "O envio da foto de um documento de identidade válido é obrigatório para todas as pessoas hospedadas, sem exceção. A hospedagem é restrita a maiores de 18 anos.",
      },
      {
        title: "5. Regras de cada apartamento",
        body: "Cada apartamento pode ter regras próprias (por exemplo, sobre fumar ou capacidade). Elas aparecem em \"Informações importantes\" na tela de reserva e, ao confirmar, você declara estar ciente delas.",
      },
      {
        title: "6. Dados pessoais",
        body: "Os dados fornecidos na reserva (nome, documento, contato) são usados exclusivamente para processar a hospedagem e cumprir obrigações legais de registro de hóspedes.",
      },
      {
        title: "7. Programa de indicação de amigos",
        body: "Ao concluir uma reserva, o hóspede recebe um código de desconto pessoal (10%) para compartilhar com amigos.",
        items: [
          "O código dá ao amigo 10% de desconto na reserva",
          "Após o check-out do amigo que usou o código, o titular recebe R$5 de desconto para uma futura estadia",
          "Os códigos são válidos até 31/12/2026",
          "Os códigos não são aplicáveis em reservas que incluam feriados nacionais do Brasil",
          "Cada código pode ser utilizado uma única vez por hóspede",
          "Não é permitido o uso do próprio código (auto-indicação)",
          "O benefício de R$5 é creditado somente após o check-out confirmado da reserva que utilizou o código",
        ],
      },
      {
        title: "8. Alterações a este termo",
        body: "Este termo pode ser atualizado para refletir mudanças nas políticas operacionais dos apartamentos. A versão vigente é sempre a publicada nesta página no momento da reserva.",
      },
    ],
    privacyLinkText: "Veja também nossa Política de Privacidade",
  },
  es: {
    headline: "Términos de Reserva — Apartamentos",
    updatedLabel: "Última actualización",
    intro: "Estos términos se aplican a todas las reservas de apartamentos realizadas en Lapa Casa Rio. Al marcar la casilla de aceptación en el formulario de reserva, confirmás que leíste y aceptás las condiciones a continuación.",
    sections: [
      {
        title: "1. Confirmación de la reserva y pago",
        body: "La reserva se confirma únicamente tras el pago de la señal del 30% indicada en la pantalla de pago.",
        items: [
          "Formas de pago de la señal: tarjeta de crédito o PIX",
          "El saldo restante se paga por la plataforma (Stripe, PIX o tarjeta), el día del check-in, mediante un link enviado la mañana del check-in",
          "Los pagos con tarjeta tienen un recargo del 10%, a cargo del huésped",
        ],
      },
      {
        title: "2. Política de cancelación y no-show",
        body: "El depósito abonado al reservar es reembolsable (descontada la comisión de Lapa Casa Rio) si la cancelación se realiza con 7 días o más de anticipación al check-in. Las cancelaciones con menos de 7 días de anticipación, o el no-show (no presentarse), no tienen derecho a reembolso. De la señal del 30% se deduce la comisión de Lapa Casa Rio y el resto se reembolsa, respetando los plazos de reembolso del procesador de pago (Stripe).",
      },
      {
        title: "3. Check-in y check-out",
        body: "Los horarios varían según el apartamento:",
        items: [
          "Check-in: a partir de las 14h o las 16h (según el apartamento), hasta las 22h",
          "Check-out: hasta las 10h o hasta las 12h, según el apartamento",
          "El horario exacto de tu apartamento aparece en \"Informaciones importantes\" en la pantalla de reserva y el equipo lo confirma antes de la llegada",
        ],
      },
      {
        title: "4. Documentación y edad mínima",
        body: "El envío de la foto de un documento de identidad válido es obligatorio para todas las personas alojadas, sin excepción. El hospedaje está restringido a mayores de 18 años.",
      },
      {
        title: "5. Normas de cada apartamento",
        body: "Cada apartamento puede tener normas propias (por ejemplo, sobre fumar o capacidad). Aparecen en \"Informaciones importantes\" en la pantalla de reserva y, al confirmar, declarás estar al tanto de ellas.",
      },
      {
        title: "6. Datos personales",
        body: "Los datos proporcionados en la reserva (nombre, documento, contacto) se usan exclusivamente para procesar el hospedaje y cumplir obligaciones legales de registro de huéspedes.",
      },
      {
        title: "7. Programa de referidos",
        body: "Al completar una reserva, el huésped recibe un código de descuento personal (10%) para compartir con amigos.",
        items: [
          "El código da a un amigo un 10% de descuento en la reserva",
          "Después del check-out del amigo que usó el código, el titular recibe R$5 de descuento para una futura estadía",
          "Los códigos son válidos hasta el 31/12/2026",
          "Los códigos no son aplicables a reservas que incluyan feriados nacionales de Brasil",
          "Cada código puede usarse una sola vez por huésped",
          "No se permite usar el propio código (autorreferido)",
          "El beneficio de R$5 se acredita solo después del check-out confirmado de la reserva que usó el código",
        ],
      },
      {
        title: "8. Cambios en estos términos",
        body: "Estos términos pueden actualizarse para reflejar cambios en las políticas operativas de los apartamentos. La versión vigente es siempre la publicada en esta página al momento de la reserva.",
      },
    ],
    privacyLinkText: "Consultá también nuestra Política de Privacidad",
  },
  en: {
    headline: "Booking Terms — Apartments",
    updatedLabel: "Last updated",
    intro: "These terms apply to all apartment bookings made at Lapa Casa Rio. By checking the acceptance box on the booking form, you confirm you have read and agree to the conditions below.",
    sections: [
      {
        title: "1. Booking confirmation and payment",
        body: "The booking is confirmed only after payment of the 30% deposit shown on the payment screen.",
        items: [
          "Deposit payment methods: credit card or PIX",
          "The remaining balance is paid through the platform (Stripe, PIX or card) on the check-in day, via a link sent on the morning of check-in",
          "Card payments carry a 10% surcharge, paid by the guest",
        ],
      },
      {
        title: "2. Cancellation and no-show policy",
        body: "The deposit paid at booking is refundable (less the Lapa Casa Rio commission) if cancelled 7 or more days before check-in. Cancellations made less than 7 days before check-in, or a no-show, are not eligible for a refund. Lapa Casa Rio's commission is deducted from the 30% deposit and the remainder is refunded, following the refund timelines of the payment processor (Stripe).",
      },
      {
        title: "3. Check-in and check-out",
        body: "Times vary by apartment:",
        items: [
          "Check-in: from 14:00 or 16:00 (depending on the apartment) until 22:00",
          "Check-out: by 10:00 or by 12:00, depending on the apartment",
          "The exact times for your apartment appear under \"Important information\" on the booking screen and are confirmed by our team before arrival",
        ],
      },
      {
        title: "4. Documentation and minimum age",
        body: "Uploading a photo of a valid ID is mandatory for all guests staying, no exceptions. Accommodation is restricted to guests 18 or older.",
      },
      {
        title: "5. Rules of each apartment",
        body: "Each apartment may have its own rules (for example, on smoking or capacity). They appear under \"Important information\" on the booking screen and, by confirming, you declare you are aware of them.",
      },
      {
        title: "6. Personal data",
        body: "Data provided at booking (name, ID, contact details) is used exclusively to process the stay and comply with legal guest-registration requirements.",
      },
      {
        title: "7. Friend referral programme",
        body: "Upon completing a booking, guests receive a personal discount code (10%) to share with friends.",
        items: [
          "The code gives a friend 10% off the booking",
          "After the friend who used the code checks out, the code owner receives R$5 off a future stay",
          "Codes are valid until 31 Dec 2026",
          "Codes cannot be applied to bookings that include Brazilian national public holidays",
          "Each code may be used once per guest",
          "Self-referral (using your own code) is not permitted",
          "The R$5 credit is applied only after the confirmed check-out of the booking that used the code",
        ],
      },
      {
        title: "8. Changes to these terms",
        body: "These terms may be updated to reflect changes in the apartments' operating policies. The version in effect is always the one published on this page at the time of booking.",
      },
    ],
    privacyLinkText: "See also our Privacy Policy",
  },
  de: {
    headline: "Buchungsbedingungen — Apartments",
    updatedLabel: "Zuletzt aktualisiert",
    intro: "Diese Bedingungen gelten für alle Apartment-Buchungen bei Lapa Casa Rio. Mit dem Ankreuzen des Zustimmungsfelds im Buchungsformular bestätigen Sie, die folgenden Bedingungen gelesen zu haben und ihnen zuzustimmen.",
    sections: [
      {
        title: "1. Buchungsbestätigung und Zahlung",
        body: "Die Buchung ist erst nach Zahlung der auf dem Zahlungsbildschirm angezeigten Anzahlung von 30% bestätigt.",
        items: [
          "Zahlungsarten für die Anzahlung: Kreditkarte oder PIX",
          "Der Restbetrag wird über die Plattform bezahlt (Stripe, PIX oder Karte), am Tag des Check-ins, über einen Link, der am Morgen des Check-ins versendet wird",
          "Kartenzahlungen unterliegen einem Aufschlag von 10%, den der Gast trägt",
        ],
      },
      {
        title: "2. Stornierung und No-Show",
        body: "Die bei der Buchung gezahlte Anzahlung wird (abzüglich der Provision von Lapa Casa Rio) erstattet, wenn die Stornierung 7 Tage oder mehr vor dem Check-in erfolgt. Stornierungen weniger als 7 Tage vor dem Check-in oder Nichterscheinen (No-Show) berechtigen nicht zur Rückerstattung. Von der Anzahlung von 30% wird die Provision von Lapa Casa Rio abgezogen und der Rest erstattet, unter Beachtung der Erstattungsfristen des Zahlungsdienstleisters (Stripe).",
      },
      {
        title: "3. Check-in und Check-out",
        body: "Die Zeiten variieren je nach Apartment:",
        items: [
          "Check-in: ab 14:00 oder 16:00 Uhr (je nach Apartment) bis 22:00 Uhr",
          "Check-out: bis 10:00 oder bis 12:00 Uhr, je nach Apartment",
          "Die genauen Zeiten Ihres Apartments stehen unter \"Wichtige Informationen\" im Buchungsschritt und werden von unserem Team vor der Anreise bestätigt",
        ],
      },
      {
        title: "4. Ausweis und Mindestalter",
        body: "Das Hochladen eines Fotos eines gültigen Ausweisdokuments ist für alle Gäste ausnahmslos verpflichtend. Die Unterkunft ist Personen ab 18 Jahren vorbehalten.",
      },
      {
        title: "5. Regeln des jeweiligen Apartments",
        body: "Jedes Apartment kann eigene Regeln haben (z. B. zum Rauchen oder zur Belegung). Sie erscheinen unter \"Wichtige Informationen\" im Buchungsschritt; mit der Bestätigung erklären Sie, diese zur Kenntnis genommen zu haben.",
      },
      {
        title: "6. Personenbezogene Daten",
        body: "Die bei der Buchung angegebenen Daten (Name, Ausweis, Kontakt) werden ausschließlich zur Abwicklung des Aufenthalts und zur Erfüllung gesetzlicher Meldepflichten verwendet.",
      },
      {
        title: "7. Freunde-werben-Programm",
        body: "Nach Abschluss einer Buchung erhalten Gäste einen persönlichen Rabattcode (10%), den sie mit Freunden teilen können.",
        items: [
          "Der Code gibt einem Freund 10% Rabatt auf die Buchung",
          "Nach dem Check-out des Freundes, der den Code verwendet hat, erhält der Code-Inhaber R$5 Rabatt auf einen künftigen Aufenthalt",
          "Die Codes sind bis zum 31.12.2026 gültig",
          "Die Codes gelten nicht für Buchungen, die brasilianische Feiertage enthalten",
          "Jeder Code kann pro Gast nur einmal verwendet werden",
          "Die Verwendung des eigenen Codes (Selbstempfehlung) ist nicht erlaubt",
          "Die Gutschrift von R$5 erfolgt erst nach dem bestätigten Check-out der Buchung, bei der der Code verwendet wurde",
        ],
      },
      {
        title: "8. Änderungen dieser Bedingungen",
        body: "Diese Bedingungen können aktualisiert werden, um Änderungen der Betriebsrichtlinien der Apartments widerzuspiegeln. Maßgeblich ist stets die zum Zeitpunkt der Buchung auf dieser Seite veröffentlichte Version.",
      },
    ],
    privacyLinkText: "Siehe auch unsere Datenschutzerklärung",
  },
  fr: {
    headline: "Conditions de Réservation — Appartements",
    updatedLabel: "Dernière mise à jour",
    intro: "Ces conditions s'appliquent à toutes les réservations d'appartements effectuées chez Lapa Casa Rio. En cochant la case d'acceptation du formulaire de réservation, vous confirmez avoir lu et accepté les conditions ci-dessous.",
    sections: [
      {
        title: "1. Confirmation de la réservation et paiement",
        body: "La réservation n'est confirmée qu'après le paiement de l'acompte de 30% indiqué sur l'écran de paiement.",
        items: [
          "Modes de paiement de l'acompte : carte de crédit ou PIX",
          "Le solde est réglé via la plateforme (Stripe, PIX ou carte), le jour du check-in, par un lien envoyé le matin du check-in",
          "Les paiements par carte comportent une majoration de 10%, à la charge du client",
        ],
      },
      {
        title: "2. Politique d'annulation et no-show",
        body: "L'acompte versé lors de la réservation est remboursé (déduction faite de la commission de Lapa Casa Rio) en cas d'annulation effectuée 7 jours ou plus avant le check-in. Les annulations effectuées moins de 7 jours avant le check-in, ou une non-présentation (no-show), ne donnent pas droit à un remboursement. La commission de Lapa Casa Rio est déduite de l'acompte de 30% et le reste est remboursé, dans le respect des délais de remboursement du prestataire de paiement (Stripe).",
      },
      {
        title: "3. Arrivée et départ",
        body: "Les horaires varient selon l'appartement :",
        items: [
          "Arrivée : à partir de 14h ou 16h (selon l'appartement), jusqu'à 22h",
          "Départ : avant 10h ou avant 12h, selon l'appartement",
          "Les horaires exacts de votre appartement figurent dans « Informations importantes » lors de la réservation et sont confirmés par notre équipe avant votre arrivée",
        ],
      },
      {
        title: "4. Documents et âge minimum",
        body: "L'envoi de la photo d'une pièce d'identité valide est obligatoire pour toutes les personnes hébergées, sans exception. L'hébergement est réservé aux personnes majeures (18 ans et plus).",
      },
      {
        title: "5. Règles de chaque appartement",
        body: "Chaque appartement peut avoir ses propres règles (par exemple sur le tabac ou la capacité). Elles figurent dans « Informations importantes » lors de la réservation et, en confirmant, vous déclarez en avoir pris connaissance.",
      },
      {
        title: "6. Données personnelles",
        body: "Les données fournies lors de la réservation (nom, pièce d'identité, contact) sont utilisées exclusivement pour traiter le séjour et respecter les obligations légales d'enregistrement des voyageurs.",
      },
      {
        title: "7. Programme de parrainage",
        body: "À l'issue d'une réservation, le client reçoit un code de réduction personnel (10%) à partager avec ses amis.",
        items: [
          "Le code offre à un ami 10% de réduction sur la réservation",
          "Après le départ de l'ami ayant utilisé le code, le titulaire reçoit R$5 de réduction sur un futur séjour",
          "Les codes sont valables jusqu'au 31/12/2026",
          "Les codes ne s'appliquent pas aux réservations incluant des jours fériés nationaux au Brésil",
          "Chaque code ne peut être utilisé qu'une seule fois par client",
          "L'utilisation de son propre code (auto-parrainage) n'est pas autorisée",
          "Le crédit de R$5 n'est appliqué qu'après le départ confirmé de la réservation ayant utilisé le code",
        ],
      },
      {
        title: "8. Modifications de ces conditions",
        body: "Ces conditions peuvent être mises à jour pour refléter les changements des politiques opérationnelles des appartements. La version en vigueur est toujours celle publiée sur cette page au moment de la réservation.",
      },
    ],
    privacyLinkText: "Consultez aussi notre Politique de Confidentialité",
  },
  it: {
    headline: "Termini di Prenotazione — Appartamenti",
    updatedLabel: "Ultimo aggiornamento",
    intro: "Questi termini si applicano a tutte le prenotazioni di appartamenti effettuate presso Lapa Casa Rio. Selezionando la casella di accettazione nel modulo di prenotazione, confermi di aver letto e accettato le condizioni seguenti.",
    sections: [
      {
        title: "1. Conferma della prenotazione e pagamento",
        body: "La prenotazione è confermata solo dopo il pagamento della caparra del 30% indicata nella schermata di pagamento.",
        items: [
          "Metodi di pagamento della caparra: carta di credito o PIX",
          "Il saldo viene pagato tramite la piattaforma (Stripe, PIX o carta), il giorno del check-in, con un link inviato la mattina del check-in",
          "I pagamenti con carta prevedono una maggiorazione del 10%, a carico dell'ospite",
        ],
      },
      {
        title: "2. Politica di cancellazione e no-show",
        body: "La caparra pagata al momento della prenotazione è rimborsabile (al netto della commissione di Lapa Casa Rio) in caso di cancellazione effettuata con 7 giorni o più di anticipo rispetto al check-in. Le cancellazioni con meno di 7 giorni di anticipo, o il no-show, non danno diritto al rimborso. Dalla caparra del 30% viene detratta la commissione di Lapa Casa Rio e il resto viene rimborsato, nel rispetto dei tempi di rimborso del processore di pagamento (Stripe).",
      },
      {
        title: "3. Check-in e check-out",
        body: "Gli orari variano a seconda dell'appartamento:",
        items: [
          "Check-in: dalle 14:00 o dalle 16:00 (a seconda dell'appartamento) fino alle 22:00",
          "Check-out: entro le 10:00 o entro le 12:00, a seconda dell'appartamento",
          "Gli orari esatti del tuo appartamento compaiono in «Informazioni importanti» nella schermata di prenotazione e sono confermati dal nostro team prima dell'arrivo",
        ],
      },
      {
        title: "4. Documenti ed età minima",
        body: "L'invio della foto di un documento d'identità valido è obbligatorio per tutte le persone alloggiate, senza eccezioni. L'alloggio è riservato ai maggiori di 18 anni.",
      },
      {
        title: "5. Regole di ciascun appartamento",
        body: "Ogni appartamento può avere regole proprie (ad esempio su fumo o capienza). Compaiono in «Informazioni importanti» nella schermata di prenotazione e, confermando, dichiari di averne preso atto.",
      },
      {
        title: "6. Dati personali",
        body: "I dati forniti al momento della prenotazione (nome, documento, contatti) sono utilizzati esclusivamente per gestire il soggiorno e adempiere agli obblighi legali di registrazione degli ospiti.",
      },
      {
        title: "7. Programma di presentazione amici",
        body: "Al termine di una prenotazione, l'ospite riceve un codice sconto personale (10%) da condividere con gli amici.",
        items: [
          "Il codice offre a un amico il 10% di sconto sulla prenotazione",
          "Dopo il check-out dell'amico che ha usato il codice, il titolare riceve R$5 di sconto per un soggiorno futuro",
          "I codici sono validi fino al 31/12/2026",
          "I codici non sono applicabili a prenotazioni che includono festività nazionali del Brasile",
          "Ogni codice può essere usato una sola volta per ospite",
          "Non è consentito usare il proprio codice (auto-presentazione)",
          "Il credito di R$5 viene accreditato solo dopo il check-out confermato della prenotazione che ha usato il codice",
        ],
      },
      {
        title: "8. Modifiche a questi termini",
        body: "Questi termini possono essere aggiornati per riflettere modifiche alle politiche operative degli appartamenti. La versione in vigore è sempre quella pubblicata in questa pagina al momento della prenotazione.",
      },
    ],
    privacyLinkText: "Consulta anche la nostra Informativa sulla Privacy",
  },
};

export default function ApartmentTermsPage({ params }: { params: { locale: string } }) {
  const locale = (locales.includes(params.locale as Locale) ? params.locale : defaultLocale) as Locale;
  setRequestLocale(locale);
  const c = CONTENT[locale];

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3 leading-tight">
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
            <h2 className="text-xl font-serif font-semibold text-foreground mb-3">
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
