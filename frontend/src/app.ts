import request from 'supertest';
import app from '../../src/app';
import { db } from '../../src/services/database';

describe('POST /api/payments/create', () => {
  beforeEach(async () => {
    // Crear booking de prueba
    const prisma = db.getClient();
    await prisma.guest.create({
      data: {
        id: 'test-guest-id',
        nombre: 'Test User',
        email: 'test@example.com',
      },
    });

    await prisma.booking.create({
      data: {
        id: 'test-booking-id',
        bookingId: 'BKG-TEST-PAYMENT',
        guestId: 'test-guest-id',
        entrada: new Date('2025-02-01T15:00:00'),
        salida: new Date('2025-02-03T11:00:00'),
        hombres: 1,
        mujeres: 1,
        totalPrice: 220,
      },
    });
  });

  it('should create PIX payment', async () => {
    const response = await request(app)
      .post('/api/payments/create')
      .send({
        bookingId: 'BKG-TEST-PAYMENT',
        method: 'pix',
        guestInfo: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.method).toBe('pix');
    expect(response.body).toHaveProperty('qrCode');
    expect(response.body).toHaveProperty('copyPasteCode');
  });

  it('should reject invalid payment method', async () => {
    const response = await request(app)
      .post('/api/payments/create')
      .send({
        bookingId: 'BKG-TEST-PAYMENT',
        method: 'invalid',
        guestInfo: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });
});

describe('GET /api/payments/:paymentId/status', () => {
  it('should return 404 for non-existent payment', async () => {
    const response = await request(app)
      .get('/api/payments/non-existent/status');

    expect(response.status).toBe(404);
    expect(response.body.ok).toBe(false);
  });
});
