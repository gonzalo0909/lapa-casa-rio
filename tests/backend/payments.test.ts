// lapa-casa-hostel/tests/backend/payments.test.ts

import { PaymentService } from '@/services/payment-service';
import Stripe from 'stripe';

jest.mock('stripe');

/**
 * @fileoverview Test suite for payment processing
 * Tests Stripe, Mercado Pago, PIX, webhooks, refunds
 */

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    mockStripe = new Stripe('test_key') as jest.Mocked<Stripe>;
    paymentService = new PaymentService(mockStripe);
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    test('creates Stripe payment intent successfully', async () => {
      mockStripe.paymentIntents.create = jest.fn().mockResolvedValue({
        id: 'pi_123',
        client_secret: 'secret_123',
        amount: 41472,
        currency: 'brl',
        status: 'requires_payment_method'
      });

      const result = await paymentService.createPaymentIntent({
        amount: 414.72,
        currency: 'BRL',
        bookingId: 'booking_123'
      });

      expect(result.paymentIntentId).toBe('pi_123');
      expect(result.clientSecret).toBe('secret_123');
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 41472,
        currency: 'brl',
        metadata: { bookingId: 'booking_123' }
      });
    });

    test('converts BRL to cents correctly', async () => {
      mockStripe.paymentIntents.create = jest.fn().mockResolvedValue({
        id: 'pi_123',
        client_secret: 'secret_123'
      });

      await paymentService.createPaymentIntent({
        amount: 1382.40,
        currency: 'BRL',
        bookingId: 'booking_123'
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 138240 })
      );
    });

    test('handles Stripe API errors', async () => {
      mockStripe.paymentIntents.create = jest.fn().mockRejectedValue({
        type: 'StripeAPIError',
        message: 'API Error'
      });

      await expect(
        paymentService.createPaymentIntent({
          amount: 414.72,
          currency: 'BRL',
          bookingId: 'booking_123'
        })
      ).rejects.toThrow('API Error');
    });
  });

  describe('confirmPayment', () => {
    test('confirms payment successfully', async () => {
      mockStripe.paymentIntents.retrieve = jest.fn().mockResolvedValue({
        id: 'pi_123',
        status: 'succeeded',
        amount: 41472
      });

      const result = await paymentService.confirmPayment('pi_123');

      expect(result.status).toBe('succeeded');
      expect(result.amount).toBe(414.72);
    });

    test('handles payment failures', async () => {
      mockStripe.paymentIntents.retrieve = jest.fn().mockResolvedValue({
        id: 'pi_123',
        status: 'requires_payment_method',
        last_payment_error: {
          message: 'Your card was declined'
        }
      });

      const result = await paymentService.confirmPayment('pi_123');

      expect(result.status).toBe('requires_payment_method');
      expect(result.error).toBe('Your card was declined');
    });
  });

  describe('createPixPayment', () => {
    test('creates PIX payment successfully', async () => {
      const mockPixData = {
        qrCode: 'pix_qr_code_data',
        qrCodeUrl: 'https://example.com/qr.png',
        paymentId: 'pix_123',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };

      mockStripe.paymentIntents.create = jest.fn().mockResolvedValue({
        id: 'pi_pix_123',
        next_action: {
          pix_display_qr_code: mockPixData
        }
      });

      const result = await paymentService.createPixPayment({
        amount: 414.72,
        bookingId: 'booking_123'
      });

      expect(result.qrCode).toBe('pix_qr_code_data');
      expect(result.paymentId).toBe('pix_123');
    });

    test('sets PIX expiration to 30 minutes', async () => {
      const beforeTime = Date.now();

      mockStripe.paymentIntents.create = jest.fn().mockResolvedValue({
        id: 'pi_pix_123',
        next_action: {
          pix_display_qr_code: {
            expiresAt: new Date(beforeTime + 30 * 60 * 1000).toISOString()
          }
        }
      });

      const result = await paymentService.createPixPayment({
        amount: 414.72,
        bookingId: 'booking_123'
      });

      const expirationTime = new Date(result.expiresAt).getTime();
      const expectedTime = beforeTime + 30 * 60 * 1000;

      expect(Math.abs(expirationTime - expectedTime)).toBeLessThan(1000);
    });
  });

  describe('processRefund', () => {
    test('processes full refund successfully', async () => {
      mockStripe.refunds.create = jest.fn().mockResolvedValue({
        id: 'ref_123',
        amount: 41472,
        status: 'succeeded'
      });

      const result = await paymentService.processRefund({
        paymentIntentId: 'pi_123',
        amount: 414.72,
        reason: 'requested_by_customer'
      });

      expect(result.refundId).toBe('ref_123');
      expect(result.amount).toBe(414.72);
      expect(result.status).toBe('succeeded');
    });

    test('processes partial refund', async () => {
      mockStripe.refunds.create = jest.fn().mockResolvedValue({
        id: 'ref_123',
        amount: 20736,
        status: 'succeeded'
      });

      const result = await paymentService.processRefund({
        paymentIntentId: 'pi_123',
        amount: 207.36,
        reason: 'cancellation_fee'
      });

      expect(result.amount).toBe(207.36);
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
        amount: 20736,
        reason: 'cancellation_fee'
      });
    });

    test('handles refund failures', async () => {
      mockStripe.refunds.create = jest.fn().mockRejectedValue({
        type: 'StripeInvalidRequestError',
        message: 'Charge has already been refunded'
      });

      await expect(
        paymentService.processRefund({
          paymentIntentId: 'pi_123',
          amount: 414.72
        })
      ).rejects.toThrow('Charge has already been refunded');
    });
  });

  describe('handleWebhook', () => {
    test('processes payment_intent.succeeded webhook', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            amount: 41472,
            status: 'succeeded',
            metadata: { bookingId: 'booking_123' }
          }
        }
      };

      mockStripe.webhooks.constructEvent = jest.fn().mockReturnValue(webhookPayload);

      const result = await paymentService.handleWebhook(
        JSON.stringify(webhookPayload),
        'valid-signature'
      );

      expect(result.handled).toBe(true);
      expect(result.bookingId).toBe('booking_123');
    });

    test('processes payment_intent.payment_failed webhook', async () => {
      const webhookPayload = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_123',
            last_payment_error: {
              message: 'Your card was declined'
            },
            metadata: { bookingId: 'booking_123' }
          }
        }
      };

      mockStripe.webhooks.constructEvent = jest.fn().mockReturnValue(webhookPayload);

      const result = await paymentService.handleWebhook(
        JSON.stringify(webhookPayload),
        'valid-signature'
      );

      expect(result.handled).toBe(true);
      expect(result.error).toBe('Your card was declined');
    });

    test('validates webhook signature', async () => {
      mockStripe.webhooks.constructEvent = jest.fn().mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        paymentService.handleWebhook('payload', 'invalid-signature')
      ).rejects.toThrow('Invalid signature');
    });

    test('ignores unhandled webhook types', async () => {
      const webhookPayload = {
        type: 'customer.created',
        data: { object: {} }
      };

      mockStripe.webhooks.constructEvent = jest.fn().mockReturnValue(webhookPayload);

      const result = await paymentService.handleWebhook(
        JSON.stringify(webhookPayload),
        'valid-signature'
      );

      expect(result.handled).toBe(false);
    });
  });

  describe('Deposit Scheduling', () => {
    test('schedules remaining payment 7 days before check-in', async () => {
      const checkInDate = '2025-07-15';
      const expectedChargeDate = '2025-07-08';

      const result = await paymentService.scheduleRemainingPayment({
        bookingId: 'booking_123',
        amount: 967.68,
        checkInDate
      });

      expect(result.scheduledDate).toBe(expectedChargeDate);
      expect(result.amount).toBe(967.68);
    });

    test('retries failed remaining payments', async () => {
      mockStripe.paymentIntents.create = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          id: 'pi_retry_123',
          status: 'succeeded'
        });

      const result = await paymentService.processRemainingPayment({
        bookingId: 'booking_123',
        amount: 967.68,
        retryAttempt: 1
      });

      expect(result.success).toBe(true);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(2);
    });

    test('stops retrying after 3 attempts', async () => {
      mockStripe.paymentIntents.create = jest.fn()
        .mockRejectedValue(new Error('Persistent error'));

      await expect(
        paymentService.processRemainingPayment({
          bookingId: 'booking_123',
          amount: 967.68,
          retryAttempt: 3
        })
      ).rejects.toThrow('Maximum retry attempts reached');
    });
  });

  describe('Security', () => {
    test('sanitizes sensitive data in logs', () => {
      const sensitiveData = {
        cardNumber: '4242424242424242',
        cvc: '123',
        email: 'user@example.com'
      };

      const sanitized = paymentService.sanitizeForLogging(sensitiveData);

      expect(sanitized.cardNumber).toBe('****4242');
      expect(sanitized.cvc).toBe('***');
      expect(sanitized.email).toBe('u***@example.com');
    });

    test('validates amount is positive', async () => {
      await expect(
        paymentService.createPaymentIntent({
          amount: -100,
          currency: 'BRL',
          bookingId: 'booking_123'
        })
      ).rejects.toThrow('Amount must be positive');
    });

    test('validates currency is supported', async () => {
      await expect(
        paymentService.createPaymentIntent({
          amount: 100,
          currency: 'INVALID',
          bookingId: 'booking_123'
        })
      ).rejects.toThrow('Unsupported currency');
    });
  });
});
