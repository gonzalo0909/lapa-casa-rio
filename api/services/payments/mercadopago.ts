import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { PaymentError } from '../../utils/errors';

export interface MPPreferenceData {
  bookingId: string;
  amount: number;
  guestEmail: string;
  description: string;
  guestName: string;
}

export class MercadoPagoService {
  private client: MercadoPagoConfig;
  private preference: Preference;
  private payment: Payment;

  constructor() {
    if (!config.mercadoPago.accessToken) {
      throw new PaymentError('MercadoPago access token not configured');
    }

    this.client = new MercadoPagoConfig({
      accessToken: config.mercadoPago.accessToken,
    });

    this.preference = new Preference(this.client);
    this.payment = new Payment(this.client);
  }

  async createPreference(data: MPPreferenceData): Promise<{ preferenceId: string; initPoint: string }> {
    try {
      const response = await this.preference.create({
        body: {
          items: [
            {
              title: 'Reserva Lapa Casa Hostel',
              description: data.description,
              quantity: 1,
              currency_id: 'BRL',
              unit_price: parseFloat(data.amount.toFixed(2)),
            },
          ],
          payer: {
            email: data.guestEmail,
            name: data.guestName,
          },
          back_urls: {
            success: `${config.frontendUrl}/booking/success`,
            failure: `${config.frontendUrl}/booking/failure`,
            pending: `${config.frontendUrl}/booking/pending`,
          },
          auto_return: 'approved',
          external_reference: data.bookingId,
          notification_url: process.env.WEBHOOK_BASE_URL || process.env.BASE_URL || 'https://api.lapacasahostel.com/api/payments/mercadopago/webhook',
          expires: true,
          expiration_date_from: new Date().toISOString(),
          expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
        },
      });

      logger.info('MercadoPago preference created', {
        preferenceId: response.id,
        bookingId: data.bookingId,
      });

      return {
        preferenceId: response.id!,
        initPoint: response.init_point!,
      };

    } catch (error) {
      logger.error('MercadoPago preference creation failed:', error);
      throw new PaymentError(`Error creating payment preference: ${error}`);
    }
  }

  async handleWebhook(data: { id: string; topic: string }): Promise<{ bookingId?: string; status: string }> {
    logger.info('Processing MercadoPago webhook:', data);

    try {
      if (data.topic === 'payment') {
        const payment = await this.payment.get({ id: data.id });

        const bookingId = payment.external_reference || undefined;
        const status = payment.status || 'unknown';

        logger.info('Webhook payment received', { bookingId, status });

        // TODO: Implement real reconciliation with Sheets/DB
        // await sheetsService.updateBookingPaymentStatus(bookingId, status);

        return {
          bookingId,
          status,
        };
      }

      return { status: 'ignored' };

    } catch (error) {
      logger.error('Failed to process MercadoPago webhook:', error);
      throw new PaymentError(`Webhook error: ${error}`);
    }
  }
}
