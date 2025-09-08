import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: config.email.sendgridApiKey,
      },
    });
  }

  async sendBookingConfirmation(data: {
    guestEmail: string;
    guestName: string;
    bookingId: string;
    checkIn: string;
    checkOut: string;
    beds: Array<{ room: number; bed: number }>;
    total: number;
  }): Promise<void> {
    const template = this.generateBookingConfirmationTemplate(data);
    await this.sendEmail(template);
  }

  async sendPaymentConfirmation(data: {
    guestEmail: string;
    guestName: string;
    bookingId: string;
    amount: number;
    method: string;
  }): Promise<void> {
    const template = this.generatePaymentConfirmationTemplate(data);
    await this.sendEmail(template);
  }

  async sendCheckInInstructions(data: {
    guestEmail: string;
    guestName: string;
    bookingId: string;
    checkInDate: string;
    accessCode?: string;
  }): Promise<void> {
    const template = this.generateCheckInTemplate(data);
    await this.sendEmail(template);
  }

  private async sendEmail(template: EmailTemplate): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: config.email.fromAddress,
        to: template.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      logger.info('Email sent successfully', { to: template.to, subject: template.subject });

    } catch (error) {
      logger.error('Email sending failed:', error);
      throw error;
    }
  }

  private generateBookingConfirmationTemplate(data: any): EmailTemplate {
    const bedsList = data.beds
      .map((bed: any) => `Habitación ${bed.room}, Cama ${bed.bed}`)
      .join('<br>');

    return {
      to: data.guestEmail,
      subject: `Confirmación de Reserva - ${data.bookingId}`,
      html: `
        <h1>¡Reserva Confirmada!</h1>
        <p>Hola ${data.guestName},</p>
        <p>Tu reserva en Lapa Casa Hostel ha sido confirmada.</p>
        
        <h2>Detalles de la Reserva:</h2>
        <ul>
          <li><strong>ID de Reserva:</strong> ${data.bookingId}</li>
          <li><strong>Check-in:</strong> ${data.checkIn}</li>
          <li><strong>Check-out:</strong> ${data.checkOut}</li>
          <li><strong>Camas asignadas:</strong><br>${bedsList}</li>
          <li><strong>Total pagado:</strong> R$ ${data.total}</li>
        </ul>
        
        <h2>Dirección:</h2>
        <p>Santa Teresa, Rio de Janeiro<br>
        [Dirección exacta del hostel]</p>
        
        <p>¡Esperamos verte pronto!</p>
        <p>Equipo Lapa Casa Hostel</p>
      `,
    };
  }

  private generatePaymentConfirmationTemplate(data: any): EmailTemplate {
    return {
      to: data.guestEmail,
      subject: `Pago Confirmado - ${data.bookingId}`,
      html: `
        <h1>Pago Procesado Exitosamente</h1>
        <p>Hola ${data.guestName},</p>
        <p>Hemos recibido tu pago por la reserva ${data.bookingId}.</p>
        
        <h2>Detalles del Pago:</h2>
        <ul>
          <li><strong>Monto:</strong> R$ ${data.amount}</li>
          <li><strong>Método:</strong> ${data.method}</li>
          <li><strong>Estado:</strong> Confirmado</li>
        </ul>
        
        <p>Tu reserva está completamente confirmada.</p>
        <p>Recibirás las instrucciones de check-in 24 horas antes de tu llegada.</p>
        
        <p>¡Gracias por elegir Lapa Casa Hostel!</p>
      `,
    };
  }

  private generateCheckInTemplate(data: any): EmailTemplate {
    return {
      to: data.guestEmail,
      subject: `Instrucciones de Check-in - ${data.bookingId}`,
      html: `
        <h1>Instrucciones de Check-in</h1>
        <p>Hola ${data.guestName},</p>
        <p>Tu check-in es mañana (${data.checkInDate}). Aquí tienes toda la información:</p>
        
        <h2>Horario de Check-in:</h2>
        <p>15:00 - 22:00</p>
        
        <h2>Dirección:</h2>
        <p>Santa Teresa, Rio de Janeiro<br>
        [Dirección exacta]</p>
        
        ${data.accessCode ? `
          <h2>Código de Acceso:</h2>
          <p><strong>${data.accessCode}</strong></p>
        ` : ''}
        
        <h2>Contacto de Emergencia:</h2>
        <p>WhatsApp: +55 11 99999-9999</p>
        
        <h2>WiFi:</h2>
        <p>Red: LapaCasa_Guest<br>
        Contraseña: hostel2025</p>
        
        <p>¡Te esperamos!</p>
        <p>Equipo Lapa Casa Hostel</p>
      `,
    };
  }
}
