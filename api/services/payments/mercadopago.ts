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
      throw new Error('MercadoPago access token not configured');
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
          notification_url: `${config.apiBaseUrl}/api/payments/mercadopago/webhook`,
          expires: true,
          expiration_date_from: new Date().toISOString(),
          expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
        },
      });

      logger.info('MercadoPago preference created', { 
        preferenceId: response.id, 
        bookingId: data.bookingId 
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
        
        return {
          bookingId: payment.external_reference || undefined,
          status: payment.status || 'unknown',
        };
      }

      return { status: 'ignored' };

    } catch (error) {
      logger.error('MercadoPago webhook processing failed:', error);
      throw new PaymentError('Webhook processing failed');
    }
  }

  async getPaymentDetails(paymentId: string): Promise<{
    status: string;
    amount: number;
    bookingId?: string;
    method?: string;
  }> {
    try {
      const payment = await this.payment.get({ id: paymentId });

      return {
        status: payment.status || 'unknown',
        amount: payment.transaction_amount || 0,
        bookingId: payment.external_reference || undefined,
        method: payment.payment_method?.type,
      };

    } catch (error) {
      logger.error('Error retrieving MercadoPago payment:', error);
      throw new PaymentError('Payment not found');
    }
  }

  async createRefund(paymentId: string, amount?: number): Promise<{ refundId: string; status: string }> {
    try {
      // MercadoPago refunds se manejan diferente según el método de pago
      const payment = await this.payment.get({ id: paymentId });
      
      if (payment.status === 'approved') {
        // Para pagos aprobados, crear reembolso
        const refundResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.mercadoPago.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amount || payment.transaction_amount,
          }),
        });

        const refund = await refundResponse.json();

        logger.info('MercadoPago refund created', { refundId: refund.id, amount: refund.amount });

        return {
          refundId: refund.id,
          status: refund.status,
        };
      }

      throw new PaymentError('Payment cannot be refunded');

    } catch (error) {
      logger.error('MercadoPago refund failed:', error);
      throw new PaymentError('Refund processing failed');
    }
  }
}
