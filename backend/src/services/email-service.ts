// lapa-casa-hostel/backend/src/services/email-service.ts

import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';
import { logger } from '../utils/logger';
import { AppError } from '../utils/responses';

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

export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;
  private readonly TEMPLATES_PATH = join(__dirname, '../integrations/email');

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.FROM_EMAIL || 'reservas@lapacasahostel.com';
    this.fromName = 'Lapa Casa Hostel';
    this.registerHandlebarsHelpers();
  }

  async sendBookingConfirmation(data: BookingConfirmationData): Promise<any> {
    try {
      logger.info('Enviando email de confirmación', { to: data.to, bookingId: data.bookingId });

      const template = this.loadTemplate('booking-confirmation.html');
      const compiled = Handlebars.compile(template);

      const html = compiled({
        guestName: data.guestName,
        bookingId: data.bookingId,
        checkIn: this.formatDate(data.checkIn, data.language),
        checkOut: this.formatDate(data.checkOut, data.language),
        rooms: this.formatRooms(data.rooms, data.language),
        totalPrice: this.formatCurrency(data.totalPrice, data.language),
        depositAmount: this.formatCurrency(data.depositAmount, data.language),
        paymentUrl: data.paymentUrl,
        year: new Date().getFullYear()
      });

      const result = await this.resend.emails.send({
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
      throw new AppError('Error al enviar email de confirmación', 500);
    }
  }

  async sendPaymentReminder(data: PaymentReminderData): Promise<any> {
    try {
      logger.info('Enviando recordatorio de pago', { to: data.to, bookingId: data.bookingId });

      const template = this.loadTemplate('payment-reminder.html');
      const compiled = Handlebars.compile(template);

      const html = compiled({
        guestName: data.guestName,
        bookingId: data.bookingId,
        daysUntilCheckIn: data.daysUntilCheckIn,
        remainingAmount: this.formatCurrency(data.remainingAmount, data.language),
        paymentUrl: data.paymentUrl,
        year: new Date().getFullYear()
      });

      const result = await this.resend.emails.send({
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

  async sendCancellationEmail(data: CancellationData): Promise<any> {
    try {
      logger.info('Enviando email de cancelación', { to: data.to, bookingId: data.bookingId });

      const template = this.loadTemplate('booking-confirmation.html');
      const compiled = Handlebars.compile(template);

      const html = compiled({
        guestName: data.guestName,
        bookingId: data.bookingId,
        refundAmount: this.formatCurrency(data.refundAmount, data.language),
        hasRefund: data.refundAmount > 0,
        year: new Date().getFullYear()
      });

      const result = await this.resend.emails.send({
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

  async sendCheckInReminder(data: CheckInReminderData): Promise<any> {
    try {
      logger.info('Enviando recordatorio de check-in', { to: data.to, bookingId: data.bookingId });

      const template = this.loadTemplate('booking-confirmation.html');
      const compiled = Handlebars.compile(template);

      const html = compiled({
        guestName: data.guestName,
        bookingId: data.bookingId,
        checkInDate: this.formatDate(data.checkInDate, data.language),
        checkInTime: data.checkInTime,
        address: data.address,
        directions: data.directions,
        year: new Date().getFullYear()
      });

      const result = await this.resend.emails.send({
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

  async sendWelcomeEmail(to: string, guestName: string, language: 'pt' | 'en' | 'es'): Promise<any> {
    try {
      logger.info('Enviando email de bienvenida', { to });

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>${this.getTranslation('welcome', language)}</h1>
          <p>${this.getTranslation('greeting', language)} ${guestName},</p>
          <p>${this.getTranslation('welcomeMessage', language)}</p>
          <h2>WiFi</h2>
          <p><strong>Red:</strong> LAPA_CASA_GUESTS<br><strong>${this.getTranslation('password', language)}:</strong> santateresa2024</p>
          <p><strong>Check-out:</strong> 11:00h</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            Lapa Casa Hostel<br>
            Rua Silvio Romero 22, Santa Teresa<br>
            Rio de Janeiro, RJ - Brasil<br>
            contato@lapacasahostel.com
          </p>
        </div>
      `;

      const result = await this.resend.emails.send({
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

  async sendCustomEmail(to: string, subject: string, html: string, tags?: Array<{ name: string; value: string }>): Promise<any> {
    try {
      const result = await this.resend.emails.send({
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

  private loadTemplate(templateName: string): string {
    try {
      const templatePath = join(this.TEMPLATES_PATH, templateName);
      return readFileSync(templatePath, 'utf-8');
    } catch (error) {
      logger.error('Error cargando template', { templateName, error });
      return this.getDefaultTemplate();
    }
  }

  private registerHandlebarsHelpers(): void {
    Handlebars.registerHelper('formatCurrency', (amount: number, language: string) => {
      return this.formatCurrency(amount, language as 'pt' | 'en' | 'es');
    });

    Handlebars.registerHelper('formatDate', (date: string, language: string) => {
      return this.formatDate(date, language as 'pt' | 'en' | 'es');
    });
  }

  private formatCurrency(amount: number, language: 'pt' | 'en' | 'es'): string {
    const formatters = {
      pt: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
      en: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL' }),
      es: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'BRL' })
    };
    return formatters[language].format(amount);
  }

  private formatDate(dateStr: string, language: 'pt' | 'en' | 'es'): string {
    const date = new Date(dateStr);
    const formatters = {
      pt: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      en: new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'long', year: 'numeric' }),
      es: new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    };
    return formatters[language].format(date);
  }

  private formatRooms(rooms: Array<{ roomId: string; bedsCount: number }>, language: 'pt' | 'en' | 'es'): string {
    const roomNames = {
      room_mixto_12a: 'Mixto 12A',
      room_mixto_12b: 'Mixto 12B',
      room_mixto_7: 'Mixto 7',
      room_flexible_7: 'Flexible 7'
    };

    const bedLabel = { pt: 'camas', en: 'beds', es: 'camas' };
    return rooms.map(room => `${roomNames[room.roomId]}: ${room.bedsCount} ${bedLabel[language]}`).join(', ');
  }

  private getSubject(type: string, language: 'pt' | 'en' | 'es'): string {
    const subjects = {
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
    return subjects[type][language];
  }

  private getTranslation(key: string, language: 'pt' | 'en' | 'es'): string {
    const translations = {
      welcome: { pt: 'Bem-vindo!', en: 'Welcome!', es: '¡Bienvenido!' },
      greeting: { pt: 'Olá', en: 'Hello', es: 'Hola' },
      welcomeMessage: {
        pt: 'Esperamos que aproveite sua estadia conosco',
        en: 'We hope you enjoy your stay with us',
        es: 'Esperamos que disfrutes tu estadía con nosotros'
      },
      password: { pt: 'Senha', en: 'Password', es: 'Contraseña' }
    };
    return translations[key]?.[language] || '';
  }

  private getDefaultTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          {{{content}}}
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            Lapa Casa Hostel<br>
            Rua Silvio Romero 22, Santa Teresa<br>
            Rio de Janeiro, RJ - Brasil<br>
            contato@lapacasahostel.com
          </p>
        </div>
      </body>
      </html>
    `;
  }
}
