// lapa-casa-hostel/backend/src/services/email-service.ts

import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

interface BookingConfirmationData {
  to: string;
  bookingId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  rooms: Array<{ roomId: string; bedsCount: number }>;
  totalPrice: number;
  depositAmount: number;
  paymentUrl: string;
  language: 'pt' | 'en' | 'es';
}

interface PaymentReminderData {
  to: string;
  bookingId: string;
  guestName: string;
  remainingAmount: number;
  daysUntilCheckIn: number;
  paymentUrl: string;
  language: 'pt' | 'en' | 'es';
}

interface CancellationData {
  to: string;
  bookingId: string;
  guestName: string;
  refundAmount: number;
  language: 'pt' | 'en' | 'es';
}

interface CheckInReminderData {
  to: string;
  bookingId: string;
  guestName: string;
  checkInDate: string;
  checkInTime: string;
  address: string;
  directions: string;
  language: 'pt' | 'en' | 'es';
}

interface SendResult {
  id: string;
  [key: string]: any;
}

// Stub sender — replace with real Resend/SMTP client when available
async function sendEmail(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
  tags?: Array<{ name: string; value: string }>;
}): Promise<SendResult> {
  logger.info('EMAIL (stub) — would send', {
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    tags: opts.tags
  });
  return { id: `stub-${Date.now()}` };
}

export class EmailService {
  private fromEmail: string;
  private fromName: string;
  private readonly TEMPLATES_PATH = join(__dirname, '../integrations/email');

  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'reservas@lapacasahostel.com';
    this.fromName = 'Lapa Casa Hostel';
  }

  async sendBookingConfirmation(data: BookingConfirmationData): Promise<SendResult> {
    try {
      logger.info('Enviando email de confirmación', { to: data.to, bookingId: data.bookingId });

      const html = this.buildBookingConfirmationHtml(data);

      const result = await sendEmail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: data.to,
        subject: this.getSubject('bookingConfirmation', data.language),
        html,
        tags: [
          { name: 'type', value: 'booking_confirmation' },
          { name: 'booking_id', value: data.bookingId }
        ]
      });

      logger.info('Email de confirmación enviado', { emailId: result.id, bookingId: data.bookingId });
      return result;
    } catch (error) {
      logger.error('Error enviando email de confirmación', error);
      throw new Error('Error al enviar email de confirmación');
    }
  }

  async sendPaymentReminder(data: PaymentReminderData): Promise<SendResult> {
    try {
      logger.info('Enviando recordatorio de pago', { to: data.to, bookingId: data.bookingId });

      const html = this.buildPaymentReminderHtml(data);

      const result = await sendEmail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: data.to,
        subject: this.getSubject('paymentReminder', data.language),
        html,
        tags: [
          { name: 'type', value: 'payment_reminder' },
          { name: 'booking_id', value: data.bookingId }
        ]
      });

      logger.info('Recordatorio de pago enviado', { emailId: result.id, bookingId: data.bookingId });
      return result;
    } catch (error) {
      logger.error('Error enviando recordatorio de pago', error);
      throw error;
    }
  }

  async sendCancellationEmail(data: CancellationData): Promise<SendResult> {
    try {
      logger.info('Enviando email de cancelación', { to: data.to, bookingId: data.bookingId });

      const html = this.buildCancellationHtml(data);

      const result = await sendEmail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: data.to,
        subject: this.getSubject('cancellation', data.language),
        html,
        tags: [
          { name: 'type', value: 'cancellation' },
          { name: 'booking_id', value: data.bookingId }
        ]
      });

      logger.info('Email de cancelación enviado', { emailId: result.id, bookingId: data.bookingId });
      return result;
    } catch (error) {
      logger.error('Error enviando email de cancelación', error);
      throw error;
    }
  }

  async sendCheckInReminder(data: CheckInReminderData): Promise<SendResult> {
    try {
      logger.info('Enviando recordatorio de check-in', { to: data.to, bookingId: data.bookingId });

      const html = this.buildCheckInReminderHtml(data);

      const result = await sendEmail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: data.to,
        subject: this.getSubject('checkInReminder', data.language),
        html,
        tags: [
          { name: 'type', value: 'checkin_reminder' },
          { name: 'booking_id', value: data.bookingId }
        ]
      });

      logger.info('Recordatorio de check-in enviado', { emailId: result.id, bookingId: data.bookingId });
      return result;
    } catch (error) {
      logger.error('Error enviando recordatorio de check-in', error);
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, guestName: string, language: 'pt' | 'en' | 'es'): Promise<SendResult> {
    try {
      logger.info('Enviando email de bienvenida', { to });

      const greeting = { pt: 'Olá', en: 'Hello', es: 'Hola' }[language];
      const welcome = { pt: 'Bem-vindo!', en: 'Welcome!', es: '¡Bienvenido!' }[language];
      const msg = {
        pt: 'Esperamos que aproveite sua estadia conosco',
        en: 'We hope you enjoy your stay with us',
        es: 'Esperamos que disfrutes tu estadía con nosotros'
      }[language];
      const pwd = { pt: 'Senha', en: 'Password', es: 'Contraseña' }[language];

      const html = this.wrap(`
        <h1>${welcome}</h1>
        <p>${greeting} ${guestName},</p>
        <p>${msg}</p>
        <h2>WiFi</h2>
        <p><strong>Red:</strong> LAPA_CASA_GUESTS<br><strong>${pwd}:</strong> santateresa2024</p>
        <p><strong>Check-out:</strong> 11:00h</p>
      `);

      const result = await sendEmail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to,
        subject: this.getSubject('welcome', language),
        html,
        tags: [{ name: 'type', value: 'welcome' }]
      });

      logger.info('Email de bienvenida enviado', { emailId: result.id });
      return result;
    } catch (error) {
      logger.error('Error enviando email de bienvenida', error);
      throw error;
    }
  }

  async sendCustomEmail(
    to: string,
    subject: string,
    html: string,
    tags?: Array<{ name: string; value: string }>
  ): Promise<SendResult> {
    try {
      const result = await sendEmail({
        from: `${this.fromName} <${this.fromEmail}>`,
        to,
        subject,
        html,
        tags
      });
      logger.info('Email personalizado enviado', { emailId: result.id, to });
      return result;
    } catch (error) {
      logger.error('Error enviando email personalizado', error);
      throw error;
    }
  }

  private buildBookingConfirmationHtml(data: BookingConfirmationData): string {
    const bedLabel = { pt: 'camas', en: 'beds', es: 'camas' }[data.language];
    const roomsText = data.rooms.map(r => `${r.roomId}: ${r.bedsCount} ${bedLabel}`).join(', ');

    return this.wrap(`
      <h2>${this.getSubject('bookingConfirmation', data.language)}</h2>
      <p>Olá ${data.guestName},</p>
      <p><strong>Reserva:</strong> ${data.bookingId}</p>
      <p><strong>Check-in:</strong> ${this.formatDate(data.checkIn, data.language)}</p>
      <p><strong>Check-out:</strong> ${this.formatDate(data.checkOut, data.language)}</p>
      <p><strong>Acomodações:</strong> ${roomsText}</p>
      <p><strong>Total:</strong> ${this.formatCurrency(data.totalPrice, data.language)}</p>
      <p><strong>Depósito:</strong> ${this.formatCurrency(data.depositAmount, data.language)}</p>
      <p><a href="${data.paymentUrl}" style="background:#222;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Pagar agora</a></p>
    `);
  }

  private buildPaymentReminderHtml(data: PaymentReminderData): string {
    return this.wrap(`
      <h2>${this.getSubject('paymentReminder', data.language)}</h2>
      <p>Olá ${data.guestName},</p>
      <p><strong>Reserva:</strong> ${data.bookingId}</p>
      <p><strong>Valor restante:</strong> ${this.formatCurrency(data.remainingAmount, data.language)}</p>
      <p><strong>Check-in em:</strong> ${data.daysUntilCheckIn} dias</p>
      <p><a href="${data.paymentUrl}" style="background:#222;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Pagar agora</a></p>
    `);
  }

  private buildCancellationHtml(data: CancellationData): string {
    const refundLine = data.refundAmount > 0
      ? `<p><strong>Reembolso:</strong> ${this.formatCurrency(data.refundAmount, data.language)}</p>`
      : '';
    return this.wrap(`
      <h2>${this.getSubject('cancellation', data.language)}</h2>
      <p>Olá ${data.guestName},</p>
      <p>Sua reserva <strong>${data.bookingId}</strong> foi cancelada.</p>
      ${refundLine}
    `);
  }

  private buildCheckInReminderHtml(data: CheckInReminderData): string {
    return this.wrap(`
      <h2>${this.getSubject('checkInReminder', data.language)}</h2>
      <p>Olá ${data.guestName},</p>
      <p><strong>Reserva:</strong> ${data.bookingId}</p>
      <p><strong>Check-in:</strong> ${this.formatDate(data.checkInDate, data.language)} às ${data.checkInTime}</p>
      <p><strong>Endereço:</strong> ${data.address}</p>
      <p>${data.directions}</p>
    `);
  }

  private wrap(content: string): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
${content}
<hr style="margin:30px 0;border:none;border-top:1px solid #eee;">
<p style="font-size:12px;color:#666;">
  Lapa Casa Hostel<br>Rua Silvio Romero 22, Santa Teresa<br>
  Rio de Janeiro, RJ - Brasil<br>contato@lapacasahostel.com
</p>
</div></body></html>`;
  }

  private formatCurrency(amount: number, language: 'pt' | 'en' | 'es'): string {
    const locales = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
    return new Intl.NumberFormat(locales[language], { style: 'currency', currency: 'BRL' }).format(amount);
  }

  private formatDate(dateStr: string, language: 'pt' | 'en' | 'es'): string {
    const locales = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
    return new Intl.DateTimeFormat(locales[language], { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateStr));
  }

  private getSubject(type: string, language: 'pt' | 'en' | 'es'): string {
    const subjects: Record<string, Record<string, string>> = {
      bookingConfirmation: {
        pt: 'Confirmação de Reserva - Lapa Casa Hostel',
        en: 'Booking Confirmation - Lapa Casa Hostel',
        es: 'Confirmación de Reserva - Lapa Casa Hostel'
      },
      paymentReminder: {
        pt: 'Lembrete de Pagamento - Lapa Casa Hostel',
        en: 'Payment Reminder - Lapa Casa Hostel',
        es: 'Recordatorio de Pago - Lapa Casa Hostel'
      },
      cancellation: {
        pt: 'Cancelamento de Reserva - Lapa Casa Hostel',
        en: 'Booking Cancellation - Lapa Casa Hostel',
        es: 'Cancelación de Reserva - Lapa Casa Hostel'
      },
      checkInReminder: {
        pt: 'Check-in Amanhã - Lapa Casa Hostel',
        en: 'Check-in Tomorrow - Lapa Casa Hostel',
        es: 'Check-in Mañana - Lapa Casa Hostel'
      },
      welcome: {
        pt: 'Bem-vindo ao Lapa Casa Hostel!',
        en: 'Welcome to Lapa Casa Hostel!',
        es: '¡Bienvenido a Lapa Casa Hostel!'
      }
    };
    return subjects[type]?.[language] ?? '';
  }
}

export const emailService = new EmailService();
