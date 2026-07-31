// lapa-casa-hostel/backend/src/integrations/whatsapp/whatsapp-client.ts

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
}

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export class WhatsAppClient {
  private client: AxiosInstance;
  private phoneNumberId: string;
  private accessToken: string;
  private businessAccountId: string;

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error('WhatsApp credentials not configured');
    }

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/v18.0/${this.phoneNumberId}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  async sendTextMessage(to: string, message: string): Promise<string> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);

      const payload: WhatsAppMessage = {
        to: formattedPhone,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await this.client.post<WhatsAppResponse>(
        '/messages',
        {
          messaging_product: 'whatsapp',
          ...payload
        }
      );

      const messageId = response.data.messages[0].id;

      logger.info('WhatsApp text message sent', {
        to: formattedPhone,
        messageId
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to send WhatsApp text message', { error, to });
      throw new Error('WhatsApp message send failed');
    }
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'pt_BR',
    parameters?: Array<{ type: string; text: string }>
  ): Promise<string> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);

      const payload: WhatsAppMessage = {
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          }
        }
      };

      if (parameters && parameters.length > 0) {
        payload.template!.components = [
          {
            type: 'body',
            parameters
          }
        ];
      }

      const response = await this.client.post<WhatsAppResponse>(
        '/messages',
        {
          messaging_product: 'whatsapp',
          ...payload
        }
      );

      const messageId = response.data.messages[0].id;

      logger.info('WhatsApp template message sent', {
        to: formattedPhone,
        templateName,
        messageId
      });

      return messageId;
    } catch (error) {
      logger.error('Failed to send WhatsApp template message', {
        error,
        to,
        templateName
      });
      throw new Error('WhatsApp template message send failed');
    }
  }

  async sendBookingConfirmation(
    phoneNumber: string,
    guestName: string,
    bookingId: string,
    checkInDate: string,
    checkOutDate: string,
    roomName: string,
    bedsCount: number
  ): Promise<string> {
    try {
      const parameters = [
        { type: 'text', text: guestName },
        { type: 'text', text: bookingId },
        { type: 'text', text: checkInDate },
        { type: 'text', text: checkOutDate },
        { type: 'text', text: roomName },
        { type: 'text', text: bedsCount.toString() }
      ];

      return await this.sendTemplateMessage(
        phoneNumber,
        'booking_confirmation',
        'pt_BR',
        parameters
      );
    } catch (error) {
      logger.error('Failed to send booking confirmation', {
        error,
        phoneNumber,
        bookingId
      });
      throw error;
    }
  }

  async sendPaymentReminder(
    phoneNumber: string,
    guestName: string,
    bookingId: string,
    amountDue: number,
    dueDate: string
  ): Promise<string> {
    try {
      const parameters = [
        { type: 'text', text: guestName },
        { type: 'text', text: bookingId },
        { type: 'text', text: `R$ ${amountDue.toFixed(2)}` },
        { type: 'text', text: dueDate }
      ];

      return await this.sendTemplateMessage(
        phoneNumber,
        'payment_reminder',
        'pt_BR',
        parameters
      );
    } catch (error) {
      logger.error('Failed to send payment reminder', {
        error,
        phoneNumber,
        bookingId
      });
      throw error;
    }
  }

  async sendCheckInInstructions(
    phoneNumber: string,
    guestName: string,
    checkInTime: string,
    address: string
  ): Promise<string> {
    try {
      const parameters = [
        { type: 'text', text: guestName },
        { type: 'text', text: checkInTime },
        { type: 'text', text: address }
      ];

      return await this.sendTemplateMessage(
        phoneNumber,
        'checkin_instructions',
        'pt_BR',
        parameters
      );
    } catch (error) {
      logger.error('Failed to send check-in instructions', {
        error,
        phoneNumber
      });
      throw error;
    }
  }

  async sendCancellationConfirmation(
    phoneNumber: string,
    guestName: string,
    bookingId: string,
    refundAmount?: number
  ): Promise<string> {
    try {
      const parameters = [
        { type: 'text', text: guestName },
        { type: 'text', text: bookingId }
      ];

      if (refundAmount !== undefined) {
        parameters.push({
          type: 'text',
          text: `R$ ${refundAmount.toFixed(2)}`
        });
      }

      return await this.sendTemplateMessage(
        phoneNumber,
        'booking_cancellation',
        'pt_BR',
        parameters
      );
    } catch (error) {
      logger.error('Failed to send cancellation confirmation', {
        error,
        phoneNumber,
        bookingId
      });
      throw error;
    }
  }

  async sendDepositConfirmation(
    phoneNumber: string,
    guestName: string,
    bookingId: string,
    depositAmount: number,
    remainingAmount: number
  ): Promise<string> {
    try {
      const parameters = [
        { type: 'text', text: guestName },
        { type: 'text', text: bookingId },
        { type: 'text', text: `R$ ${depositAmount.toFixed(2)}` },
        { type: 'text', text: `R$ ${remainingAmount.toFixed(2)}` }
      ];

      return await this.sendTemplateMessage(
        phoneNumber,
        'deposit_confirmation',
        'pt_BR',
        parameters
      );
    } catch (error) {
      logger.error('Failed to send deposit confirmation', {
        error,
        phoneNumber,
        bookingId
      });
      throw error;
    }
  }

  async sendCustomMessage(
    phoneNumber: string,
    message: string
  ): Promise<string> {
    return await this.sendTextMessage(phoneNumber, message);
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('55')) {
      return cleaned;
    }

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    return cleaned;
  }

  async verifyPhoneNumber(phone: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      if (formattedPhone.length < 12 || formattedPhone.length > 13) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Phone number verification failed', { error, phone });
      return false;
    }
  }

  async getMessageStatus(messageId: string): Promise<string> {
    try {
      const response = await this.client.get(`/messages/${messageId}`);
      return response.data.status;
    } catch (error) {
      logger.error('Failed to get message status', { error, messageId });
      throw new Error('Message status retrieval failed');
    }
  }

  async sendBulkMessages(
    recipients: Array<{ phone: string; message: string }>
  ): Promise<Array<{ phone: string; messageId?: string; error?: any }>> {
    const results = [];

    for (const recipient of recipients) {
      try {
        const messageId = await this.sendTextMessage(
          recipient.phone,
          recipient.message
        );
        results.push({ phone: recipient.phone, messageId });
        
        await this.delay(1000);
      } catch (error) {
        results.push({ phone: recipient.phone, error });
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/');
      return true;
    } catch (error) {
      logger.error('WhatsApp health check failed', { error });
      return false;
    }
  }
}

export const whatsAppClient = new WhatsAppClient();
