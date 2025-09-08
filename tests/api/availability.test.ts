import request from 'supertest';
import app from '../../src/app';

describe('GET /api/availability', () => {
  it('should return availability for valid dates', async () => {
    const response = await request(app)
      .get('/api/availability')
      .query({
        from: '2025-01-01',
        to: '2025-01-03',
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body).toHaveProperty('room1');
    expect(response.body).toHaveProperty('room3');
    expect(response.body).toHaveProperty('room5');
    expect(response.body).toHaveProperty('room6');
    expect(response.body).toHaveProperty('occupiedBeds');
  });

  it('should reject invalid date format', async () => {
    const response = await request(app)
      .get('/api/availability')
      .query({
        from: 'invalid-date',
        to: '2025-01-03',
      });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });

  it('should reject missing dates', async () => {
    const response = await request(app)
      .get('/api/availability')
      .query({});

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });
});

describe('POST /api/availability/check-group', () => {
  it('should check group availability', async () => {
    const response = await request(app)
      .post('/api/availability/check-group')
      .send({
        from: '2025-01-01',
        to: '2025-01-03',
        hombres: 2,
        mujeres: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body).toHaveProperty('canAccommodate');
    expect(response.body).toHaveProperty('allowedRooms');
    expect(response.body.totalGuests).toBe(3);
  });
});
