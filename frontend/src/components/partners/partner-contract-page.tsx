// lapa-casa-hostel/frontend/src/components/partners/partner-contract-page.tsx
//
// Página pública para administradores de propiedad interesados en sumar
// su apartamento a Lapa Casa. Antes mostraba el contrato legal completo
// (12 cláusulas) de entrada -- reemplazado por un pitch de beneficios +
// contacto, a pedido del dueño: el contrato se comparte recién cuando el
// interesado ya tiene decidido avanzar, no antes. Reescrito además con
// las clases Tailwind del resto del sitio (antes tenía estilos inline
// propios, sin relación visual con la home).
//
// Segunda vuelta de texto (a pedido del dueño): el primer pitch hablaba
// de plata/comisiones antes que nada -- se reemplaza el hero por un
// texto narrativo ("compartir un pedazo real de la ciudad", no un
// checklist de beneficios) y se deja la info práctica (comisión, cómo
// se paga, etc.) más abajo, en un bloque corto y sin tono de venta.

'use client';

import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { partnersAPI } from '@/lib/api';

interface Props {
  locale: string;
}

interface PartnersContent {
  eyebrow: string;
  heroTitle: string;
  /** Texto narrativo del hero, en varios párrafos cortos. */
  heroIntro: string[];
  ctaWhatsapp: string;
  whatsappMessage: string;
  howWeWorkTitle: string;
  benefits: string[];
  contractNoteTitle: string;
  contractNote: string;
  formTitle: string;
  formBody: string;
  labelName: string;
  labelEmail: string;
  labelPhone: string;
  labelProperty: string;
  labelMessage: string;
  placeholderName: string;
  placeholderEmail: string;
  placeholderPhone: string;
  placeholderProperty: string;
  placeholderMessage: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  errorBody: string;
}

const CONTENT: Record<string, PartnersContent> = {
  pt: {
    eyebrow: 'Rio de Janeiro · Programa de Parceiros',
    heroTitle: 'O Rio não é só praia e cartão-postal.',
    heroIntro: [
      'É um bairro com ritmo próprio, uma mercearia na esquina, uma vista que só se vê de uma certa janela em um certo horário. Isso é o que seu apartamento oferece a quem vem de fora: não mais um quarto de hotel, mas um pedaço real da cidade.',
      'Nós ajudamos esse pedaço de cidade a chegar até a pessoa certa — alguém que vai aproveitar e cuidar dele, não só usar de passagem.',
      'Se seu apartamento tem um pouco do Rio nele, queremos que isso apareça.',
    ],
    ctaWhatsapp: 'Falar pelo WhatsApp',
    whatsappMessage:
      'Olá! Tenho um apartamento no Rio de Janeiro e quero saber mais sobre a gestão de aluguel por temporada.',
    howWeWorkTitle: 'Como trabalhamos',
    benefits: [
      'Comissão de 5% por reserva confirmada — sem taxa de adesão nem mensalidade',
      'Cuidamos dos hóspedes, da limpeza, do check-in e do check-out',
      'O repasse cai na sua conta poucas horas após cada check-in',
      'Você não precisa morar no Rio nem visitar o imóvel',
      'Pessoa física ou jurídica: o processo é o mesmo',
      'Tratamos os dados dos seus hóspedes com o cuidado exigido pela LGPD',
    ],
    contractNoteTitle: 'E o contrato?',
    contractNote:
      'O contrato vem depois, não antes. Primeiro conversamos e resolvemos suas dúvidas — só enviamos para assinatura quando você tiver certeza.',
    formTitle: 'Quero listar minha propriedade',
    formBody: 'Conte um pouco sobre seu apartamento e entraremos em contato.',
    labelName: 'Nome completo',
    labelEmail: 'E-mail',
    labelPhone: 'WhatsApp / Telefone',
    labelProperty: 'Endereço da propriedade',
    labelMessage: 'Mensagem (opcional)',
    placeholderName: 'João Silva',
    placeholderEmail: 'joao@email.com',
    placeholderPhone: '+55 21 99999-9999',
    placeholderProperty: 'Rua X, bairro, RJ',
    placeholderMessage: 'Conte um pouco sobre seu imóvel, disponibilidade, dúvidas...',
    submit: 'Quero ser parceiro(a)',
    submitting: 'Enviando…',
    successTitle: 'Mensagem enviada!',
    successBody: 'Entraremos em contato em até 48 horas úteis.',
    errorBody: 'Erro ao enviar. Tente novamente ou entre em contato por e-mail.',
  },
  es: {
    eyebrow: 'Río de Janeiro · Programa de Socios',
    heroTitle: 'Río no es solo playas y postales.',
    heroIntro: [
      'Es un barrio con su propio ritmo, un almacén de la esquina, una vista que solo se ve desde cierta ventana a cierta hora. Eso es lo que tu apartamento le ofrece a alguien que viene de afuera: no un hotel más, sino un pedazo real de la ciudad.',
      'Nosotros ayudamos a que ese pedazo de ciudad llegue a la persona correcta — alguien que lo va a disfrutar y cuidar, no solo a usarlo de paso.',
      'Si tu apartamento tiene algo de Río en él, queremos que se note.',
    ],
    ctaWhatsapp: 'Hablar por WhatsApp',
    whatsappMessage:
      '¡Hola! Tengo un apartamento en Río de Janeiro y quiero saber más sobre la gestión de alquiler por temporada.',
    howWeWorkTitle: 'Cómo trabajamos',
    benefits: [
      'Comisión del 5% por reserva confirmada — sin inscripción ni mensualidad',
      'Nos ocupamos de los huéspedes, la limpieza, el check-in y el check-out',
      'El pago llega a tu cuenta a pocas horas de cada check-in',
      'No hace falta que vivas en Río ni que visites la propiedad',
      'Persona física o empresa: el proceso es el mismo',
      'Tratamos los datos de tus huéspedes con el cuidado que exige la LGPD',
    ],
    contractNoteTitle: '¿Y el contrato?',
    contractNote:
      'El contrato llega después, no antes. Primero conversamos y resolvemos tus dudas — recién te lo mandamos para firmar cuando estés seguro.',
    formTitle: 'Quiero listar mi propiedad',
    formBody: 'Cuéntanos cómo es tu apartamento y nos pondremos en contacto.',
    labelName: 'Nombre completo',
    labelEmail: 'Email',
    labelPhone: 'WhatsApp / Teléfono',
    labelProperty: 'Dirección de la propiedad',
    labelMessage: 'Mensaje (opcional)',
    placeholderName: 'Juan Pérez',
    placeholderEmail: 'juan@email.com',
    placeholderPhone: '+55 21 99999-9999',
    placeholderProperty: 'Calle X, barrio, RJ',
    placeholderMessage: 'Cuéntanos un poco sobre tu propiedad, disponibilidad, dudas...',
    submit: 'Quiero ser socio',
    submitting: 'Enviando…',
    successTitle: '¡Mensaje enviado!',
    successBody: 'Nos pondremos en contacto en un plazo de 48 horas hábiles.',
    errorBody: 'Error al enviar. Intenta de nuevo o escríbenos por email.',
  },
  en: {
    eyebrow: 'Rio de Janeiro · Partner Program',
    heroTitle: "Rio isn't just beaches and postcards.",
    heroIntro: [
      "It's a neighborhood with its own rhythm, a corner store, a view you only get from one particular window at one particular hour. That's what your apartment offers someone visiting from elsewhere: not just another hotel room, but a real piece of the city.",
      "We help that piece of the city reach the right person — someone who'll enjoy it and take care of it, not just pass through.",
      'If your apartment has some of Rio in it, we want that to show.',
    ],
    ctaWhatsapp: 'Chat on WhatsApp',
    whatsappMessage:
      'Hi! I have an apartment in Rio de Janeiro and I want to know more about your short-term rental management.',
    howWeWorkTitle: 'How we work',
    benefits: [
      'Just 5% commission per confirmed booking — no sign-up fee, no monthly charge',
      'We handle guests, cleaning, check-in, and check-out',
      'Payout lands in your account a few hours after each check-in',
      "You don't need to live in Rio or ever visit the property",
      'Individual or registered business: same process either way',
      "We handle your guests' data with the care required by data protection law (LGPD)",
    ],
    contractNoteTitle: 'What about the contract?',
    contractNote:
      "The contract comes later, not first. Let's talk and answer your questions — we'll only send it for signature once you're sure.",
    formTitle: 'I want to list my property',
    formBody: "Tell us about your apartment and we'll get in touch.",
    labelName: 'Full name',
    labelEmail: 'Email',
    labelPhone: 'WhatsApp / Phone',
    labelProperty: 'Property address',
    labelMessage: 'Message (optional)',
    placeholderName: 'John Smith',
    placeholderEmail: 'john@email.com',
    placeholderPhone: '+55 21 99999-9999',
    placeholderProperty: 'Street X, neighborhood, RJ',
    placeholderMessage: 'Tell us a bit about your property, availability, questions...',
    submit: 'I want to be a partner',
    submitting: 'Sending…',
    successTitle: 'Message sent!',
    successBody: "We'll get back to you within 48 business hours.",
    errorBody: 'Something went wrong. Please try again or email us directly.',
  },
  de: {
    eyebrow: 'Rio de Janeiro · Partnerprogramm',
    heroTitle: 'Rio ist nicht nur Strände und Postkarten.',
    heroIntro: [
      'Es ist ein Viertel mit eigenem Rhythmus, ein Laden an der Ecke, ein Ausblick, den man nur von einem bestimmten Fenster zu einer bestimmten Stunde hat. Genau das bietet Ihre Wohnung jemandem, der von außerhalb kommt: kein weiteres Hotelzimmer, sondern ein echtes Stück Stadt.',
      'Wir sorgen dafür, dass dieses Stück Stadt bei der richtigen Person ankommt — jemandem, der es genießt und pflegt, nicht nur durchreist.',
      'Wenn Ihre Wohnung etwas von Rio in sich trägt, soll man das spüren.',
    ],
    ctaWhatsapp: 'Auf WhatsApp schreiben',
    whatsappMessage:
      'Hallo! Ich habe eine Wohnung in Rio de Janeiro und möchte mehr über Ihre Verwaltung von Ferienwohnungen erfahren.',
    howWeWorkTitle: 'So arbeiten wir',
    benefits: [
      '5% Provision pro bestätigter Buchung — keine Anmeldegebühr, keine monatlichen Kosten',
      'Wir kümmern uns um Gäste, Reinigung, Check-in und Check-out',
      'Die Auszahlung erreicht Ihr Konto wenige Stunden nach jedem Check-in',
      'Sie müssen weder in Rio wohnen noch die Immobilie je besuchen',
      'Privatperson oder Unternehmen: derselbe Ablauf für alle',
      'Wir behandeln die Daten Ihrer Gäste mit der von der LGPD geforderten Sorgfalt',
    ],
    contractNoteTitle: 'Und der Vertrag?',
    contractNote:
      'Der Vertrag kommt später, nicht zuerst. Lassen Sie uns zunächst sprechen und Ihre Fragen klären — wir schicken ihn erst zur Unterschrift, wenn Sie sicher sind.',
    formTitle: 'Ich möchte meine Immobilie eintragen',
    formBody: 'Erzählen Sie uns von Ihrer Wohnung, wir melden uns bei Ihnen.',
    labelName: 'Vollständiger Name',
    labelEmail: 'E-Mail',
    labelPhone: 'WhatsApp / Telefon',
    labelProperty: 'Adresse der Immobilie',
    labelMessage: 'Nachricht (optional)',
    placeholderName: 'Max Mustermann',
    placeholderEmail: 'max@email.com',
    placeholderPhone: '+55 21 99999-9999',
    placeholderProperty: 'Straße X, Viertel, RJ',
    placeholderMessage: 'Erzählen Sie uns etwas über Ihre Immobilie, Verfügbarkeit, Fragen...',
    submit: 'Ich möchte Partner werden',
    submitting: 'Wird gesendet…',
    successTitle: 'Nachricht gesendet!',
    successBody: 'Wir melden uns innerhalb von 48 Werktagsstunden.',
    errorBody:
      'Beim Senden ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder schreiben Sie uns per E-Mail.',
  },
  fr: {
    eyebrow: 'Rio de Janeiro · Programme Partenaire',
    heroTitle: "Rio, ce n'est pas que des plages et des cartes postales.",
    heroIntro: [
      "C'est un quartier avec son propre rythme, une épicerie au coin de la rue, une vue qu'on n'a que depuis une certaine fenêtre à une certaine heure. C'est ce que votre appartement offre à quelqu'un qui vient d'ailleurs : pas une chambre d'hôtel de plus, mais un vrai morceau de la ville.",
      "On aide ce morceau de ville à arriver jusqu'à la bonne personne — quelqu'un qui va en profiter et en prendre soin, pas seulement y passer.",
      'Si votre appartement a un peu de Rio en lui, on veut que ça se voie.',
    ],
    ctaWhatsapp: 'Discuter sur WhatsApp',
    whatsappMessage:
      'Bonjour ! J’ai un appartement à Rio de Janeiro et je voudrais en savoir plus sur votre gestion de location saisonnière.',
    howWeWorkTitle: 'Comment on travaille',
    benefits: [
      "5% de commission par réservation confirmée — sans frais d'inscription, sans abonnement",
      'On s’occupe des voyageurs, du ménage, du check-in et du check-out',
      'Le virement arrive sur votre compte quelques heures après chaque check-in',
      'Pas besoin de vivre à Rio ni de visiter le bien',
      'Particulier ou société : la même démarche pour tous',
      'On traite les données de vos voyageurs avec la rigueur exigée par le RGPD/LGPD',
    ],
    contractNoteTitle: 'Et le contrat ?',
    contractNote:
      "Le contrat arrive après, pas avant. Parlons-en d'abord et répondons à vos questions — on ne vous l'envoie pour signature que lorsque vous êtes sûr.",
    formTitle: 'Je veux inscrire mon bien',
    formBody: 'Parlez-nous de votre appartement, on vous recontacte.',
    labelName: 'Nom complet',
    labelEmail: 'E-mail',
    labelPhone: 'WhatsApp / Téléphone',
    labelProperty: 'Adresse du bien',
    labelMessage: 'Message (optionnel)',
    placeholderName: 'Jean Dupont',
    placeholderEmail: 'jean@email.com',
    placeholderPhone: '+55 21 99999-9999',
    placeholderProperty: 'Rue X, quartier, RJ',
    placeholderMessage: 'Parlez-nous un peu de votre bien, disponibilité, questions...',
    submit: 'Je veux devenir partenaire',
    submitting: 'Envoi…',
    successTitle: 'Message envoyé !',
    successBody: 'Nous vous répondrons sous 48 heures ouvrables.',
    errorBody: 'Une erreur est survenue. Réessayez ou écrivez-nous par e-mail.',
  },
  it: {
    eyebrow: 'Rio de Janeiro · Programma Partner',
    heroTitle: 'Rio non è solo spiagge e cartoline.',
    heroIntro: [
      "È un quartiere con un ritmo tutto suo, un negozietto all'angolo, una vista che si vede solo da una certa finestra a una certa ora. Questo è ciò che il tuo appartamento offre a chi arriva da fuori: non un'altra camera d'hotel, ma un vero pezzo di città.",
      'Noi aiutiamo quel pezzo di città ad arrivare alla persona giusta — qualcuno che lo apprezzerà e se ne prenderà cura, non solo di passaggio.',
      "Se il tuo appartamento ha un po' di Rio dentro, vogliamo che si veda.",
    ],
    ctaWhatsapp: 'Scrivi su WhatsApp',
    whatsappMessage:
      "Ciao! Ho un appartamento a Rio de Janeiro e vorrei saperne di più sulla gestione dell'affitto breve.",
    howWeWorkTitle: 'Come lavoriamo',
    benefits: [
      'Il 5% di commissione per prenotazione confermata — nessuna quota di iscrizione, nessun canone mensile',
      'Pensiamo noi agli ospiti, alle pulizie, al check-in e al check-out',
      'Il pagamento arriva sul tuo conto poche ore dopo ogni check-in',
      "Non devi vivere a Rio né mai visitare l'immobile",
      'Persona fisica o azienda: la stessa procedura per tutti',
      'Trattiamo i dati dei tuoi ospiti con la cura richiesta dalla normativa (LGPD)',
    ],
    contractNoteTitle: 'E il contratto?',
    contractNote:
      'Il contratto arriva dopo, non prima. Parliamone prima e rispondiamo alle tue domande — te lo inviamo per la firma solo quando sei sicuro.',
    formTitle: 'Voglio inserire il mio immobile',
    formBody: 'Raccontaci del tuo appartamento, ti ricontattiamo.',
    labelName: 'Nome completo',
    labelEmail: 'Email',
    labelPhone: 'WhatsApp / Telefono',
    labelProperty: "Indirizzo dell'immobile",
    labelMessage: 'Messaggio (facoltativo)',
    placeholderName: 'Mario Rossi',
    placeholderEmail: 'mario@email.com',
    placeholderPhone: '+55 21 99999-9999',
    placeholderProperty: 'Via X, quartiere, RJ',
    placeholderMessage: 'Raccontaci qualcosa sul tuo immobile, disponibilità, domande...',
    submit: 'Voglio diventare partner',
    submitting: 'Invio…',
    successTitle: 'Messaggio inviato!',
    successBody: 'Ti contatteremo entro 48 ore lavorative.',
    errorBody: "Errore durante l'invio. Riprova o scrivici via email.",
  },
};

function ContactForm({ c }: { c: PartnersContent }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', property: '', message: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await partnersAPI.contact(form);
      setSent(true);
    } catch {
      setError(c.errorBody);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center py-8">
        <CheckCircle size={40} className="text-primary" />
        <p className="font-semibold text-foreground">{c.successTitle}</p>
        <p className="text-sm text-muted-foreground">{c.successBody}</p>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40';
  const labelClass = 'block text-xs font-semibold text-foreground mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{c.labelName} *</label>
          <input
            required
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={c.placeholderName}
          />
        </div>
        <div>
          <label className={labelClass}>{c.labelEmail} *</label>
          <input
            required
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder={c.placeholderEmail}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{c.labelPhone}</label>
          <input
            className={inputClass}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder={c.placeholderPhone}
          />
        </div>
        <div>
          <label className={labelClass}>{c.labelProperty} *</label>
          <input
            required
            className={inputClass}
            value={form.property}
            onChange={(e) => setForm((f) => ({ ...f, property: e.target.value }))}
            placeholder={c.placeholderProperty}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>{c.labelMessage}</label>
        <textarea
          rows={3}
          className={`${inputClass} resize-y`}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          placeholder={c.placeholderMessage}
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="self-start inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <Mail size={16} />
        {sending ? c.submitting : c.submit}
      </button>
    </form>
  );
}

export function PartnerContractPage({ locale }: Props) {
  const c = CONTENT[locale] ?? CONTENT.pt!;
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5521977157530';

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero narrativo ── */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-4">
            {c.eyebrow}
          </p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-6 leading-tight">
            {c.heroTitle}
          </h1>
          <div className="space-y-4 max-w-2xl mb-6">
            {c.heroIntro.map((paragraph, i) => (
              <p key={i} className="text-lg text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(c.whatsappMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            💬 {c.ctaWhatsapp}
          </a>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4">
        {/* ── Cómo trabajamos (info práctica, sin tono de venta) ── */}
        <section className="py-12 border-b border-border">
          <h2 className="text-xl font-display font-semibold text-foreground mb-6">
            {c.howWeWorkTitle}
          </h2>
          <ul className="space-y-3">
            {c.benefits.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                <span className="text-primary mt-0.5 flex-shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Nota sobre el contrato ── */}
        <section className="py-12 border-b border-border">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-display font-semibold text-foreground mb-2">
              {c.contractNoteTitle}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{c.contractNote}</p>
          </div>
        </section>

        {/* ── Formulario de contacto ── */}
        <section className="py-12">
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8">
            <h2 className="text-xl font-display font-semibold text-foreground mb-2">
              {c.formTitle}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">{c.formBody}</p>
            <ContactForm c={c} />
          </div>
        </section>
      </div>
    </div>
  );
}
