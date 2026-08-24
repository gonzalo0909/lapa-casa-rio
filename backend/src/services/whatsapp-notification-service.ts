// lapa-casa-hostel/backend/src/services/whatsapp-notification-service.ts
// ventana4: renombrado desde notification-service.ts. Nada en el repo
// importaba este archivo (WHATSAPP_ENABLED nunca se prendio), asi que el
// nombre quedaba libre para el servicio de notificaciones por email que
// pide esta ventana (notify/scheduleNotification/getNotificationHistory).

import { logger } from '../utils/logger';

interface BookingNotificationData {
  phone: string;
  bookingId: string;
  checkIn: string;
  language: 'pt' | 'en' | 'es';
}

interface PaymentNotificationData {
  phone: string;
  bookingId: string;
  amount: number;
  dueDate: string;
  language: 'pt' | 'en' | 'es';
}

interface CheckInNotificationData {
  phone: string;
  guestName: string;
  checkInDate: string;
  checkInTime: string;
  language: 'pt' | 'en' | 'es';
}

interface AdminAlertData {
  type: 'NEW_BOOKING' | 'PAYMENT_RECEIVED' | 'CANCELLATION' | 'PAYMENT_FAILED';
  bookingId: string;
  details: string;
}

export class NotificationService {
  private readonly ADMIN_PHONES = ['+5521999999999'];
  private readonly WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';

  private getWhatsAppClient() {
    if (!this.WHATSAPP_ENABLED) return null;
    try {
      const { WhatsAppClient } = require('../integrations/whatsapp/whatsapp-client');
      return new WhatsAppClient();
    } catch {
      logger.warn('WhatsApp client not available');
      return null;
    }
  }

  async sendBookingNotification(data: BookingNotificationData): Promise<any> {
    try {
      if (!this.WHATSAPP_ENABLED) {
        logger.debug('WhatsApp deshabilitado');
        return { success: false, reason: 'WhatsApp disabled' };
      }

      logger.info('Enviando notificación de booking por WhatsApp', { phone: data.phone, bookingId: data.bookingId });

      const message = this.buildBookingMessage(data);
      const client = this.getWhatsAppClient();
      if (!client) return { success: false, reason: 'WhatsApp not configured' };

      const messageId = await client.sendTextMessage(this.formatPhoneNumber(data.phone), message);

      logger.info('Notificación de booking enviada', { phone: data.phone, messageId });
      return { success: true, messageId };
    } catch (error) {
      logger.error('Error enviando notificación de booking', error);
      return { success: false, error };
    }
  }

  async sendPaymentReminder(data: PaymentNotificationData): Promise<any> {
    try {
      if (!this.WHATSAPP_ENABLED) {
        return { success: false, reason: 'WhatsApp disabled' };
      }

      logger.info('Enviando recordatorio de pago por WhatsApp', { phone: data.phone, bookingId: data.bookingId });

      const message = this.buildPaymentReminderMessage(data);
      const client = this.getWhatsAppClient();
      if (!client) return { success: false, reason: 'WhatsApp not configured' };

      const messageId = await client.sendTextMessage(this.formatPhoneNumber(data.phone), message);

      logger.info('Recordatorio de pago enviado', { phone: data.phone, messageId });
      return { success: true, messageId };
    } catch (error) {
      logger.error('Error enviando recordatorio de pago', error);
      return { success: false, error };
    }
  }

  async sendCheckInReminder(data: CheckInNotificationData): Promise<any> {
    try {
      if (!this.WHATSAPP_ENABLED) {
        return { success: false, reason: 'WhatsApp disabled' };
      }

      logger.info('Enviando recordatorio de check-in por WhatsApp', { phone: data.phone });

      const message = this.buildCheckInMessage(data);
      const client = this.getWhatsAppClient();
      if (!client) return { success: false, reason: 'WhatsApp not configured' };

      const messageId = await client.sendTextMessage(this.formatPhoneNumber(data.phone), message);

      logger.info('Recordatorio de check-in enviado', { phone: data.phone, messageId });
      return { success: true, messageId };
    } catch (error) {
      logger.error('Error enviando recordatorio de check-in', error);
      return { success: false, error };
    }
  }

  async sendPaymentConfirmation(
    phone: string,
    bookingId: string,
    amount: number,
    language: 'pt' | 'en' | 'es'
  ): Promise<any> {
    try {
      if (!this.WHATSAPP_ENABLED) {
        return { success: false, reason: 'WhatsApp disabled' };
      }

      logger.info('Enviando confirmación de pago por WhatsApp', { phone, bookingId });

      const amountStr = this.formatCurrency(amount, language);
      const messages = {
        pt: `✅ *Pagamento Confirmado - Lapa Casa*\n\nReserva: ${bookingId}\nValor recebido: ${amountStr}\n\nObrigado! 🙏`,
        en: `✅ *Payment Confirmed - Lapa Casa*\n\nBooking: ${bookingId}\nAmount received: ${amountStr}\n\nThank you! 🙏`,
        es: `✅ *Pago Confirmado - Lapa Casa*\n\nReserva: ${bookingId}\nMonto recibido: ${amountStr}\n\n¡Gracias! 🙏`
      };

      const client = this.getWhatsAppClient();
      if (!client) return { success: false, reason: 'WhatsApp not configured' };

      const messageId = await client.sendTextMessage(this.formatPhoneNumber(phone), messages[language]);

      logger.info('Confirmación de pago enviada', { phone, messageId });
      return { success: true, messageId };
    } catch (error) {
      logger.error('Error enviando confirmación de pago', error);
      return { success: false, error };
    }
  }

  async sendAdminAlert(data: AdminAlertData): Promise<any> {
    try {
      logger.info('Enviando alerta al administrador', { type: data.type, bookingId: data.bookingId });

      const client = this.getWhatsAppClient();
      if (!client) {
        logger.warn('Admin alert not sent — WhatsApp not configured', data);
        return { success: false, reason: 'WhatsApp not configured' };
      }

      const message = this.formatAdminAlert(data);
      const results = [];

      for (const adminPhone of this.ADMIN_PHONES) {
        try {
          const messageId = await client.sendTextMessage(adminPhone, message);
          results.push({ phone: adminPhone, success: true, messageId });
        } catch (error) {
          logger.error('Error enviando alerta a admin', { adminPhone, error });
          results.push({ phone: adminPhone, success: false, error });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error enviando alertas de admin', error);
      return { success: false, error };
    }
  }

  async sendCustomMessage(phone: string, message: string): Promise<any> {
    if (!this.WHATSAPP_ENABLED) {
      throw new Error('WhatsApp está deshabilitado');
    }

    const client = this.getWhatsAppClient();
    if (!client) throw new Error('WhatsApp not configured');

    const messageId = await client.sendTextMessage(this.formatPhoneNumber(phone), message);
    logger.info('Mensaje personalizado enviado', { phone, messageId });
    return { success: true, messageId };
  }

  async sendBulkNotifications(phones: string[], message: string): Promise<any[]> {
    const results = [];

    for (const phone of phones) {
      try {
        const result = await this.sendCustomMessage(phone, message);
        results.push({ phone, success: true, messageId: result.messageId });
      } catch (error) {
        logger.error('Error enviando notificación masiva', { phone, error });
        results.push({ phone, success: false, error });
      }

      await this.delay(1000);
    }

    logger.info('Notificaciones masivas enviadas', {
      total: results.length,
      successful: results.filter(r => r.success).length
    });
    return results;
  }

  private buildBookingMessage(data: BookingNotificationData): string {
    const checkInStr = this.formatDate(data.checkIn);
    const msgs = {
      pt: `🎉 *Reserva Confirmada - Lapa Casa*\n\nReserva: ${data.bookingId}\nCheck-in: ${checkInStr}\n\nObrigado pela sua reserva! 🏠`,
      en: `🎉 *Booking Confirmed - Lapa Casa*\n\nBooking: ${data.bookingId}\nCheck-in: ${checkInStr}\n\nThank you for your booking! 🏠`,
      es: `🎉 *Reserva Confirmada - Lapa Casa*\n\nReserva: ${data.bookingId}\nCheck-in: ${checkInStr}\n\n¡Gracias por tu reserva! 🏠`
    };
    return msgs[data.language];
  }

  private buildPaymentReminderMessage(data: PaymentNotificationData): string {
    const amountStr = this.formatCurrency(data.amount, data.language);
    const dueDateStr = this.formatDate(data.dueDate);
    const msgs = {
      pt: `💳 *Lembrete de Pagamento - Lapa Casa*\n\nReserva: ${data.bookingId}\nValor: ${amountStr}\nVencimento: ${dueDateStr}\n\nEfetue o pagamento para garantir sua reserva.`,
      en: `💳 *Payment Reminder - Lapa Casa*\n\nBooking: ${data.bookingId}\nAmount: ${amountStr}\nDue date: ${dueDateStr}\n\nPlease pay to secure your booking.`,
      es: `💳 *Recordatorio de Pago - Lapa Casa*\n\nReserva: ${data.bookingId}\nMonto: ${amountStr}\nVencimiento: ${dueDateStr}\n\nPor favor paga para asegurar tu reserva.`
    };
    return msgs[data.language];
  }

  private buildCheckInMessage(data: CheckInNotificationData): string {
    const dateStr = this.formatDate(data.checkInDate);
    const msgs = {
      pt: `🏠 *Check-in Amanhã - Lapa Casa*\n\nOlá ${data.guestName}!\n\nCheck-in: ${dateStr} às ${data.checkInTime}\nEndereço: Rua Silvio Romero 22, Santa Teresa\n\nAté amanhã! 👋`,
      en: `🏠 *Check-in Tomorrow - Lapa Casa*\n\nHello ${data.guestName}!\n\nCheck-in: ${dateStr} at ${data.checkInTime}\nAddress: Rua Silvio Romero 22, Santa Teresa\n\nSee you tomorrow! 👋`,
      es: `🏠 *Check-in Mañana - Lapa Casa*\n\nHola ${data.guestName}!\n\nCheck-in: ${dateStr} a las ${data.checkInTime}\nDirección: Rua Silvio Romero 22, Santa Teresa\n\n¡Hasta mañana! 👋`
    };
    return msgs[data.language];
  }

  private formatAdminAlert(data: AdminAlertData): string {
    const emojis = {
      NEW_BOOKING: '🎉',
      PAYMENT_RECEIVED: '💰',
      CANCELLATION: '❌',
      PAYMENT_FAILED: '⚠️'
    };
    const titles = {
      NEW_BOOKING: 'Nueva Reserva',
      PAYMENT_RECEIVED: 'Pago Recibido',
      CANCELLATION: 'Cancelación',
      PAYMENT_FAILED: 'Pago Fallido'
    };
    return `${emojis[data.type]} *${titles[data.type]}*\n\n*Reserva:* ${data.bookingId}\n\n${data.details}`;
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
    return '+' + cleaned;
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }

  private formatCurrency(amount: number, language: 'pt' | 'en' | 'es'): string {
    const locales = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
    return new Intl.NumberFormat(locales[language], { style: 'currency', currency: 'BRL' }).format(amount);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const whatsappNotificationService = new NotificationService();
