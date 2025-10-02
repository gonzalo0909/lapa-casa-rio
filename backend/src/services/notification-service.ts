// lapa-casa-hostel/backend/src/services/notification-service.ts

import { WhatsAppClient } from '../integrations/whatsapp/whatsapp-client';
import { MessageTemplates } from '../integrations/whatsapp/message-templates';
import { logger } from '../utils/logger';
import { AppError } from '../utils/responses';

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
  private whatsappClient: WhatsAppClient;
  private messageTemplates: MessageTemplates;
  private readonly ADMIN_PHONES = ['+5521999999999'];
  private readonly WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';

  constructor() {
    this.whatsappClient = new WhatsAppClient();
    this.messageTemplates = new MessageTemplates();
  }

  async sendBookingNotification(data: BookingNotificationData): Promise<any> {
    try {
      if (!this.WHATSAPP_ENABLED) {
        logger.debug('WhatsApp deshabilitado');
        return { success: false, reason: 'WhatsApp disabled' };
      }

      logger.info('Enviando notificación de booking por WhatsApp', { phone: data.phone, bookingId: data.bookingId });

      const message = this.messageTemplates.getBookingConfirmation({
        bookingId: data.bookingId,
        checkIn: this.formatDate(data.checkIn, data.language),
        language: data.language
      });

      const result = await this.whatsappClient.sendMessage(this.formatPhoneNumber(data.phone), message);

      logger.info('Notificación de booking enviada', { phone: data.phone, messageId: result.messageId });
      return result;
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

      const message = this.messageTemplates.getPaymentReminder({
        bookingId: data.bookingId,
        amount: this.formatCurrency(data.amount, data.language),
        dueDate: this.formatDate(data.dueDate, data.language),
        language: data.language
      });

      const result = await this.whatsappClient.sendMessage(this.formatPhoneNumber(data.phone), message);

      logger.info('Recordatorio de pago enviado', { phone: data.phone, messageId: result.messageId });
      return result;
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

      logger.info('Enviando recordatorio de check-in por WhatsApp', { phone: data.phone, guestName: data.guestName });

      const message = this.messageTemplates.getCheckInReminder({
        guestName: data.guestName,
        checkInDate: this.formatDate(data.checkInDate, data.language),
        checkInTime: data.checkInTime,
        language: data.language
      });

      const result = await this.whatsappClient.sendMessage(this.formatPhoneNumber(data.phone), message);

      logger.info('Recordatorio de check-in enviado', { phone: data.phone, messageId: result.messageId });
      return result;
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

      const message = this.messageTemplates.getPaymentConfirmation({
        bookingId,
        amount: this.formatCurrency(amount, language),
        language
      });

      const result = await this.whatsappClient.sendMessage(this.formatPhoneNumber(phone), message);

      logger.info('Confirmación de pago enviada', { phone, messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Error enviando confirmación de pago', error);
      return { success: false, error };
    }
  }

  async sendAdminAlert(data: AdminAlertData): Promise<any> {
    try {
      logger.info('Enviando alerta al administrador', { type: data.type, bookingId: data.bookingId });

      const message = this.formatAdminAlert(data);
      const results = [];

      for (const adminPhone of this.ADMIN_PHONES) {
        try {
          const result = await this.whatsappClient.sendMessage(adminPhone, message);
          results.push({ phone: adminPhone, success: true, messageId: result.messageId });
        } catch (error) {
          logger.error('Error enviando alerta a admin', { adminPhone, error });
          results.push({ phone: adminPhone, success: false, error });
        }
      }

      logger.info('Alertas de admin enviadas', { total: results.length, successful: results.filter(r => r.success).length });
      return results;
    } catch (error) {
      logger.error('Error enviando alertas de admin', error);
      return { success: false, error };
    }
  }

  async sendCustomMessage(phone: string, message: string): Promise<any> {
    try {
      if (!this.WHATSAPP_ENABLED) {
        throw new AppError('WhatsApp está deshabilitado', 503);
      }

      const result = await this.whatsappClient.sendMessage(this.formatPhoneNumber(phone), message);

      logger.info('Mensaje personalizado enviado', { phone, messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Error enviando mensaje personalizado', error);
      throw error;
    }
  }

  async sendFileMessage(phone: string, fileUrl: string, caption?: string): Promise<any> {
    try {
      if (!this.WHATSAPP_ENABLED) {
        throw new AppError('WhatsApp está deshabilitado', 503);
      }

      const result = await this.whatsappClient.sendFile(this.formatPhoneNumber(phone), fileUrl, caption);

      logger.info('Archivo enviado por WhatsApp', { phone, fileUrl, messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Error enviando archivo', error);
      throw error;
    }
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

    logger.info('Notificaciones masivas enviadas', { total: results.length, successful: results.filter(r => r.success).length });
    return results;
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    return '+' + cleaned;
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

  private formatCurrency(amount: number, language: 'pt' | 'en' | 'es'): string {
    const formatters = {
      pt: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
      en: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL' }),
      es: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'BRL' })
    };
    return formatters[language].format(amount);
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
