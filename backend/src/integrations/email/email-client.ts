// lapa-casa-hostel/backend/src/integrations/email/email-client.ts

import { Resend } from 'resend';
import { logger } from '../../utils/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface BookingEmailData {
  guestName: string;
  guestEmail: string;
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  roomName: string;
  bedsCount: number;
  totalPrice: number;
  depositAmount?: number;
  remainingAmount?: number;
}

interface PaymentEmailData {
  guestName: string;
  guestEmail: string;
  bookingId: string;
  amount: number;
  dueDate: string;
  paymentLink?: string;
}

export class EmailClient {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = process.env.EMAIL_FROM || 'reservas@lapacasahostel.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Lapa Casa Hostel';
  }

  async sendEmail(options: EmailOptions): Promise<string> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        cc: options.cc,
        bcc: options.bcc,
        reply_to: options.replyTo,
        attachments: options.attachments
      });

      if (error) {
        throw new Error(error.message);
      }

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: data?.id
      });

      return data?.id || '';
    } catch (error) {
      logger.error('Failed to send email', {
        error,
        to: options.to,
        subject: options.subject
      });
      throw new Error('Email send failed');
    }
  }

  async sendBookingConfirmation(data: BookingEmailData, htmlContent: string): Promise<string> {
    const subject = `Confirmação de Reserva #${data.bookingId} - Lapa Casa Hostel`;
    
    const textContent = this.generateBookingConfirmationText(data);

    return await this.sendEmail({
      to: data.guestEmail,
      subject,
      html: htmlContent,
      text: textContent
    });
  }

  async sendDepositConfirmation(data: BookingEmailData, htmlContent: string): Promise<string> {
    const subject = `Depósito Confirmado - Reserva #${data.bookingId}`;
    
    const textContent = `Olá ${data.guestName},\n\nRecebemos o pagamento do seu depósito!\n\nReserva: ${data.bookingId}\nDepósito: R$ ${data.depositAmount?.toFixed(2)}\nRestante: R$ ${data.remainingAmount?.toFixed(2)}\n\nObrigado!\nLapa Casa Hostel`;

    return await this.sendEmail({
      to: data.guestEmail,
      subject,
      html: htmlContent,
      text: textContent
    });
  }

  async sendPaymentReminder(data: PaymentEmailData, htmlContent: string): Promise<string> {
    const subject = `Lembrete de Pagamento - Reserva #${data.bookingId}`;
    
    const textContent = `Olá ${data.guestName},\n\nLembrete sobre o pagamento pendente:\n\nReserva: ${data.bookingId}\nValor: R$ ${data.amount.toFixed(2)}\nVencimento: ${data.dueDate}\n\n${data.paymentLink ? `Link: ${data.paymentLink}\n\n` : ''}Lapa Casa Hostel`;

    return await this.sendEmail({
      to: data.guestEmail,
      subject,
      html: htmlContent,
      text: textContent
    });
  }

  async sendCancellationConfirmation(
    guestEmail: string,
    guestName: string,
    bookingId: string,
    refundAmount: number | null,
    htmlContent: string
  ): Promise<string> {
    const subject = `Cancelamento Confirmado - Reserva #${bookingId}`;
    
    const refundText = refundAmount !== null
      ? `Reembolso: R$ ${refundAmount.toFixed(2)}\nPrazo: 5-10 dias úteis`
      : 'Sem reembolso conforme política de cancelamento';

    const textContent = `Olá ${guestName},\n\nSua reserva foi cancelada.\n\nReserva: ${bookingId}\n${refundText}\n\nLapa Casa Hostel`;

    return await this.sendEmail({
      to: guestEmail,
      subject,
      html: htmlContent,
      text: textContent
    });
  }

  async sendCheckInInstructions(
    guestEmail: string,
    guestName: string,
    checkInDate: string,
    htmlContent: string
  ): Promise<string> {
    const subject = 'Instruções de Check-in - Lapa Casa Hostel';
    
    const textContent = `Olá ${guestName},\n\nInstruções para seu check-in em ${checkInDate}:\n\nEndereço: Rua Silvio Romero 22, Santa Teresa, Rio de Janeiro\nHorário: 14:00\n\nTraga documento com foto.\n\nLapa Casa Hostel`;

    return await this.sendEmail({
      to: guestEmail,
      subject,
      html: htmlContent,
      text: textContent
    });
  }

  async sendWelcomeEmail(
    guestEmail: string,
    guestName: string,
    htmlContent: string
  ): Promise<string> {
    const subject = 'Bem-vindo ao Lapa Casa Hostel!';
    
    const textContent = `Olá ${guestName},\n\nBem-vindo! Estamos ansiosos para recebê-lo.\n\nLapa Casa Hostel`;

    return await this.sendEmail({
      to: guestEmail,
      subject,
      html: htmlContent,
      text: textContent
    });
  }

  async sendFeedbackRequest(
    guestEmail: string,
    guestName: string,
    bookingId: string,
    htmlContent: string
  ): Promise<string> {
    const subject = 'Como foi sua experiência? - Lapa Casa Hostel';
    
    const textContent = `Olá ${guestName},\n\nComo foi sua estadia? Gostaríamos de ouvir seu feedback!\n\nReserva: ${bookingId}\n\nObrigado!\nLapa Casa Hostel`;

    return await this.sendEmail({
      to: guestEmail,
      subject,
      html: htmlContent,
      text: textContent
    });
  }

  async sendPasswordReset(
    email: string,
    resetToken: string,
    htmlContent: string
  ): Promise<string> {
    const subject = 'Redefinir Senha - Lapa Casa Hostel';
    
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const textContent = `Redefinir senha:\n\n${resetLink}\n\nO link expira em 1 hora.\n\nLapa Casa Hostel`;

    return await this.sendEmail({
      to: email,
      subject,
      html: htmlContent,
      text: textContent
    });
  }

  async sendAdminNotification(
    subject: string,
    message: string,
    htmlContent?: string
  ): Promise<string> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@lapacasahostel.com';

    return await this.sendEmail({
      to: adminEmail,
      subject: `[ADMIN] ${subject}`,
      html: htmlContent || `<p>${message}</p>`,
      text: message
    });
  }

  async sendBulkEmails(
    recipients: Array<{ email: string; data: any }>,
    templateFn: (data: any) => { subject: string; html: string; text?: string }
  ): Promise<Array<{ email: string; messageId?: string; error?: any }>> {
    const results = [];

    for (const recipient of recipients) {
      try {
        const { subject, html, text } = templateFn(recipient.data);
        
        const messageId = await this.sendEmail({
          to: recipient.email,
          subject,
          html,
          text
        });

        results.push({ email: recipient.email, messageId });
        
        await this.delay(100);
      } catch (error) {
        results.push({ email: recipient.email, error });
      }
    }

    logger.info('Bulk email send completed', {
      total: recipients.length,
      success: results.filter(r => r.messageId).length,
      failed: results.filter(r => r.error).length
    });

    return results;
  }

  async sendWithAttachment(
    to: string,
    subject: string,
    htmlContent: string,
    attachments: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>
  ): Promise<string> {
    return await this.sendEmail({
      to,
      subject,
      html: htmlContent,
      attachments
    });
  }

  async sendInvoice(
    guestEmail: string,
    guestName: string,
    bookingId: string,
    invoicePdf: Buffer
  ): Promise<string> {
    const subject = `Fatura - Reserva #${bookingId}`;
    
    const htmlContent = `
      <p>Olá ${guestName},</p>
      <p>Segue em anexo a fatura da sua reserva #${bookingId}.</p>
      <p>Obrigado!<br/>Lapa Casa Hostel</p>
    `;

    return await this.sendWithAttachment(
      guestEmail,
      subject,
      htmlContent,
      [{
        filename: `fatura-${bookingId}.pdf`,
        content: invoicePdf,
        contentType: 'application/pdf'
      }]
    );
  }

  async verifyEmailAddress(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private generateBookingConfirmationText(data: BookingEmailData): string {
    return `Olá ${data.guestName},

Sua reserva foi confirmada!

Detalhes:
- ID: ${data.bookingId}
- Check-in: ${data.checkInDate}
- Check-out: ${data.checkOutDate}
- Quarto: ${data.roomName}
- Camas: ${data.bedsCount}
- Total: R$ ${data.totalPrice.toFixed(2)}

Endereço:
Rua Silvio Romero 22, Santa Teresa
Rio de Janeiro, RJ

Check-in: 14:00
Check-out: 11:00

Obrigado!
Lapa Casa Hostel`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      logger.error('Email client health check failed', { error });
      return false;
    }
  }
}

export const emailClient = new EmailClient();
