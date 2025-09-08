import { logger } from '../utils/logger';
import { config } from '../config';

export class NotificationService {
  
  async sendWhatsAppMessage(data: {
    to: string;
    message: string;
    type?: 'booking' | 'payment' | 'reminder';
  }): Promise<void> {
    try {
      // Integración con WhatsApp Business API
      // Por ahora mock, implementar con Twilio o similar
      logger.info('WhatsApp message sent', { to: data.to, type: data.type });
      
    } catch (error) {
      logger.error('WhatsApp message failed:', error);
    }
  }

  async sendBookingReminder(data: {
    guestPhone: string;
    guestName: string;
    bookingId: string;
    checkInDate: string;
  }): Promise<void> {
    const message = `Olá ${data.guestName}! Seu check-in no Lapa Casa Hostel é amanhã (${data.checkInDate}). Reserva: ${data.bookingId}. Até logo!`;
    
    await this.sendWhatsAppMessage({
      to: data.guestPhone,
      message,
      type: 'reminder',
    });
  }

  async sendPaymentNotification(data: {
    guestPhone: string;
    guestName: string;
    bookingId: string;
    amount: number;
  }): Promise<void> {
    const message = `${data.guestName}, pagamento de R$ ${data.amount} confirmado para reserva ${data.bookingId}. Obrigado!`;
    
    await this.sendWhatsAppMessage({
      to: data.guestPhone,
      message,
      type: 'payment',
    });
  }
}
