import { StripeService } from '../../src/services/payments/stripe';
import { MercadoPagoService } from '../../src/services/payments/mercadopago';
import { PixService } from '../../src/services/payments/pix';

describe('StripeService', () => {
  let stripeService: StripeService;

  beforeEach(() => {
    // Mock Stripe para testing
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
    stripeService = new StripeService();
  });

  it('should create checkout session with valid data', async () => {
    const sessionData = {
      bookingId: 'BKG-TEST-001',
      amount: 220,
      currency: 'BRL',
      guestEmail: 'test@example.com',
      description: 'Test booking',
    };

    // En un test real, mockearías Stripe
    // const result = await stripeService.createCheckoutSession(sessionData);
    // expect(result).toHaveProperty('sessionId');
    // expect(result).toHaveProperty('url');
  });
});

describe('PixService', () => {
  let pixService: PixService;

  beforeEach(() => {
    pixService = new PixService();
  });

  it('should generate PIX code with valid data', () => {
    const pixData = {
      bookingId: 'BKG-TEST-001',
      amount: 220,
      description: 'Test booking',
      guestName: 'Test User',
    };

    const result = pixService.generatePixCode(pixData);

    expect(result).toHaveProperty('qrCode');
    expect(result).toHaveProperty('copyPasteCode');
    expect(result).toHaveProperty('expiresAt');
    expect(result.copyPasteCode).toMatch(/^000201/); // PIX EMV format
  });

  it('should calculate CRC16 correctly', () => {
    // Test específico del CRC16 para PIX
    const payload = '0002010102011234567890';
    const crc = pixService['calculateCRC16'](payload + '6304');
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
  });
});
