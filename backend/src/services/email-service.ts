// lapa-casa-hostel/backend/src/services/email-service.ts
//
// Servicio de emails real, vía Resend. Sigue el mismo patron de
// degradacion que src/cache/redis-client.ts y src/lib/payments/stripe-handler.ts:
// sin RESEND_API_KEY configurada, no revienta -- loguea y sigue (util en
// dev/tests sin cuenta de Resend todavia).

import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { query } from '../config/database';
import { renderEmailTemplate as _renderEmailTemplate, type TemplateVars } from '../templates/render';
import { logger } from '../utils/logger';
import type { Reservation, Guest } from '../types/database';

type Language = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'it';
export type BookingWithGuest = Reservation & { guest: Guest };

function resolveLanguage(raw: string | null | undefined): Language {
  if (raw === 'en' || raw === 'es' || raw === 'fr' || raw === 'de' || raw === 'it') { return raw; }
  return 'pt';
}

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'lapalandiarj@gmail.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Lapa Casa';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lapalandiarj@gmail.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://lapacasario.com';
const WHATSAPP_CONTACT_URL = 'https://wa.me/5521977157530';

// ---- Dirección física del hostel (configurable via variables de entorno) ----
const HOSTEL_STREET   = process.env.HOSTEL_STREET   || 'Rua Silvio Romero, 22';
const HOSTEL_DISTRICT = process.env.HOSTEL_DISTRICT || 'Santa Teresa';
const HOSTEL_CITY     = process.env.HOSTEL_CITY     || 'Rio de Janeiro – RJ';
const HOSTEL_CEP      = process.env.HOSTEL_CEP      || '20261-005';
const HOSTEL_MAPS_URL = process.env.HOSTEL_MAPS_URL || `https://maps.google.com/?q=${encodeURIComponent((process.env.HOSTEL_STREET || 'Rua Silvio Romero, 22') + ', Rio de Janeiro')}`;
const FOOTER_ADDRESS  = process.env.FOOTER_ADDRESS  || `${HOSTEL_STREET}, ${HOSTEL_DISTRICT}, ${HOSTEL_CITY}`;
const FOOTER_EMAIL    = process.env.FOOTER_EMAIL    || FROM_EMAIL;

function renderEmailTemplate(name: string, vars: TemplateVars): string {
  return _renderEmailTemplate(name, { footerAddress: FOOTER_ADDRESS, footerEmail: FOOTER_EMAIL, ...vars });
}

let resendClient: Resend | null = null;
let warnedNoApiKey = false;

// Gmail SMTP transporter (creado una sola vez si las variables están presentes)
let gmailTransporter: nodemailer.Transporter | null = null;

function getGmailTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return null;
  }
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return gmailTransporter;
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (!warnedNoApiKey) {
      logger.warn('RESEND_API_KEY no configurada — emails no se envían de verdad, solo se loguean');
      warnedNoApiKey = true;
    }
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

interface SendResult {
  id: string;
}

async function dispatch(to: string, subject: string, html: string): Promise<SendResult> {
  // Gmail tiene prioridad si está configurado (no requiere dominio verificado)
  const gmail = getGmailTransporter();
  if (gmail) {
    const info = await gmail.sendMail({
      from: `${FROM_NAME} <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    logger.info('Email enviado vía Gmail', { to, subject, messageId: info.messageId });
    return { id: info.messageId ?? `gmail-${Date.now()}` };
  }

  // Fallback: Resend
  const client = getResendClient();
  if (!client) {
    logger.info('EMAIL (sin enviar — falta RESEND_API_KEY y GMAIL_USER)', { to, subject });
    return { id: `stub-${Date.now()}` };
  }
  const { data, error } = await client.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
  if (error) {
    logger.error('Resend rechazó el envío', { to, subject, error });
    throw new Error(`Email send failed: ${error.message}`);
  }
  logger.info('Email enviado vía Resend', { to, subject, messageId: data?.id });
  return { id: data?.id ?? '' };
}

// ---- i18n: solo las etiquetas visibles en las plantillas (ver src/templates/emails/*.html) ----
const LABELS: Record<Language, Record<string, string>> = {
  pt: {
    greeting: 'Olá',
    bookingConfirmationTitle: 'Reserva Confirmada!',
    bookingConfirmationIntro: 'Recebemos sua reserva. Confira os detalhes abaixo:',
    sameDayLabel: 'Valor total a pagar hoje',
    reservation: 'Reserva',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    nights: 'Noites',
    rooms: 'Acomodações',
    total: 'Total',
    deposit: 'Depósito',
    remaining: 'Saldo restante',
    remainingDueNote: 'O saldo restante deverá ser pago no momento do check-in.',
    checkInTime: 'Horário de check-in',
    checkOutTime: 'Horário de check-out',
    payNow: 'Pagar agora',
    paymentReminderTitle: 'Lembrete de Pagamento',
    paymentReminderIntro: 'O saldo da sua reserva está pendente.',
    amountDue: 'Valor pendente',
    dueDate: 'Vencimento',
    daysUntilCheckIn: 'Dias até o check-in',
    retryNote: 'Vamos te enviar até 3 lembretes por email nos próximos dias.',
    paymentReceivedTitle: 'Pagamento Recebido',
    paymentReceivedWelcome: 'Seu lugar no Lapa Casa está confirmado!',
    paymentReceivedIntro: 'Confirmamos o recebimento do seu pagamento. Estamos muito felizes em recebê-lo e já estamos te esperando!',
    amountPaid: 'Valor recebido',
    thanks: 'Obrigado! Nos vemos em breve.',
    remainingStillDue: 'Saldo restante ainda pendente',
    fullyPaid: 'Sua reserva está totalmente paga.',
    welcomeTitle: 'Bem-vindo ao Lapa Casa!',
    welcomeIntro: 'Estamos ansiosos para recebê-lo. Aqui vão algumas informações úteis:',
    address: 'Endereço',
    wifiNetwork: 'Rede',
    wifiPassword: 'Senha',
    tipsTitle: 'Dicas locais',
    tip1: 'Bondinho de Santa Teresa: passeio histórico a poucos minutos a pé.',
    tip2: 'Escadaria Selarón: um dos pontos turísticos mais fotografados do Rio.',
    tip3: 'Centro da Lapa: vida noturna, samba e restaurantes a poucos quarteirões.',
    cancellationTitle: 'Reserva Cancelada',
    cancellationIntro: 'Sua reserva foi cancelada conforme solicitado.',
    refundAmount: 'Valor a reembolsar',
    refundTimeline: 'Prazo estimado: 5-10 dias úteis.',
    noRefund:
      'De acordo com a política de cancelamento, esta reserva não é elegível para reembolso.',
    noShowTitle: 'Não Comparecimento Registrado',
    noShowIntro: 'Registramos que você não compareceu para o check-in da sua reserva.',
    chargeApplied: 'Cobrança aplicada',
    policyNote:
      'De acordo com nossa política de cancelamento, o valor total da reserva é cobrado em caso de não comparecimento (no-show).',
    bookingExpiredTitle: 'Sua reserva não foi concluída',
    bookingExpiredIntro:
      'Vimos que você começou uma reserva no Lapa Casa, mas o pagamento do depósito não foi concluído a tempo, então as camas foram liberadas.',
    bookingExpiredCta:
      'Se ainda quiser se hospedar, você pode iniciar uma nova reserva quando quiser.',
    bookingExpiredHelp:
      'Se teve algum problema no pagamento ou precisa de ajuda, é só responder este email ou nos chamar no WhatsApp.',
    tryAgain: 'Reservar novamente',
    checkinReminderTitle: 'Seu check-in é amanhã!',
    checkinReminderIntro:
      'Só falta um dia! Estamos ansiosos para receber você no Lapa Casa. Aqui estão as informações para o seu check-in:',
    checkinReminderClosing: 'Qualquer dúvida, é só responder este email ou nos chamar no WhatsApp.',
    reviewRequestTitle: 'Como foi a sua estadia?',
    reviewRequestIntro: 'Esperamos que sua estadia no Lapa Casa tenha sido ótima!',
    reviewRequestBody:
      'Sua opinião é muito importante para nós e ajuda outros viajantes a conhecerem o Lapa Casa. Levaria apenas 2 minutinhos — ficaríamos muito gratos!',
    reviewRequestClosing: 'Obrigado pela sua visita. Esperamos te ver de novo em breve!',
    leaveReview: 'Deixar uma avaliação',
    referralRewardTitle: 'Seu presente chegou!',
    referralRewardIntro:
      'Alguém que você indicou acabou de fazer uma reserva no Lapa Casa — obrigado por espalhar a palavra!',
    referralRewardBody:
      'Como agradecimento, aqui está um código de 10% de desconto para a sua próxima estadia. Válido por 90 dias.',
    referralRewardClosing: 'Esperamos ver você de novo em breve!',
    useReward: 'Reservar com este código',
  },
  en: {
    greeting: 'Hello',
    bookingConfirmationTitle: 'Booking Confirmed!',
    bookingConfirmationIntro: 'We received your booking. Here are the details:',
    sameDayLabel: 'Total amount due today',
    reservation: 'Booking',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    nights: 'Nights',
    rooms: 'Accommodations',
    total: 'Total',
    deposit: 'Deposit',
    remaining: 'Remaining balance',
    remainingDueNote: 'The remaining balance is due at check-in.',
    checkInTime: 'Check-in time',
    checkOutTime: 'Check-out time',
    payNow: 'Pay now',
    paymentReminderTitle: 'Payment Reminder',
    paymentReminderIntro: 'The remaining balance of your booking is due.',
    amountDue: 'Amount due',
    dueDate: 'Due date',
    daysUntilCheckIn: 'Days until check-in',
    retryNote: "We'll send you up to 3 email reminders over the next few days.",
    paymentReceivedTitle: 'Payment Received',
    paymentReceivedWelcome: 'Your spot at Lapa Casa is confirmed!',
    paymentReceivedIntro: 'We confirm we received your payment. We are so happy to have you and we cannot wait to welcome you!',
    amountPaid: 'Amount received',
    thanks: 'Thank you! See you soon.',
    remainingStillDue: 'Remaining balance still due',
    fullyPaid: 'Your booking is fully paid.',
    welcomeTitle: 'Welcome to Lapa Casa!',
    welcomeIntro: "We're looking forward to hosting you. Some useful info:",
    address: 'Address',
    wifiNetwork: 'Network',
    wifiPassword: 'Password',
    tipsTitle: 'Local tips',
    tip1: 'Santa Teresa tram: a historic ride just a short walk away.',
    tip2: 'Selarón Steps: one of the most photographed landmarks in Rio.',
    tip3: 'Lapa nightlife: samba and restaurants a few blocks away.',
    cancellationTitle: 'Booking Cancelled',
    cancellationIntro: 'Your booking has been cancelled as requested.',
    refundAmount: 'Refund amount',
    refundTimeline: 'Estimated timeline: 5-10 business days.',
    noRefund: 'Per our cancellation policy, this booking is not eligible for a refund.',
    noShowTitle: 'No-Show Recorded',
    noShowIntro: 'We recorded that you did not check in for your booking.',
    chargeApplied: 'Charge applied',
    policyNote:
      'Per our cancellation policy, the full booking amount is charged in case of no-show.',
    bookingExpiredTitle: "Your booking wasn't completed",
    bookingExpiredIntro:
      "We saw you started a booking at Lapa Casa, but the deposit payment wasn't completed in time, so the beds were released.",
    bookingExpiredCta:
      "If you'd still like to stay with us, you can start a new booking whenever you're ready.",
    bookingExpiredHelp:
      'If something went wrong with the payment or you need help, just reply to this email or message us on WhatsApp.',
    tryAgain: 'Book again',
    checkinReminderTitle: 'Your check-in is tomorrow!',
    checkinReminderIntro:
      "Just one more day! We're looking forward to welcoming you at Lapa Casa. Here is everything you need for check-in:",
    checkinReminderClosing: 'Any questions? Just reply to this email or message us on WhatsApp.',
    reviewRequestTitle: 'How was your stay?',
    reviewRequestIntro: 'We hope you had a wonderful stay at Lapa Casa!',
    reviewRequestBody:
      "Your feedback means a lot to us and helps other travelers discover Lapa Casa. It only takes 2 minutes — we'd really appreciate it!",
    reviewRequestClosing: 'Thank you for your visit. Hope to see you again soon!',
    leaveReview: 'Leave a review',
    referralRewardTitle: 'Your reward has arrived!',
    referralRewardIntro:
      'Someone you referred just booked a stay at Lapa Casa -- thanks for spreading the word!',
    referralRewardBody:
      'As a thank you, here is a 10% discount code for your next stay. Valid for 90 days.',
    referralRewardClosing: 'We hope to see you again soon!',
    useReward: 'Book with this code',
  },
  es: {
    greeting: 'Hola',
    bookingConfirmationTitle: '¡Reserva Confirmada!',
    bookingConfirmationIntro: 'Recibimos tu reserva. Estos son los detalles:',
    sameDayLabel: 'Monto total a pagar hoy',
    reservation: 'Reserva',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    nights: 'Noches',
    rooms: 'Alojamientos',
    total: 'Total',
    deposit: 'Depósito',
    remaining: 'Saldo restante',
    remainingDueNote: 'El saldo restante se abona el día del check-in.',
    checkInTime: 'Horario de check-in',
    checkOutTime: 'Horario de check-out',
    payNow: 'Pagar ahora',
    paymentReminderTitle: 'Recordatorio de Pago',
    paymentReminderIntro: 'El saldo de tu reserva está pendiente.',
    amountDue: 'Monto pendiente',
    dueDate: 'Vencimiento',
    daysUntilCheckIn: 'Días hasta el check-in',
    retryNote: 'Te vamos a mandar hasta 3 recordatorios por email en los próximos días.',
    paymentReceivedTitle: 'Pago Recibido',
    paymentReceivedWelcome: '¡Tu lugar en Lapa Casa ya está confirmado!',
    paymentReceivedIntro: 'Confirmamos la recepción de tu pago. Estamos muy contentos de recibirte y te esperamos con todo listo.',
    amountPaid: 'Monto recibido',
    thanks: '¡Gracias! Nos vemos pronto.',
    remainingStillDue: 'Saldo restante aún pendiente',
    fullyPaid: 'Tu reserva está totalmente pagada.',
    welcomeTitle: '¡Bienvenido a Lapa Casa!',
    welcomeIntro: 'Estamos ansiosos por recibirte. Aquí va información útil:',
    address: 'Dirección',
    wifiNetwork: 'Red',
    wifiPassword: 'Contraseña',
    tipsTitle: 'Tips locales',
    tip1: 'Tranvía de Santa Teresa: paseo histórico a pocos minutos caminando.',
    tip2: 'Escalera Selarón: uno de los puntos turísticos más fotografiados de Río.',
    tip3: 'Vida nocturna de Lapa: samba y restaurantes a pocas cuadras.',
    cancellationTitle: 'Reserva Cancelada',
    cancellationIntro: 'Tu reserva fue cancelada según lo solicitado.',
    refundAmount: 'Monto a reembolsar',
    refundTimeline: 'Plazo estimado: 5-10 días hábiles.',
    noRefund: 'Según nuestra política de cancelación, esta reserva no es elegible para reembolso.',
    noShowTitle: 'No Presentación Registrada',
    noShowIntro: 'Registramos que no realizaste el check-in de tu reserva.',
    chargeApplied: 'Cargo aplicado',
    policyNote:
      'Según nuestra política de cancelación, se cobra el monto total de la reserva en caso de no presentación (no-show).',
    bookingExpiredTitle: 'Tu reserva no se completó',
    bookingExpiredIntro:
      'Vimos que empezaste una reserva en Lapa Casa, pero el pago del depósito no se completó a tiempo, así que las camas quedaron liberadas.',
    bookingExpiredCta:
      'Si todavía querés hospedarte, podés iniciar una nueva reserva cuando quieras.',
    bookingExpiredHelp:
      'Si tuviste algún problema con el pago o necesitás ayuda, respondé este email o escribinos por WhatsApp.',
    tryAgain: 'Reservar de nuevo',
    checkinReminderTitle: '¡Tu check-in es mañana!',
    checkinReminderIntro:
      '¡Solo falta un día! Estamos ansiosos por recibirte en Lapa Casa. Aquí tenés todo lo que necesitás para el check-in:',
    checkinReminderClosing: 'Cualquier duda, respondé este email o escribinos por WhatsApp.',
    reviewRequestTitle: '¿Cómo fue tu estadía?',
    reviewRequestIntro: '¡Esperamos que tu estadía en Lapa Casa haya sido genial!',
    reviewRequestBody:
      'Tu opinión es muy importante para nosotros y ayuda a otros viajeros a conocer Lapa Casa. Solo te lleva 2 minutos — ¡te lo agradeceríamos mucho!',
    reviewRequestClosing: '¡Gracias por tu visita. Esperamos verte de nuevo pronto!',
    leaveReview: 'Dejar una reseña',
    referralRewardTitle: '¡Llegó tu premio!',
    referralRewardIntro:
      'Alguien a quien recomendaste acaba de reservar en Lapa Casa -- ¡gracias por compartirnos!',
    referralRewardBody:
      'Como agradecimiento, acá tenés un código de 10% de descuento para tu próxima estadía. Válido por 90 días.',
    referralRewardClosing: '¡Esperamos verte de nuevo pronto!',
    useReward: 'Reservar con este código',
  },
  fr: {
    greeting: 'Bonjour',
    bookingConfirmationTitle: 'Réservation Confirmée !',
    bookingConfirmationIntro: 'Nous avons reçu votre réservation. Voici les détails :',
    sameDayLabel: "Montant total à payer aujourd'hui",
    reservation: 'Réservation',
    checkIn: 'Arrivée',
    checkOut: 'Départ',
    nights: 'Nuits',
    rooms: 'Hébergements',
    total: 'Total',
    deposit: 'Acompte',
    remaining: 'Solde restant',
    remainingDueNote: 'Le solde restant est dû au moment du check-in.',
    checkInTime: "Heure d'arrivée",
    checkOutTime: 'Heure de départ',
    payNow: 'Payer maintenant',
    paymentReminderTitle: 'Rappel de Paiement',
    paymentReminderIntro: 'Le solde de votre réservation est en attente.',
    amountDue: 'Montant dû',
    dueDate: 'Date limite',
    daysUntilCheckIn: 'Jours avant le check-in',
    retryNote: "Nous vous enverrons jusqu'à 3 rappels par email dans les prochains jours.",
    paymentReceivedTitle: 'Paiement Reçu',
    paymentReceivedWelcome: 'Votre place au Lapa Casa est confirmée !',
    paymentReceivedIntro: "Nous confirmons la réception de votre paiement. Nous sommes ravis de vous accueillir et nous vous attendons avec impatience !",
    amountPaid: 'Montant reçu',
    thanks: 'Merci ! À bientôt.',
    remainingStillDue: 'Solde restant encore dû',
    fullyPaid: 'Votre réservation est entièrement payée.',
    welcomeTitle: 'Bienvenue au Lapa Casa !',
    welcomeIntro: 'Nous avons hâte de vous accueillir. Voici quelques informations utiles :',
    address: 'Adresse',
    wifiNetwork: 'Réseau',
    wifiPassword: 'Mot de passe',
    tipsTitle: 'Conseils locaux',
    tip1: 'Tramway de Santa Teresa : une balade historique à quelques minutes à pied.',
    tip2: "Escalier Selarón : l'un des monuments les plus photographiés de Rio.",
    tip3: 'Vie nocturne de la Lapa : samba et restaurants à quelques rues.',
    cancellationTitle: 'Réservation Annulée',
    cancellationIntro: 'Votre réservation a été annulée comme demandé.',
    refundAmount: 'Montant remboursé',
    refundTimeline: 'Délai estimé : 5 à 10 jours ouvrables.',
    noRefund: "Conformément à notre politique d'annulation, cette réservation n'est pas éligible au remboursement.",
    noShowTitle: 'Absence Enregistrée',
    noShowIntro: "Nous avons enregistré que vous n'avez pas effectué votre check-in.",
    chargeApplied: 'Frais appliqués',
    policyNote: "Conformément à notre politique d'annulation, le montant total est facturé en cas de non-présentation.",
    bookingExpiredTitle: "Votre réservation n'a pas été finalisée",
    bookingExpiredIntro: "Vous avez commencé une réservation au Lapa Casa, mais le paiement de l'acompte n'a pas été finalisé à temps — les lits ont été libérés.",
    bookingExpiredCta: 'Si vous souhaitez toujours séjourner chez nous, vous pouvez commencer une nouvelle réservation quand vous le souhaitez.',
    bookingExpiredHelp: "Si vous avez rencontré un problème lors du paiement ou avez besoin d'aide, répondez à cet email ou contactez-nous sur WhatsApp.",
    tryAgain: 'Réserver à nouveau',
    checkinReminderTitle: 'Votre check-in est demain !',
    checkinReminderIntro: "Plus qu'un jour ! Nous avons hâte de vous accueillir au Lapa Casa. Voici tout ce qu'il vous faut pour le check-in :",
    checkinReminderClosing: 'Des questions ? Répondez à cet email ou écrivez-nous sur WhatsApp.',
    reviewRequestTitle: "Comment s'est passé votre séjour ?",
    reviewRequestIntro: 'Nous espérons que votre séjour au Lapa Casa a été formidable !',
    reviewRequestBody: "Votre avis est très important pour nous et aide d'autres voyageurs à découvrir le Lapa Casa. Cela ne prend que 2 minutes — nous vous en serions très reconnaissants !",
    reviewRequestClosing: 'Merci pour votre visite. Nous espérons vous revoir bientôt !',
    leaveReview: 'Laisser un avis',
    referralRewardTitle: 'Votre récompense est arrivée !',
    referralRewardIntro: 'Quelqu\'un que vous avez recommandé vient de réserver au Lapa Casa — merci de nous faire connaître !',
    referralRewardBody: 'En guise de remerciement, voici un code de réduction de 10 % pour votre prochain séjour. Valable 90 jours.',
    referralRewardClosing: 'Nous espérons vous revoir bientôt !',
    useReward: 'Réserver avec ce code',
  },
  de: {
    greeting: 'Hallo',
    bookingConfirmationTitle: 'Buchung Bestätigt!',
    bookingConfirmationIntro: 'Wir haben Ihre Buchung erhalten. Hier sind die Details:',
    sameDayLabel: 'Heute zu zahlender Gesamtbetrag',
    reservation: 'Buchung',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    nights: 'Nächte',
    rooms: 'Unterkünfte',
    total: 'Gesamt',
    deposit: 'Anzahlung',
    remaining: 'Restbetrag',
    remainingDueNote: 'Der Restbetrag ist beim Check-in fällig.',
    checkInTime: 'Check-in Zeit',
    checkOutTime: 'Check-out Zeit',
    payNow: 'Jetzt bezahlen',
    paymentReminderTitle: 'Zahlungserinnerung',
    paymentReminderIntro: 'Der Restbetrag Ihrer Buchung ist noch ausstehend.',
    amountDue: 'Ausstehender Betrag',
    dueDate: 'Fälligkeitsdatum',
    daysUntilCheckIn: 'Tage bis zum Check-in',
    retryNote: 'Wir senden Ihnen in den nächsten Tagen bis zu 3 E-Mail-Erinnerungen.',
    paymentReceivedTitle: 'Zahlung Erhalten',
    paymentReceivedWelcome: 'Ihr Platz im Lapa Casa ist bestätigt!',
    paymentReceivedIntro: 'Wir bestätigen den Eingang Ihrer Zahlung. Wir freuen uns sehr auf Sie und können es kaum erwarten, Sie willkommen zu heißen!',
    amountPaid: 'Erhaltener Betrag',
    thanks: 'Vielen Dank! Bis bald.',
    remainingStillDue: 'Restbetrag noch ausstehend',
    fullyPaid: 'Ihre Buchung ist vollständig bezahlt.',
    welcomeTitle: 'Willkommen im Lapa Casa!',
    welcomeIntro: 'Wir freuen uns darauf, Sie zu empfangen. Hier sind einige nützliche Informationen:',
    address: 'Adresse',
    wifiNetwork: 'Netzwerk',
    wifiPassword: 'Passwort',
    tipsTitle: 'Lokale Tipps',
    tip1: 'Straßenbahn Santa Teresa: eine historische Fahrt nur wenige Gehminuten entfernt.',
    tip2: 'Selarón-Treppe: eine der meistfotografierten Sehenswürdigkeiten in Rio.',
    tip3: 'Lapa Nachtleben: Samba und Restaurants nur wenige Blocks entfernt.',
    cancellationTitle: 'Buchung Storniert',
    cancellationIntro: 'Ihre Buchung wurde wie gewünscht storniert.',
    refundAmount: 'Rückerstattungsbetrag',
    refundTimeline: 'Geschätzter Zeitraum: 5–10 Werktage.',
    noRefund: 'Gemäß unserer Stornierungsrichtlinie ist diese Buchung nicht erstattungsfähig.',
    noShowTitle: 'Nichterscheinen Registriert',
    noShowIntro: 'Wir haben festgestellt, dass Sie nicht zum Check-in erschienen sind.',
    chargeApplied: 'Angewandte Gebühr',
    policyNote: 'Gemäß unserer Stornierungsrichtlinie wird bei Nichterscheinen der volle Buchungsbetrag berechnet.',
    bookingExpiredTitle: 'Ihre Buchung wurde nicht abgeschlossen',
    bookingExpiredIntro: 'Sie haben eine Buchung im Lapa Casa begonnen, aber die Anzahlung wurde nicht rechtzeitig abgeschlossen — die Betten wurden freigegeben.',
    bookingExpiredCta: 'Wenn Sie immer noch bei uns übernachten möchten, können Sie jederzeit eine neue Buchung starten.',
    bookingExpiredHelp: 'Wenn etwas mit der Zahlung nicht geklappt hat oder Sie Hilfe benötigen, antworten Sie einfach auf diese E-Mail oder schreiben Sie uns auf WhatsApp.',
    tryAgain: 'Erneut buchen',
    checkinReminderTitle: 'Ihr Check-in ist morgen!',
    checkinReminderIntro: 'Nur noch ein Tag! Wir freuen uns darauf, Sie im Lapa Casa willkommen zu heißen. Hier ist alles, was Sie für den Check-in benötigen:',
    checkinReminderClosing: 'Haben Sie Fragen? Antworten Sie auf diese E-Mail oder schreiben Sie uns auf WhatsApp.',
    reviewRequestTitle: 'Wie war Ihr Aufenthalt?',
    reviewRequestIntro: 'Wir hoffen, dass Ihr Aufenthalt im Lapa Casa wunderbar war!',
    reviewRequestBody: 'Ihr Feedback bedeutet uns sehr viel und hilft anderen Reisenden, das Lapa Casa zu entdecken. Es dauert nur 2 Minuten — wir würden uns sehr freuen!',
    reviewRequestClosing: 'Vielen Dank für Ihren Besuch. Wir hoffen, Sie bald wiederzusehen!',
    leaveReview: 'Bewertung abgeben',
    referralRewardTitle: 'Ihre Belohnung ist eingetroffen!',
    referralRewardIntro: 'Jemand, den Sie empfohlen haben, hat gerade im Lapa Casa gebucht — vielen Dank!',
    referralRewardBody: 'Als Dankeschön erhalten Sie einen 10%-Rabattcode für Ihren nächsten Aufenthalt. Gültig für 90 Tage.',
    referralRewardClosing: 'Wir hoffen, Sie bald wiederzusehen!',
    useReward: 'Mit diesem Code buchen',
  },
  it: {
    greeting: 'Ciao',
    bookingConfirmationTitle: 'Prenotazione Confermata!',
    bookingConfirmationIntro: 'Abbiamo ricevuto la tua prenotazione. Ecco i dettagli:',
    sameDayLabel: 'Importo totale da pagare oggi',
    reservation: 'Prenotazione',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    nights: 'Notti',
    rooms: 'Sistemazioni',
    total: 'Totale',
    deposit: 'Acconto',
    remaining: 'Saldo residuo',
    remainingDueNote: 'Il saldo residuo è dovuto al momento del check-in.',
    checkInTime: 'Orario di check-in',
    checkOutTime: 'Orario di check-out',
    payNow: 'Paga ora',
    paymentReminderTitle: 'Promemoria di Pagamento',
    paymentReminderIntro: 'Il saldo della tua prenotazione è in attesa.',
    amountDue: 'Importo dovuto',
    dueDate: 'Scadenza',
    daysUntilCheckIn: 'Giorni al check-in',
    retryNote: 'Ti invieremo fino a 3 promemoria via email nei prossimi giorni.',
    paymentReceivedTitle: 'Pagamento Ricevuto',
    paymentReceivedWelcome: 'Il tuo posto al Lapa Casa è confermato!',
    paymentReceivedIntro: "Confermiamo la ricezione del tuo pagamento. Siamo molto felici di averti con noi e non vediamo l'ora di accoglierti!",
    amountPaid: 'Importo ricevuto',
    thanks: 'Grazie! A presto.',
    remainingStillDue: 'Saldo residuo ancora dovuto',
    fullyPaid: 'La tua prenotazione è completamente pagata.',
    welcomeTitle: 'Benvenuto al Lapa Casa!',
    welcomeIntro: "Non vediamo l'ora di accoglierti. Ecco alcune informazioni utili:",
    address: 'Indirizzo',
    wifiNetwork: 'Rete',
    wifiPassword: 'Password',
    tipsTitle: 'Consigli locali',
    tip1: 'Tram di Santa Teresa: un giro storico a pochi minuti a piedi.',
    tip2: 'Scalinata Selarón: uno dei monumenti più fotografati di Rio.',
    tip3: 'Vita notturna della Lapa: samba e ristoranti a pochi isolati.',
    cancellationTitle: 'Prenotazione Cancellata',
    cancellationIntro: 'La tua prenotazione è stata cancellata come richiesto.',
    refundAmount: 'Importo da rimborsare',
    refundTimeline: 'Tempistica stimata: 5–10 giorni lavorativi.',
    noRefund: 'In base alla nostra politica di cancellazione, questa prenotazione non è idonea al rimborso.',
    noShowTitle: 'Mancata Presentazione Registrata',
    noShowIntro: 'Abbiamo registrato che non ti sei presentato al check-in.',
    chargeApplied: 'Addebito applicato',
    policyNote: "In base alla nostra politica di cancellazione, l'importo totale viene addebitato in caso di mancata presentazione.",
    bookingExpiredTitle: 'La tua prenotazione non è stata completata',
    bookingExpiredIntro: "Hai iniziato una prenotazione al Lapa Casa, ma il pagamento dell'acconto non è stato completato in tempo — i letti sono stati liberati.",
    bookingExpiredCta: 'Se vuoi ancora soggiornare da noi, puoi iniziare una nuova prenotazione quando vuoi.',
    bookingExpiredHelp: 'Se hai avuto problemi con il pagamento o hai bisogno di aiuto, rispondi a questa email o scrivici su WhatsApp.',
    tryAgain: 'Prenota di nuovo',
    checkinReminderTitle: 'Il tuo check-in è domani!',
    checkinReminderIntro: "Manca solo un giorno! Non vediamo l'ora di accoglierti al Lapa Casa. Ecco tutto ciò di cui hai bisogno per il check-in:",
    checkinReminderClosing: 'Hai domande? Rispondi a questa email o scrivici su WhatsApp.',
    reviewRequestTitle: "Com'è stato il tuo soggiorno?",
    reviewRequestIntro: 'Speriamo che il tuo soggiorno al Lapa Casa sia stato fantastico!',
    reviewRequestBody: 'La tua opinione è molto importante per noi e aiuta altri viaggiatori a scoprire il Lapa Casa. Richiede solo 2 minuti — te ne saremmo molto grati!',
    reviewRequestClosing: 'Grazie per la tua visita. Speriamo di rivederti presto!',
    leaveReview: 'Lascia una recensione',
    referralRewardTitle: 'Il tuo premio è arrivato!',
    referralRewardIntro: 'Qualcuno che hai raccomandato ha appena prenotato al Lapa Casa — grazie per aver diffuso la voce!',
    referralRewardBody: 'Come ringraziamento, ecco un codice sconto del 10% per il tuo prossimo soggiorno. Valido per 90 giorni.',
    referralRewardClosing: 'Speriamo di rivederti presto!',
    useReward: 'Prenota con questo codice',
  },
};

function formatCurrency(amount: number, language: Language): string {
  const locales: Record<Language, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT' };
  return new Intl.NumberFormat(locales[language], { style: 'currency', currency: 'BRL' }).format(
    amount,
  );
}

function formatDate(date: Date | string, language: Language): string {
  const locales: Record<Language, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT' };
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locales[language], {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

function paymentButtonHtml(url: string | undefined, label: string): string {
  if (!url) {
    return '';
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:4px;background-color:#1a1a1a;">
    <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;">${label}</a>
  </td></tr></table>`;
}

async function getRoomsBreakdown(
  reservationId: string,
): Promise<Array<{ name: string; beds: number }>> {
  const { rows } = await query<{ name: string; beds: string }>(
    `SELECT rt.name AS name, COUNT(*)::int AS beds
     FROM reservation_beds rb
     JOIN beds b ON b.id = rb.bed_id
     JOIN room_types rt ON rt.id = b.room_type_id
     WHERE rb.reservation_id = $1
     GROUP BY rt.name
     ORDER BY rt.name`,
    [reservationId],
  );
  return rows.map((r) => ({ name: r.name, beds: Number(r.beds) }));
}

/**
 * Detecta si la reserva es de un apartamento consultando property_type.
 * Los apartamentos NO muestran la dirección del hostel en los emails —
 * la dirección del apartamento se comunica separadamente tras el pago.
 */
async function isApartmentBooking(reservationId: string): Promise<boolean> {
  try {
    const { rows } = await query<{ property_type: string }>(
      `SELECT DISTINCT rt.property_type
       FROM reservation_beds rb
       JOIN beds b ON b.id = rb.bed_id
       JOIN room_types rt ON rt.id = b.room_type_id
       WHERE rb.reservation_id = $1
       LIMIT 1`,
      [reservationId],
    );
    return rows[0]?.property_type === 'apartment';
  } catch {
    return false; // ante la duda, tratar como hostel
  }
}

/**
 * Obtiene la dirección del apartamento asociado a la reserva.
 * La dirección viene de room_types.address / address_number / cep
 * (cada apartamento es de un dueño distinto — es un marketplace).
 * Retorna null si no hay dirección cargada o no es un apartamento.
 */
async function getApartmentAddress(
  reservationId: string,
): Promise<{ name: string; street: string; number: string | null; cep: string | null } | null> {
  try {
    const { rows } = await query<{ name: string; address: string; address_number: string | null; cep: string | null }>(
      `SELECT rt.name, rt.address, rt.address_number, rt.cep
       FROM reservation_beds rb
       JOIN beds b ON b.id = rb.bed_id
       JOIN room_types rt ON rt.id = b.room_type_id
       WHERE rb.reservation_id = $1
         AND rt.property_type = 'apartment'
         AND rt.address IS NOT NULL
         AND rt.address != ''
       LIMIT 1`,
      [reservationId],
    );
    if (!rows[0]) { return null; }
    return { name: rows[0].name, street: rows[0].address, number: rows[0].address_number, cep: rows[0].cep };
  } catch {
    return null;
  }
}

function roomsListHtml(rooms: Array<{ name: string; beds: number }>): string {
  return rooms
    .map((r) => `<p style="margin:0 0 4px;font-size:14px;color:#444444;padding-left:8px;">• ${escapeText(r.name)}</p>`)
    .join('');
}

function buildAddressHtml(
  isApt: boolean,
  lang: Language,
  aptAddress?: { name: string; street: string; number: string | null; cep: string | null }
): string {
  const label = { pt: 'Endereço', en: 'Address', es: 'Dirección', fr: 'Adresse', de: 'Adresse', it: 'Indirizzo' }[lang];
  const mapsLabel = { pt: 'Ver no Google Maps →', en: 'View on Google Maps →', es: 'Ver en Google Maps →', fr: 'Voir sur Google Maps →', de: 'Auf Google Maps ansehen →', it: 'Vedi su Google Maps →' }[lang];
  const pendingMsg = {
    pt: 'O endereço exato será enviado por e-mail após a confirmação do pagamento.',
    en: 'The exact address will be sent by email once your payment is confirmed.',
    es: 'La dirección exacta se enviará por correo tras la confirmación del pago.',
    fr: "L'adresse exacte vous sera envoyée par e-mail une fois le paiement confirmé.",
    de: 'Die genaue Adresse wird Ihnen nach Zahlungsbestätigung per E-Mail zugesandt.',
    it: "L'indirizzo esatto verrà inviato via e-mail una volta confermato il pagamento.",
  }[lang];

  if (isApt) {
    if (aptAddress) {
      const fullAddress = aptAddress.street + (aptAddress.number ? ', ' + aptAddress.number : '');
      const street = escapeText(fullAddress);
      const aptName = escapeText(aptAddress.name);
      const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(fullAddress + ', Rio de Janeiro')}`;
      const mapImgUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(fullAddress + ', Rio de Janeiro')}&zoom=15&size=560x180&scale=2&markers=color:red|${encodeURIComponent(fullAddress + ', Rio de Janeiro')}&key=${process.env.GOOGLE_MAPS_API_KEY ?? ''}`;
      const mapBlock = process.env.GOOGLE_MAPS_API_KEY
        ? `<a href="${mapsUrl}"><img src="${mapImgUrl}" width="100%" style="display:block;border-radius:6px;margin-bottom:12px;" alt="Mapa" /></a>`
        : '';
      const cepLine = aptAddress.cep ? `<p style="margin:0 0 12px;font-size:14px;color:#333333;">CEP: ${escapeText(aptAddress.cep)}</p>` : '';
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8f5e9;border-radius:8px;margin-bottom:16px;border-left:4px solid #2e7d32;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#1b5e20;letter-spacing:0.8px;text-transform:uppercase;">📍 ${label}</p>
    <p style="margin:0 0 6px;font-size:15px;font-weight:bold;color:#2e7d32;">${aptName}</p>
    <p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#1a1a1a;">${street}</p>
    ${cepLine}
    ${mapBlock}
    <a href="${mapsUrl}" style="display:inline-block;background-color:#2e7d32;color:#ffffff;font-size:14px;font-weight:bold;padding:10px 20px;border-radius:4px;text-decoration:none;">${mapsLabel}</a>
  </td></tr>
</table>`;
    }
    // Apartamento sin dirección cargada aún: aviso prominente
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff8e1;border-radius:8px;margin-bottom:16px;border-left:4px solid #f59e0b;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#92400e;letter-spacing:0.8px;text-transform:uppercase;">📍 ${label}</p>
    <p style="margin:0;font-size:14px;color:#555555;">${pendingMsg}</p>
  </td></tr>
</table>`;
  }

  // Hostel
  const mapsUrl = HOSTEL_MAPS_URL;
  const mapImgUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(HOSTEL_STREET + ', Rio de Janeiro')}&zoom=15&size=560x180&scale=2&markers=color:red|${encodeURIComponent(HOSTEL_STREET + ', Rio de Janeiro')}&key=${process.env.GOOGLE_MAPS_API_KEY ?? ''}`;
  const mapBlock = process.env.GOOGLE_MAPS_API_KEY
    ? `<a href="${mapsUrl}"><img src="${mapImgUrl}" width="100%" style="display:block;border-radius:6px;margin-bottom:12px;" alt="Mapa" /></a>`
    : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8f5e9;border-radius:8px;margin-bottom:16px;border-left:4px solid #2e7d32;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#1b5e20;letter-spacing:0.8px;text-transform:uppercase;">📍 ${label}</p>
    <p style="margin:0 0 2px;font-size:18px;font-weight:bold;color:#1a1a1a;">${HOSTEL_STREET}</p>
    <p style="margin:0 0 12px;font-size:14px;color:#333333;">${HOSTEL_DISTRICT}, ${HOSTEL_CITY} · CEP ${HOSTEL_CEP}</p>
    ${mapBlock}
    <a href="${mapsUrl}" style="display:inline-block;background-color:#2e7d32;color:#ffffff;font-size:14px;font-weight:bold;padding:10px 20px;border-radius:4px;text-decoration:none;">${mapsLabel}</a>
  </td></tr>
</table>`;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class EmailService {
  async sendBookingConfirmation(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];
    const rooms = await getRoomsBreakdown(booking.id);
    const isApt = await isApartmentBooking(booking.id);

    // La dirección del apartamento NO se revela en la confirmación —
    // solo tras el pago del depósito (sendPaymentReceived). El hostel
    // sí muestra su dirección fija desde el primer email.
    const addressHtml = buildAddressHtml(isApt, language);

    // Horario de check-in según tipo de propiedad
    const checkInTime = isApt ? '15:00 – 22:00' : '14:00 – 22:00';
    const checkOutTime = '12:00';

    // Detectar check-in el mismo día (hora São Paulo)
    const todaySp = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());
    const checkInDs =
      booking.check_in_date instanceof Date
        ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(booking.check_in_date)
        : String(booking.check_in_date).slice(0, 10);
    const isSameDay = checkInDs === todaySp;

    // Bloque saldo restante — prominente cuando queda algo por pagar
    const remainingBlockHtml =
      booking.remaining_amount > 0
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff3cd;border-radius:8px;margin-bottom:20px;border:2px solid #f59e0b;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#92400e;letter-spacing:0.8px;text-transform:uppercase;">⚠️ ${escapeText(t.remaining)}</p>
    <p style="margin:0 0 8px;font-size:28px;font-weight:bold;color:#1a1a1a;">${formatCurrency(booking.remaining_amount, language)}</p>
    <p style="margin:0;font-size:14px;color:#92400e;">${escapeText(t.remainingDueNote)}</p>
  </td></tr>
</table>`
        : `<p style="margin:0 0 20px;font-size:14px;color:#0a7d2c;font-weight:bold;">${escapeText(t.fullyPaid)}</p>`;

    // Bloque check-in hoy: aviso del total completo a pagar en la recepción
    const sameDayHtml =
      isSameDay && booking.remaining_amount > 0
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8f5e9;border-radius:8px;margin-top:20px;border-left:4px solid #2e7d32;">
  <tr><td style="padding:14px 18px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#1b5e20;letter-spacing:0.8px;text-transform:uppercase;">💳 ${escapeText(t.sameDayLabel ?? 'Valor total a pagar hoje')}</p>
    <p style="margin:0;font-size:20px;font-weight:bold;color:#1a1a1a;">${formatCurrency(booking.final_price, language)}</p>
  </td></tr>
</table>`
        : '';

    const html = renderEmailTemplate('booking-confirmation', {
      emailTitle: t.bookingConfirmationTitle,
      labelTitle: t.bookingConfirmationTitle,
      labelGreeting: t.greeting,
      labelIntro: t.bookingConfirmationIntro,
      labelReservation: t.reservation,
      labelCheckIn: t.checkIn,
      labelCheckOut: t.checkOut,
      labelNights: t.nights,
      labelRooms: t.rooms,
      labelTotal: t.total,
      labelDeposit: t.deposit,
      guestName: booking.guest.full_name,
      reservationNumber: booking.reservation_number,
      checkInFormatted: formatDate(booking.check_in_date, language),
      checkOutFormatted: formatDate(booking.check_out_date, language),
      checkInTime,
      checkOutTime,
      nightsCount: booking.nights_count,
      roomsHtml: roomsListHtml(rooms),
      addressHtml,
      totalPriceFormatted: formatCurrency(booking.final_price, language),
      depositAmountFormatted: formatCurrency(booking.deposit_amount, language),
      depositPercent: Math.round(booking.deposit_percent * 100),
      remainingBlockHtml,
      // Solo mostrar botón de pago si queda saldo pendiente — si ya está
      // totalmente pagado no tiene sentido mostrar "Pagar ahora".
      paymentButtonHtml: booking.remaining_amount > 0
        ? paymentButtonHtml(`${FRONTEND_URL}/${language}/payment/${booking.id}`, t.payNow)
        : '',
      sameDayHtml,
    });

    return dispatch(
      booking.guest.email,
      `${t.bookingConfirmationTitle} #${booking.reservation_number}`,
      html,
    );
  }

  async sendPaymentReminder(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];
    const checkIn = new Date(booking.check_in_date);
    const daysUntilCheckIn = Math.max(
      0,
      Math.ceil((checkIn.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );

    const html = renderEmailTemplate('payment-reminder', {
      emailTitle: t.paymentReminderTitle,
      labelTitle: t.paymentReminderTitle,
      labelGreeting: t.greeting,
      labelIntro: t.paymentReminderIntro,
      labelReservation: t.reservation,
      labelAmountDue: t.amountDue,
      labelDueDate: t.dueDate,
      labelDaysUntilCheckIn: t.daysUntilCheckIn,
      labelRetryNote: t.retryNote,
      guestName: booking.guest.full_name,
      reservationNumber: booking.reservation_number,
      remainingAmountFormatted: formatCurrency(booking.remaining_amount, language),
      dueDateFormatted: formatDate(checkIn, language),
      daysUntilCheckIn,
      paymentButtonHtml: paymentButtonHtml(
        `${FRONTEND_URL}/${language}/payment/${booking.id}`,
        t.payNow,
      ),
    });

    return dispatch(
      booking.guest.email,
      `${t.paymentReminderTitle} #${booking.reservation_number}`,
      html,
    );
  }

  async sendPaymentReceived(booking: BookingWithGuest, amount: number): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];
    const stillDue = booking.remaining_amount > 0;

    // Para apartamentos: este email es el momento en que se revela la dirección.
    // El huésped pagó el 30% — ahora tiene derecho a saber dónde está el apartamento.
    const isApt = await isApartmentBooking(booking.id);
    const aptAddress = isApt ? await getApartmentAddress(booking.id) : null;
    const addressHtml = buildAddressHtml(isApt, language, aptAddress ?? undefined);

    const aptWelcomeByLang: Record<string, (name: string) => string> = {
      pt: (name) => `Sua reserva no ${name} está confirmada!`,
      en: (name) => `Your reservation at ${name} is confirmed!`,
      es: (name) => `¡Tu reserva en ${name} ya está confirmada!`,
      fr: (name) => `Votre réservation au ${name} est confirmée !`,
      de: (name) => `Ihre Buchung im ${name} ist bestätigt!`,
      it: (name) => `La tua prenotazione al ${name} è confermata!`,
    };
    const labelWelcome = (isApt && aptAddress?.name)
      ? (aptWelcomeByLang[language] ?? aptWelcomeByLang['en'])(aptAddress.name)
      : t.paymentReceivedWelcome;

    const remainingSectionHtml = stillDue
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
           <tr><td style="padding:6px 0;font-size:14px;color:#555555;">${t.remainingStillDue}</td>
           <td align="right" style="padding:6px 0;font-size:14px;font-weight:bold;">${formatCurrency(booking.remaining_amount, language)}</td></tr>
         </table>`
      : `<p style="margin:0 0 24px;font-size:14px;color:#0a7d2c;font-weight:bold;">${t.fullyPaid}</p>`;

    const html = renderEmailTemplate('payment-received', {
      emailTitle: t.paymentReceivedTitle,
      labelTitle: t.paymentReceivedTitle,
      labelGreeting: t.greeting,
      labelWelcome,
      labelIntro: t.paymentReceivedIntro,
      labelReservation: t.reservation,
      labelAmountPaid: t.amountPaid,
      labelThanks: t.thanks,
      guestName: booking.guest.full_name,
      reservationNumber: booking.reservation_number,
      amountFormatted: formatCurrency(amount, language),
      remainingSectionHtml,
      addressHtml,
    });

    return dispatch(
      booking.guest.email,
      `${t.paymentReceivedTitle} #${booking.reservation_number}`,
      html,
    );
  }

  async sendWelcomeEmail(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];

    // Para apartamentos: la bienvenida llega después de que el pago se confirmó,
    // así que la dirección real ya puede mostrarse (viene de room_types en la BD).
    const isApt = await isApartmentBooking(booking.id);
    const aptAddress = isApt ? await getApartmentAddress(booking.id) : null;
    const addressHtml = buildAddressHtml(isApt, language, aptAddress ?? undefined);

    const html = renderEmailTemplate('welcome-message', {
      emailTitle: t.welcomeTitle,
      labelTitle: t.welcomeTitle,
      labelGreeting: t.greeting,
      labelIntro: t.welcomeIntro,
      labelCheckIn: t.checkIn,
      labelAddress: t.address,
      labelWifiNetwork: isApt ? '' : t.wifiNetwork,
      labelWifiPassword: isApt ? '' : t.wifiPassword,
      labelTipsTitle: t.tipsTitle,
      labelTip1: t.tip1,
      labelTip2: t.tip2,
      labelTip3: t.tip3,
      guestName: booking.guest.full_name,
      checkInDateFormatted: formatDate(booking.check_in_date, language),
      checkInTime: isApt ? '15:00 – 22:00' : '14:00 – 22:00',
      addressHtml,
      wifiNetwork: isApt ? '' : 'LAPA_CASA_GUESTS',
      wifiPassword: isApt ? '' : 'santateresa2024',
    });

    return dispatch(
      booking.guest.email,
      `${t.welcomeTitle} #${booking.reservation_number}`,
      html,
    );
  }

  async sendCancellationNotice(
    booking: BookingWithGuest,
    refundAmount: number,
  ): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];

    const refundSectionHtml =
      refundAmount > 0
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
           <tr><td style="padding:6px 0;font-size:14px;color:#555555;">${t.refundAmount}</td>
           <td align="right" style="padding:6px 0;font-size:14px;font-weight:bold;color:#0a7d2c;">${formatCurrency(refundAmount, language)}</td></tr>
         </table><p style="margin:0;font-size:13px;color:#777777;">${t.refundTimeline}</p>`
        : `<p style="margin:0;font-size:14px;color:#555555;">${t.noRefund}</p>`;

    const html = renderEmailTemplate('cancellation-notice', {
      emailTitle: t.cancellationTitle,
      labelTitle: t.cancellationTitle,
      labelGreeting: t.greeting,
      labelIntro: t.cancellationIntro,
      labelReservation: t.reservation,
      guestName: booking.guest.full_name,
      reservationNumber: booking.reservation_number,
      refundSectionHtml,
    });

    return dispatch(
      booking.guest.email,
      `${t.cancellationTitle} #${booking.reservation_number}`,
      html,
    );
  }

  async sendNoShowNotice(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];

    const html = renderEmailTemplate('no-show-notice', {
      emailTitle: t.noShowTitle,
      labelTitle: t.noShowTitle,
      labelGreeting: t.greeting,
      labelIntro: t.noShowIntro,
      labelReservation: t.reservation,
      labelCheckIn: t.checkIn,
      labelChargeApplied: t.chargeApplied,
      labelPolicyNote: t.policyNote,
      guestName: booking.guest.full_name,
      reservationNumber: booking.reservation_number,
      checkInDateFormatted: formatDate(booking.check_in_date, language),
      chargeAmountFormatted: formatCurrency(booking.final_price, language),
    });

    return dispatch(booking.guest.email, `${t.noShowTitle} #${booking.reservation_number}`, html);
  }

  /** Se manda cuando el hold de 5 min vence sin que se pagara el depósito (sp_cleanup_expired_pending, ver cleanup.worker.ts) -- no es un no-show ni una cancelación pedida por el huésped, así que tiene su propio texto e invita a reintentar o pedir ayuda. */
  async sendBookingExpiredNotice(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];

    const html = renderEmailTemplate('booking-expired', {
      emailTitle: t.bookingExpiredTitle,
      labelTitle: t.bookingExpiredTitle,
      labelGreeting: t.greeting,
      labelIntro: t.bookingExpiredIntro,
      labelCta: t.bookingExpiredCta,
      labelHelp: t.bookingExpiredHelp,
      guestName: booking.guest.full_name,
      tryAgainButtonHtml: paymentButtonHtml(FRONTEND_URL, t.tryAgain),
      whatsappUrl: WHATSAPP_CONTACT_URL,
    });

    return dispatch(booking.guest.email, t.bookingExpiredTitle, html);
  }

  /** Notifica al titular cuando todos los invitados completaron el pago grupal. */
  async sendGroupPaymentComplete(params: {
    titularEmail: string;
    titularName: string;
    reservationNumber: string;
    totalBeds: number;
    checkIn: string;
  }): Promise<SendResult> {
    const checkInFormatted = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(params.checkIn));
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h2 style="font-size:20px;font-weight:700;margin-bottom:16px;color:#1a1a1a;">Reserva grupal confirmada!</h2>
        <p style="font-size:14px;color:#555;margin-bottom:12px;">Olá ${escapeText(params.titularName)},</p>
        <p style="font-size:14px;color:#555;margin-bottom:20px;">
          Todos os membros do seu grupo concluíram o pagamento. Sua reserva grupal no Lapa Casa está confirmada!
        </p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:20px;font-size:13px;color:#333;">
          <div><strong>Reserva:</strong> ${escapeText(params.reservationNumber)}</div>
          <div><strong>Camas:</strong> ${params.totalBeds}</div>
          <div><strong>Check-in:</strong> ${checkInFormatted}</div>
        </div>
        <p style="font-size:13px;color:#888;">Lapa Casa Hostel — Rio de Janeiro</p>
      </div>
    `;
    return dispatch(
      params.titularEmail,
      `Reserva grupal confirmada — ${params.reservationNumber}`,
      html,
    );
  }

  /** Notifica a un invitado que no pagó que el tiempo expiró, con link para reservar individualmente. */
  async sendGroupPaymentExpiredToUnpaid(params: {
    guestEmail: string;
    guestName: string;
    bookingUrl: string;
  }): Promise<SendResult> {
    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
        <h2 style="font-size:20px;font-weight:700;margin-bottom:16px;color:#1a1a1a;">O tempo do pagamento grupal expirou</h2>
        <p style="font-size:14px;color:#555;margin-bottom:12px;">Olá ${escapeText(params.guestName)},</p>
        <p style="font-size:14px;color:#555;margin-bottom:20px;">
          O tempo para concluir o pagamento grupal expirou e o seu lugar não foi confirmado.
          Se ainda quiser reservar uma cama no Lapa Casa Hostel, você pode fazer isso diretamente:
        </p>
        <a href="${params.bookingUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:7px;text-decoration:none;">
          Reservar minha cama
        </a>
        <p style="margin-top:20px;font-size:13px;color:#888;">Lapa Casa Hostel — Rio de Janeiro</p>
      </div>
    `;
    return dispatch(
      params.guestEmail,
      'Seu lugar no grupo não foi confirmado — Lapa Casa Hostel',
      html,
    );
  }

  /**
   * Recordatorio 48h antes del check-in.
   * Enviado por el cleanup worker a reservas confirmadas con check-in entre 46h y 50h desde ahora.
   */
  async sendCheckinReminder(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];
    const isApt = await isApartmentBooking(booking.id);

    // Checkin es mañana: la reserva ya está confirmada y pagada, mostrar dirección real
    const aptAddress = isApt ? await getApartmentAddress(booking.id) : null;
    const addressHtml = buildAddressHtml(isApt, language, aptAddress ?? undefined);

    const checkOutDate = new Date(booking.check_out_date);
    const html = renderEmailTemplate('checkin-reminder', {
      emailTitle: t.checkinReminderTitle,
      labelTitle: t.checkinReminderTitle,
      labelGreeting: t.greeting,
      labelIntro: t.checkinReminderIntro,
      labelReservation: t.reservation,
      labelCheckIn: t.checkIn,
      labelCheckOut: t.checkOut,
      labelAddress: t.address,
      labelTipsTitle: t.tipsTitle,
      labelTip1: t.tip1,
      labelTip2: t.tip2,
      labelTip3: t.tip3,
      labelClosing: t.checkinReminderClosing,
      guestName: booking.guest.full_name,
      reservationNumber: booking.reservation_number,
      checkInFormatted: formatDate(booking.check_in_date, language),
      checkOutFormatted: formatDate(checkOutDate, language),
      checkInTime: isApt ? '15:00 – 22:00' : '14:00 – 22:00',
      addressHtml,
    });

    const subjects: Record<Language, string> = {
      pt: `Lembrete: seu check-in e amanha — ${booking.reservation_number}`,
      en: `Reminder: your check-in is tomorrow — ${booking.reservation_number}`,
      es: `Recordatorio: tu check-in es manana — ${booking.reservation_number}`,
      fr: `Rappel : votre check-in est demain — ${booking.reservation_number}`,
      de: `Erinnerung: Ihr Check-in ist morgen — ${booking.reservation_number}`,
      it: `Promemoria: il tuo check-in è domani — ${booking.reservation_number}`,
    };
    return dispatch(booking.guest.email, subjects[language], html);
  }

  /**
   * Email post-checkout pidiendo reseña.
   * Enviado por el cleanup worker 24-48h después del check-out de reservas completadas.
   */
  async sendReviewRequest(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];

    // URL de reseña de Google Maps (configurable via env var)
    const reviewUrl = process.env.GOOGLE_REVIEW_URL || 'https://g.page/r/lapacasario/review';

    const html = renderEmailTemplate('review-request', {
      emailTitle: t.reviewRequestTitle,
      labelTitle: t.reviewRequestTitle,
      labelGreeting: t.greeting,
      labelIntro: t.reviewRequestIntro,
      labelReservation: t.reservation,
      labelCheckOut: t.checkOut,
      labelBody: t.reviewRequestBody,
      labelClosing: t.reviewRequestClosing,
      guestName: booking.guest.full_name,
      reservationNumber: booking.reservation_number,
      checkOutFormatted: formatDate(booking.check_out_date, language),
      reviewButtonHtml: paymentButtonHtml(reviewUrl, t.leaveReview),
    });

    const subjects: Record<Language, string> = {
      pt: `Como foi a sua estadia no Lapa Casa?`,
      en: `How was your stay at Lapa Casa?`,
      es: `Como fue tu estadía en Lapa Casa?`,
      fr: `Comment s'est passé votre séjour au Lapa Casa ?`,
      de: `Wie war Ihr Aufenthalt im Lapa Casa?`,
      it: `Com'è stato il tuo soggiorno al Lapa Casa?`,
    };
    return dispatch(booking.guest.email, subjects[language], html);
  }

  /**
   * Email al referidor cuando alguien usa su código (idea #49, roadmap.html).
   * No recibe un `BookingWithGuest` completo -- se dispara desde
   * create-booking.ts sobre el GUEST del referidor (una reserva vieja
   * suya), no sobre la reserva nueva que acaba de redimir el código.
   */
  async sendReferralReward(
    referrer: { fullName: string; email: string; language: string | null },
    rewardCode: string,
  ): Promise<SendResult> {
    const language = resolveLanguage(referrer.language);
    const t = LABELS[language];
    const siteUrl = process.env.FRONTEND_URL || 'https://lapacasario.com';

    const html = renderEmailTemplate('referral-reward', {
      emailTitle: t.referralRewardTitle,
      labelTitle: t.referralRewardTitle,
      labelGreeting: t.greeting,
      labelIntro: t.referralRewardIntro,
      labelBody: t.referralRewardBody,
      labelClosing: t.referralRewardClosing,
      guestName: referrer.fullName,
      rewardCode,
      rewardButtonHtml: paymentButtonHtml(`${siteUrl}/${language}/hostel`, t.useReward),
    });

    const subjects: Record<Language, string> = {
      pt: `Seu presente por indicar um amigo ao Lapa Casa`,
      en: `Your reward for referring a friend to Lapa Casa`,
      es: `Tu premio por recomendar a un amigo a Lapa Casa`,
      fr: `Votre cadeau pour avoir recommandé Lapa Casa à un ami`,
      de: `Ihr Dankeschön für die Empfehlung von Lapa Casa`,
      it: `Il tuo premio per aver raccomandato Lapa Casa a un amico`,
    };
    return dispatch(referrer.email, subjects[language], html);
  }

  /** Alerta interna al administrador — siempre en portugués, no depende del idioma de un huésped. */
  async sendAdminAlert(type: string, data: Record<string, any>): Promise<SendResult> {
    const bookingSectionHtml = data.reservationNumber
      ? `<p style="margin:0;font-size:13px;color:#666666;"><strong>Reserva:</strong> ${escapeText(String(data.reservationNumber))}</p>`
      : '';
    const messageLines = Object.entries(data)
      .map(([key, value]) => `<strong>${escapeText(key)}:</strong> ${escapeText(String(value))}`)
      .join('<br>');

    const html = renderEmailTemplate('admin-alert', {
      emailTitle: `[ADMIN] ${type}`,
      alertTitle: type,
      alertMessageHtml: messageLines || '—',
      bookingSectionHtml,
      timestampFormatted: new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date()),
    });

    return dispatch(ADMIN_EMAIL, `[ADMIN] ${type}`, html);
  }
}

export const emailService = new EmailService();
