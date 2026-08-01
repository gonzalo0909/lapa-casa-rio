import { logger } from '../../utils/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
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
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'reservas@lapacasahostel.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'Lapa Casa Hostel';
  }

  async sendEmail(options: EmailOptions): Promise<string> {
    logger.info('Email stub — not sent', { to: options.to, subject: options.subject });
    return `stub-${Date.now()}`;
  }

  async sendBookingConfirmation(data: BookingEmailData, htmlContent: string): Promise<string> {
    return this.sendEmail({ to: data.guestEmail, subject: `Confirmação de Reserva #${data.bookingId}`, html: htmlContent });
  }

  async sendDepositConfirmation(data: BookingEmailData, htmlContent: string): Promise<string> {
    return this.sendEmail({ to: data.guestEmail, subject: `Depósito Confirmado - Reserva #${data.bookingId}`, html: htmlContent });
  }

  async sendPaymentReminder(data: PaymentEmailData, htmlContent: string): Promise<string> {
    return this.sendEmail({ to: data.guestEmail, subject: `Lembrete de Pagamento - Reserva #${data.bookingId}`, html: htmlContent });
  }

  async sendCancellationConfirmation(guestEmail: string, guestName: string, bookingId: string, refundAmount: number | null, htmlContent: string): Promise<string> {
    return this.sendEmail({ to: guestEmail, subject: `Cancelamento Confirmado - Reserva #${bookingId}`, html: htmlContent });
  }

  async sendCheckInInstructions(guestEmail: string, guestName: string, checkInDate: string, htmlContent: string): Promise<string> {
    return this.sendEmail({ to: guestEmail, subject: 'Instruções de Check-in - Lapa Casa Hostel', html: htmlContent });
  }

  async sendWelcomeEmail(guestEmail: string, guestName: string, htmlContent: string): Promise<string> {
    return this.sendEmail({ to: guestEmail, subject: 'Bem-vindo ao Lapa Casa Hostel!', html: htmlContent });
  }

  async sendFeedbackRequest(guestEmail: string, guestName: string, bookingId: string, htmlContent: string): Promise<string> {
    return this.sendEmail({ to: guestEmail, subject: 'Como foi sua experiência? - Lapa Casa Hostel', html: htmlContent });
  }

  async sendPasswordReset(email: string, resetToken: string, htmlContent: string): Promise<string> {
    return this.sendEmail({ to: email, subject: 'Redefinir Senha - Lapa Casa Hostel', html: htmlContent });
  }

  async sendAdminNotification(subject: string, message: string, htmlContent?: string): Promise<string> {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@lapacasahostel.com';
    return this.sendEmail({ to: adminEmail, subject: `[ADMIN] ${subject}`, html: htmlContent || `<p>${message}</p>` });
  }

  async sendBulkEmails(
    recipients: Array<{ email: string; data: any }>,
    templateFn: (data: any) => { subject: string; html: string; text?: string }
  ): Promise<Array<{ email: string; messageId?: string; error?: any }>> {
    return recipients.map(r => {
      logger.info('Bulk email stub', { email: r.email });
      return { email: r.email, messageId: `stub-${Date.now()}` };
    });
  }

  async sendWithAttachment(to: string, subject: string, htmlContent: string, attachments: any[]): Promise<string> {
    return this.sendEmail({ to, subject, html: htmlContent });
  }

  async sendInvoice(guestEmail: string, guestName: string, bookingId: string, invoicePdf: Buffer): Promise<string> {
    return this.sendEmail({ to: guestEmail, subject: `Fatura - Reserva #${bookingId}`, html: `<p>Fatura ${bookingId}</p>` });
  }

  async verifyEmailAddress(email: string): Promise<boolean> {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async healthCheck(): Promise<boolean> { return true; }
}

export const emailClient = new EmailClient();
