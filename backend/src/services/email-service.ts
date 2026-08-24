// lapa-casa-hostel/backend/src/services/email-service.ts
// ventana4
//
// Servicio de emails real, vía Resend. Sigue el mismo patron de
// degradacion que src/cache/redis-client.ts y src/lib/payments/stripe-handler.ts:
// sin RESEND_API_KEY configurada, no revienta -- loguea y sigue (util en
// dev/tests sin cuenta de Resend todavia).

import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { query } from '../config/database';
import { renderEmailTemplate } from '../templates/render';
import { logger } from '../utils/logger';
import type { Reservation, Guest } from '../types/database';

type Language = 'pt' | 'en' | 'es';
export type BookingWithGuest = Reservation & { guest: Guest };

function resolveLanguage(raw: string | null | undefined): Language {
  return raw === 'en' || raw === 'es' ? raw : 'pt';
}

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'reservas@lapacasario.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Lapa Casa';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@lapacasario.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://lapacasario.com';
const WHATSAPP_CONTACT_URL = 'https://wa.me/5521977157530';

let resendClient: Resend | null = null;
let warnedNoApiKey = false;

// Gmail SMTP transporter (creado una sola vez si las variables están presentes)
let gmailTransporter: nodemailer.Transporter | null = null;

function getGmailTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
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
  if (!resendClient) resendClient = new Resend(apiKey);
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
      html
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
    html
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
    greeting: 'Olá', bookingConfirmationTitle: 'Reserva Confirmada!',
    bookingConfirmationIntro: 'Recebemos sua reserva. Confira os detalhes abaixo:',
    reservation: 'Reserva', checkIn: 'Check-in', checkOut: 'Check-out', nights: 'Noites', rooms: 'Acomodações',
    total: 'Total', deposit: 'Depósito', remaining: 'Saldo restante', checkInTime: 'Horário de check-in', checkOutTime: 'Horário de check-out',
    payNow: 'Pagar agora',
    paymentReminderTitle: 'Lembrete de Pagamento', paymentReminderIntro: 'O saldo da sua reserva está pendente.',
    amountDue: 'Valor pendente', dueDate: 'Vencimento', daysUntilCheckIn: 'Dias até o check-in',
    retryNote: 'Vamos te enviar até 3 lembretes por email nos próximos dias.',
    paymentReceivedTitle: 'Pagamento Recebido', paymentReceivedIntro: 'Confirmamos o recebimento do seu pagamento.',
    amountPaid: 'Valor recebido', thanks: 'Obrigado! Nos vemos em breve.',
    remainingStillDue: 'Saldo restante ainda pendente',
    fullyPaid: 'Sua reserva está totalmente paga.',
    welcomeTitle: 'Bem-vindo ao Lapa Casa!', welcomeIntro: 'Estamos ansiosos para recebê-lo. Aqui vão algumas informações úteis:',
    address: 'Endereço', wifiNetwork: 'Rede', wifiPassword: 'Senha',
    tipsTitle: 'Dicas locais',
    tip1: 'Bondinho de Santa Teresa: passeio histórico a poucos minutos a pé.',
    tip2: 'Escadaria Selarón: um dos pontos turísticos mais fotografados do Rio.',
    tip3: 'Centro da Lapa: vida noturna, samba e restaurantes a poucos quarteirões.',
    cancellationTitle: 'Reserva Cancelada', cancellationIntro: 'Sua reserva foi cancelada conforme solicitado.',
    refundAmount: 'Valor a reembolsar', refundTimeline: 'Prazo estimado: 5-10 dias úteis.',
    noRefund: 'De acordo com a política de cancelamento, esta reserva não é elegível para reembolso.',
    noShowTitle: 'Não Comparecimento Registrado', noShowIntro: 'Registramos que você não compareceu para o check-in da sua reserva.',
    chargeApplied: 'Cobrança aplicada',
    policyNote: 'De acordo com nossa política de cancelamento, o valor total da reserva é cobrado em caso de não comparecimento (no-show).',
    bookingExpiredTitle: 'Sua reserva não foi concluída',
    bookingExpiredIntro: 'Vimos que você começou uma reserva no Lapa Casa, mas o pagamento do depósito não foi concluído a tempo, então as camas foram liberadas.',
    bookingExpiredCta: 'Se ainda quiser se hospedar, você pode iniciar uma nova reserva quando quiser.',
    bookingExpiredHelp: 'Se teve algum problema no pagamento ou precisa de ajuda, é só responder este email ou nos chamar no WhatsApp.',
    tryAgain: 'Reservar novamente'
  },
  en: {
    greeting: 'Hello', bookingConfirmationTitle: 'Booking Confirmed!',
    bookingConfirmationIntro: 'We received your booking. Here are the details:',
    reservation: 'Booking', checkIn: 'Check-in', checkOut: 'Check-out', nights: 'Nights', rooms: 'Accommodations',
    total: 'Total', deposit: 'Deposit', remaining: 'Remaining balance', checkInTime: 'Check-in time', checkOutTime: 'Check-out time',
    payNow: 'Pay now',
    paymentReminderTitle: 'Payment Reminder', paymentReminderIntro: 'The remaining balance of your booking is due.',
    amountDue: 'Amount due', dueDate: 'Due date', daysUntilCheckIn: 'Days until check-in',
    retryNote: 'We\'ll send you up to 3 email reminders over the next few days.',
    paymentReceivedTitle: 'Payment Received', paymentReceivedIntro: 'We confirm we received your payment.',
    amountPaid: 'Amount received', thanks: 'Thank you! See you soon.',
    remainingStillDue: 'Remaining balance still due',
    fullyPaid: 'Your booking is fully paid.',
    welcomeTitle: 'Welcome to Lapa Casa!', welcomeIntro: "We're looking forward to hosting you. Some useful info:",
    address: 'Address', wifiNetwork: 'Network', wifiPassword: 'Password',
    tipsTitle: 'Local tips',
    tip1: 'Santa Teresa tram: a historic ride just a short walk away.',
    tip2: 'Selarón Steps: one of the most photographed landmarks in Rio.',
    tip3: 'Lapa nightlife: samba and restaurants a few blocks away.',
    cancellationTitle: 'Booking Cancelled', cancellationIntro: 'Your booking has been cancelled as requested.',
    refundAmount: 'Refund amount', refundTimeline: 'Estimated timeline: 5-10 business days.',
    noRefund: 'Per our cancellation policy, this booking is not eligible for a refund.',
    noShowTitle: 'No-Show Recorded', noShowIntro: 'We recorded that you did not check in for your booking.',
    chargeApplied: 'Charge applied',
    policyNote: 'Per our cancellation policy, the full booking amount is charged in case of no-show.',
    bookingExpiredTitle: 'Your booking wasn\'t completed',
    bookingExpiredIntro: 'We saw you started a booking at Lapa Casa, but the deposit payment wasn\'t completed in time, so the beds were released.',
    bookingExpiredCta: 'If you\'d still like to stay with us, you can start a new booking whenever you\'re ready.',
    bookingExpiredHelp: 'If something went wrong with the payment or you need help, just reply to this email or message us on WhatsApp.',
    tryAgain: 'Book again'
  },
  es: {
    greeting: 'Hola', bookingConfirmationTitle: '¡Reserva Confirmada!',
    bookingConfirmationIntro: 'Recibimos tu reserva. Estos son los detalles:',
    reservation: 'Reserva', checkIn: 'Check-in', checkOut: 'Check-out', nights: 'Noches', rooms: 'Alojamientos',
    total: 'Total', deposit: 'Depósito', remaining: 'Saldo restante', checkInTime: 'Horario de check-in', checkOutTime: 'Horario de check-out',
    payNow: 'Pagar ahora',
    paymentReminderTitle: 'Recordatorio de Pago', paymentReminderIntro: 'El saldo de tu reserva está pendiente.',
    amountDue: 'Monto pendiente', dueDate: 'Vencimiento', daysUntilCheckIn: 'Días hasta el check-in',
    retryNote: 'Te vamos a mandar hasta 3 recordatorios por email en los próximos días.',
    paymentReceivedTitle: 'Pago Recibido', paymentReceivedIntro: 'Confirmamos la recepción de tu pago.',
    amountPaid: 'Monto recibido', thanks: '¡Gracias! Nos vemos pronto.',
    remainingStillDue: 'Saldo restante aún pendiente',
    fullyPaid: 'Tu reserva está totalmente pagada.',
    welcomeTitle: '¡Bienvenido a Lapa Casa!', welcomeIntro: 'Estamos ansiosos por recibirte. Aquí va información útil:',
    address: 'Dirección', wifiNetwork: 'Red', wifiPassword: 'Contraseña',
    tipsTitle: 'Tips locales',
    tip1: 'Tranvía de Santa Teresa: paseo histórico a pocos minutos caminando.',
    tip2: 'Escalera Selarón: uno de los puntos turísticos más fotografiados de Río.',
    tip3: 'Vida nocturna de Lapa: samba y restaurantes a pocas cuadras.',
    cancellationTitle: 'Reserva Cancelada', cancellationIntro: 'Tu reserva fue cancelada según lo solicitado.',
    refundAmount: 'Monto a reembolsar', refundTimeline: 'Plazo estimado: 5-10 días hábiles.',
    noRefund: 'Según nuestra política de cancelación, esta reserva no es elegible para reembolso.',
    noShowTitle: 'No Presentación Registrada', noShowIntro: 'Registramos que no realizaste el check-in de tu reserva.',
    chargeApplied: 'Cargo aplicado',
    policyNote: 'Según nuestra política de cancelación, se cobra el monto total de la reserva en caso de no presentación (no-show).',
    bookingExpiredTitle: 'Tu reserva no se completó',
    bookingExpiredIntro: 'Vimos que empezaste una reserva en Lapa Casa, pero el pago del depósito no se completó a tiempo, así que las camas quedaron liberadas.',
    bookingExpiredCta: 'Si todavía querés hospedarte, podés iniciar una nueva reserva cuando quieras.',
    bookingExpiredHelp: 'Si tuviste algún problema con el pago o necesitás ayuda, respondé este email o escribinos por WhatsApp.',
    tryAgain: 'Reservar de nuevo'
  }
};

function formatCurrency(amount: number, language: Language): string {
  const locales: Record<Language, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
  return new Intl.NumberFormat(locales[language], { style: 'currency', currency: 'BRL' }).format(amount);
}

function formatDate(date: Date | string, language: Language): string {
  const locales: Record<Language, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locales[language], { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d);
}

function paymentButtonHtml(url: string | undefined, label: string): string {
  if (!url) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:4px;background-color:#1a1a1a;">
    <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;">${label}</a>
  </td></tr></table>`;
}

async function getRoomsBreakdown(reservationId: string): Promise<Array<{ name: string; beds: number }>> {
  const { rows } = await query<{ name: string; beds: string }>(
    `SELECT rt.name AS name, COUNT(*)::int AS beds
     FROM reservation_beds rb
     JOIN beds b ON b.id = rb.bed_id
     JOIN room_types rt ON rt.id = b.room_type_id
     WHERE rb.reservation_id = $1
     GROUP BY rt.name
     ORDER BY rt.name`,
    [reservationId]
  );
  return rows.map(r => ({ name: r.name, beds: Number(r.beds) }));
}

function roomsListHtml(rooms: Array<{ name: string; beds: number }>, bedLabel: string): string {
  return rooms
    .map(r => `<p style="margin:0 0 4px;font-size:14px;color:#444444;padding-left:8px;">• ${escapeText(r.name)}: ${r.beds} ${bedLabel}</p>`)
    .join('');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class EmailService {
  async sendBookingConfirmation(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];
    const rooms = await getRoomsBreakdown(booking.id);
    const bedLabel = { pt: 'camas', en: 'beds', es: 'camas' }[language];

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
      labelRemaining: t.remaining,
      labelCheckInTime: t.checkInTime,
      labelCheckOutTime: t.checkOutTime,
      guestName: booking.guest.full_name,
      reservationNumber: booking.reservation_number,
      checkInFormatted: formatDate(booking.check_in_date, language),
      checkOutFormatted: formatDate(booking.check_out_date, language),
      nightsCount: booking.nights_count,
      roomsHtml: roomsListHtml(rooms, bedLabel),
      totalPriceFormatted: formatCurrency(booking.final_price, language),
      depositAmountFormatted: formatCurrency(booking.deposit_amount, language),
      depositPercent: Math.round(booking.deposit_percent * 100),
      remainingAmountFormatted: formatCurrency(booking.remaining_amount, language),
      paymentButtonHtml: paymentButtonHtml(`${FRONTEND_URL}/${language}/payment/${booking.id}`, t.payNow)
    });

    return dispatch(booking.guest.email, `${t.bookingConfirmationTitle} #${booking.reservation_number}`, html);
  }

  async sendPaymentReminder(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];
    const checkIn = new Date(booking.check_in_date);
    const daysUntilCheckIn = Math.max(0, Math.ceil((checkIn.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

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
      paymentButtonHtml: paymentButtonHtml(`${FRONTEND_URL}/${language}/payment/${booking.id}`, t.payNow)
    });

    return dispatch(booking.guest.email, `${t.paymentReminderTitle} #${booking.reservation_number}`, html);
  }

  async sendPaymentReceived(booking: BookingWithGuest, amount: number): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];
    const stillDue = booking.remaining_amount > 0;

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
      labelIntro: t.paymentReceivedIntro,
      labelReservation: t.reservation,
      labelAmountPaid: t.amountPaid,
      labelThanks: t.thanks,
      guestName: booking.guest.full_name,
      reservationNumber: booking.reservation_number,
      amountFormatted: formatCurrency(amount, language),
      remainingSectionHtml
    });

    return dispatch(booking.guest.email, `${t.paymentReceivedTitle} #${booking.reservation_number}`, html);
  }

  async sendWelcomeEmail(booking: BookingWithGuest): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];

    const html = renderEmailTemplate('welcome-message', {
      emailTitle: t.welcomeTitle,
      labelTitle: t.welcomeTitle,
      labelGreeting: t.greeting,
      labelIntro: t.welcomeIntro,
      labelCheckIn: t.checkIn,
      labelAddress: t.address,
      labelWifiNetwork: t.wifiNetwork,
      labelWifiPassword: t.wifiPassword,
      labelTipsTitle: t.tipsTitle,
      labelTip1: t.tip1,
      labelTip2: t.tip2,
      labelTip3: t.tip3,
      guestName: booking.guest.full_name,
      checkInDateFormatted: formatDate(booking.check_in_date, language),
      checkInTime: '14:00',
      address: 'Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro',
      wifiNetwork: 'LAPA_CASA_GUESTS',
      wifiPassword: 'santateresa2024'
    });

    return dispatch(booking.guest.email, t.welcomeTitle, html);
  }

  async sendCancellationNotice(booking: BookingWithGuest, refundAmount: number): Promise<SendResult> {
    const language = resolveLanguage(booking.guest.language);
    const t = LABELS[language];

    const refundSectionHtml = refundAmount > 0
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
      refundSectionHtml
    });

    return dispatch(booking.guest.email, `${t.cancellationTitle} #${booking.reservation_number}`, html);
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
      chargeAmountFormatted: formatCurrency(booking.final_price, language)
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
      whatsappUrl: WHATSAPP_CONTACT_URL
    });

    return dispatch(booking.guest.email, t.bookingExpiredTitle, html);
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
      timestampFormatted: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date())
    });

    return dispatch(ADMIN_EMAIL, `[ADMIN] ${type}`, html);
  }
}

export const emailService = new EmailService();
