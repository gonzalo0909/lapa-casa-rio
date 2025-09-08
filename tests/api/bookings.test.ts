import request from 'supertest';
import app from '../../src/app';

describe('POST /api/bookings', () => {
  it('should create booking with valid data', async () => {
    const bookingData = {
      guest: {
        nombre: 'Test User',
        email: 'test@example.com',
        telefono: '(11) 99999-9999',
      },
      dates: {
        entrada: '2025-02-01',
        salida: '2025-02-03',
      },
      guests: {
        hombres: 1,
        mujeres: 1,
      },
      beds: [
        { roomId: 1, bedNumber: 1 },
        { roomId: 1, bedNumber: 2 },
      ],
      totalPrice: 220,
    };

    const response = await request(app)
      .post('/api/bookings')
      .send(bookingData);

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body).toHaveProperty('bookingId');
    expect(response.body.status).toBe('PENDING');
  });

  it('should reject invalid guest data', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({
        guest: { nombre: 'X' }, // Muy corto
        dates: { entrada: '2025-02-01', salida: '2025-02-03' },
        guests: { hombres: 1, mujeres: 0 },
        beds: [{ roomId: 1, bedNumber: 1 }],
        totalPrice: 110,
      });

    expect(response.status).toBe(400);
    expect(response.body.ok).toBe(false);
  });
});

describe('GET /api/bookings/:bookingId', () => {
  it('should get booking details', async () => {
    // Crear booking primero
    const bookingData = {
      guest: { nombre: 'Test User', email: 'get-test@example.com' },
      dates: { entrada: '2025-02-01', salida: '2025-02-03' },
      guests: { hombres: 1, mujeres: 0 },
      beds: [{ roomId: 1, bedNumber: 1 }],
      totalPrice: 110,
    };

    const createResponse = await request(app)
      .post('/api/bookings')
      .send(bookingData);

    const bookingId = createResponse.body.bookingId;

    // Obtener detalles
    const getResponse = await request(app)
      .get(`/api/bookings/${bookingId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.ok).toBe(true);
    expect(getResponse.body.booking.bookingId).toBe(bookingId);
  });

  it('should return 404 for non-existent booking', async () => {
    const response = await request(app)
      .get('/api/bookings/NON-EXISTENT');

    expect(response.status).toBe(404);
  });
});
