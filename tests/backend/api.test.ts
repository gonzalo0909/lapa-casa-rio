// lapa-casa-hostel/tests/backend/api.test.ts

import request from 'supertest';
import { app } from '@/app';

/**
 * @fileoverview Integration tests for API endpoints
 * Tests all REST API routes, validation, error handling
 */

describe('API Endpoints', () => {
  describe('POST /api/bookings', () => {
    test('creates booking successfully', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          checkIn: '2025-07-01',
          checkOut: '2025-07-05',
          rooms: [{ roomId: 'room_mixto_12a', beds: 8 }],
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+5521999999999',
            country: 'BR'
          }
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING');
      expect(response.body.totalAmount).toBeDefined();
    });

    test('validates required fields', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          checkIn: '2025-07-01'
        })
        .expect(400);

      expect(response.body.error).toMatch(/required/i);
    });

    test('validates date format', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send({
          checkIn: 'invalid-date',
          checkOut: '2025-07-05',
          rooms: [{ roomId: 'room_mixto_12a', beds: 8 }],
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+5521999999999'
          }
        })
        .expect(400);

      expect(response.body.error).toMatch(/invalid date/i);
    });

    test('rate limits requests', async () => {
      const requests = Array(11).fill(null).map(() =>
        request(app)
          .post('/api/bookings')
          .send({
            checkIn: '2025-07-01',
            checkOut: '2025-07-05',
            rooms: [{ roomId: 'room_mixto_12a', beds: 1 }],
            guest: {
              name: 'Test',
              email: 'test@example.com',
              phone: '+5521999999999'
            }
          })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    });
  });

  describe('GET /api/bookings/:id', () => {
    test('retrieves booking by ID', async () => {
      const createResponse = await request(app)
        .post('/api/bookings')
        .send({
          checkIn: '2025-07-01',
          checkOut: '2025-07-05',
          rooms: [{ roomId: 'room_mixto_12a', beds: 8 }],
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+5521999999999'
          }
        });

      const bookingId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/bookings/${bookingId}`)
        .expect(200);

      expect(response.body.id).toBe(bookingId);
    });

    test('returns 404 for non-existent booking', async () => {
      await request(app)
        .get('/api/bookings/nonexistent')
        .expect(404);
    });
  });

  describe('GET /api/availability/check', () => {
    test('checks availability successfully', async () => {
      const response = await request(app)
        .get('/api/availability/check')
        .query({
          checkIn: '2025-07-01',
          checkOut: '2025-07-05'
        })
        .expect(200);

      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('rooms');
    });

    test('validates date parameters', async () => {
      await request(app)
        .get('/api/availability/check')
        .query({
          checkIn: 'invalid'
        })
        .expect(400);
    });

    test('caches availability results', async () => {
      const response1 = await request(app)
        .get('/api/availability/check')
        .query({
          checkIn: '2025-07-01',
          checkOut: '2025-07-05'
        });

      const response2 = await request(app)
        .get('/api/availability/check')
        .query({
          checkIn: '2025-07-01',
          checkOut: '2025-07-05'
        });

      expect(response1.headers['x-cache']).toBe('MISS');
      expect(response2.headers['x-cache']).toBe('HIT');
    });
  });

  describe('POST /api/payments/create-intent', () => {
    test('creates payment intent', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .send({
          bookingId: 'booking_123',
          amount: 414.72,
          currency: 'BRL'
        })
        .expect(200);

      expect(response.body).toHaveProperty('clientSecret');
      expect(response.body).toHaveProperty('paymentIntentId');
    });

    test('validates amount', async () => {
      await request(app)
        .post('/api/payments/create-intent')
        .send({
          bookingId: 'booking_123',
          amount: -100,
          currency: 'BRL'
        })
        .expect(400);
    });
  });

  describe('POST /api/payments/webhook', () => {
    test('handles stripe webhook', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            amount: 41472,
            status: 'succeeded'
          }
        }
      };

      await request(app)
        .post('/api/payments/webhook')
        .send(webhookPayload)
        .set('stripe-signature', 'valid-signature')
        .expect(200);
    });

    test('validates webhook signature', async () => {
      await request(app)
        .post('/api/payments/webhook')
        .send({ type: 'payment_intent.succeeded' })
        .expect(401);
    });
  });

  describe('PATCH /api/bookings/:id', () => {
    test('updates booking', async () => {
      const createResponse = await request(app)
        .post('/api/bookings')
        .send({
          checkIn: '2025-07-01',
          checkOut: '2025-07-05',
          rooms: [{ roomId: 'room_mixto_12a', beds: 8 }],
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+5521999999999'
          }
        });

      const response = await request(app)
        .patch(`/api/bookings/${createResponse.body.id}`)
        .send({
          specialRequests: 'Updated request'
        })
        .expect(200);

      expect(response.body.specialRequests).toBe('Updated request');
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    test('cancels booking', async () => {
      const createResponse = await request(app)
        .post('/api/bookings')
        .send({
          checkIn: '2025-07-01',
          checkOut: '2025-07-05',
          rooms: [{ roomId: 'room_mixto_12a', beds: 8 }],
          guest: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+5521999999999'
          }
        });

      const response = await request(app)
        .delete(`/api/bookings/${createResponse.body.id}`)
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
    });
  });

  describe('Error Handling', () => {
    test('handles 404 routes', async () => {
      await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });

    test('handles malformed JSON', async () => {
      await request(app)
        .post('/api/bookings')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    test('handles server errors gracefully', async () => {
      await request(app)
        .get('/api/internal-error-test')
        .expect(500);
    });
  });

  describe('CORS', () => {
    test('allows requests from allowed origins', async () => {
      const response = await request(app)
        .options('/api/bookings')
        .set('Origin', 'https://lapacasahostel.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('https://lapacasahostel.com');
    });

    test('blocks requests from disallowed origins', async () => {
      await request(app)
        .options('/api/bookings')
        .set('Origin', 'https://malicious.com')
        .expect(403);
    });
  });

  describe('Authentication', () => {
    test('protects admin routes', async () => {
      await request(app)
        .get('/api/admin/bookings')
        .expect(401);
    });

    test('allows authenticated admin access', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', 'Bearer valid-admin-token')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });
  });
});
