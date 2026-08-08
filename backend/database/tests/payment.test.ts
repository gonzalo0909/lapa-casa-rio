// lapa-casa-hostel/backend/database/tests/payment.test.ts
// ventana3
//
// Prueba contra Postgres local: payment_repository + payment_service en modo
// test (sin STRIPE_SECRET_KEY ni MP_ACCESS_TOKEN --> handlers retornan IDs falsos).

import { pool } from '../../src/config/database';
import { PaymentRepository } from '../../src/database/repositories/payment-repository';
import { BookingRepository } from '../../src/database/repositories/booking-repository';

const paymentRepo = new PaymentRepository();
const bookingRepo = new BookingRepository();

// IDs de la reserva y huesped que crearemos para los tests
let testReservationId: string;
let testGuestId: string;
let directChannelId: string;

beforeAll(async () => {
  // Obtener el canal 'direct'
  const { rows: channelRows } = await pool.query(`SELECT id FROM channels WHERE code = 'direct' LIMIT 1`);
  if (channelRows.length === 0) throw new Error('Canal direct no encontrado');
  directChannelId = channelRows[0].id;

  // Crear huesped de prueba
  const { rows: guestRows } = await pool.query(
    `INSERT INTO guests (full_name, email, phone, country, language)
     VALUES ('Test Payment Guest', 'payment_test@lapa.test', '+5511999999999', 'BR', 'pt')
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`
  );
  testGuestId = guestRows[0].id;

  // Crear reserva de prueba en el futuro (beds_count=2, para que deposito sea 30%)
  const { rows: resRows } = await pool.query(
    `INSERT INTO reservations (
       reservation_number, guest_id, channel_id,
       check_in_date, check_out_date, nights_count, beds_count,
       base_price, season_multiplier, group_discount, early_bird_discount, final_price,
       deposit_percent, deposit_amount, remaining_amount, status
     ) VALUES (
       $1, $2, $3,
       '2028-12-01', '2028-12-03', 2, 2,
       120.00, 1.0, 0.0, 0.0, 360.00,
       0.30, 108.00, 252.00, 'pending_payment'
     ) RETURNING id`,
    [`PT-${Date.now().toString(36).toUpperCase()}`, testGuestId, directChannelId]
  );
  testReservationId = resRows[0].id;
});

afterAll(async () => {
  // Limpiar todo lo que creamos (FK: payments -> reservations -> guests)
  await pool.query(`DELETE FROM payments WHERE reservation_id = $1`, [testReservationId]);
  await pool.query(`DELETE FROM reservations WHERE id = $1`, [testReservationId]);
  await pool.query(`DELETE FROM guests WHERE id = $1`, [testGuestId]);
  await pool.end();
});

describe('PaymentRepository - CRUD basico', () => {
  let createdPaymentId: string;

  it('create() inserta un pago pendiente con provider stripe', async () => {
    const payment = await paymentRepo.create({
      reservation_id: testReservationId,
      guest_id: testGuestId,
      amount: 108.00,
      currency: 'BRL',
      provider: 'stripe',
      payment_type: 'deposit',
      provider_payment_id: `pi_test_${Date.now()}`,
    });

    // Capture ID first so subsequent tests can use it even if assertions below fail
    createdPaymentId = payment.id;

    expect(payment.id).toBeDefined();
    expect(payment.reservation_id).toBe(testReservationId);
    expect(Number(payment.amount)).toBe(108);
    expect(payment.status).toBe('pending');
    expect(payment.provider).toBe('stripe');
    expect(payment.payment_type).toBe('deposit');
  });

  it('findById() recupera el pago por id interno', async () => {
    const payment = await paymentRepo.findById(createdPaymentId);
    expect(payment).not.toBeNull();
    expect(payment!.id).toBe(createdPaymentId);
  });

  it('findByProviderPaymentId() recupera el pago por id del proveedor', async () => {
    const payment = await paymentRepo.findById(createdPaymentId);
    const byProvider = await paymentRepo.findByProviderPaymentId(payment!.provider_payment_id!);
    expect(byProvider).not.toBeNull();
    expect(byProvider!.id).toBe(createdPaymentId);
  });

  it('findByReservation() lista los pagos de una reserva', async () => {
    const payments = await paymentRepo.findByReservation(testReservationId);
    expect(payments.length).toBeGreaterThanOrEqual(1);
    expect(payments.some(p => p.id === createdPaymentId)).toBe(true);
  });

  it('markCompleted() cambia status a succeeded y registra paid_at', async () => {
    const payment = await paymentRepo.markCompleted(createdPaymentId);
    expect(payment.status).toBe('succeeded');
    expect(payment.paid_at).not.toBeNull();
  });

  it('markFailed() cambia status a failed y registra failure_reason', async () => {
    // Crear segundo pago para testear fallo
    const p2 = await paymentRepo.create({
      reservation_id: testReservationId,
      guest_id: testGuestId,
      amount: 108.00,
      currency: 'BRL',
      provider: 'mercadopago',
      payment_type: 'deposit',
      provider_payment_id: `mp_test_${Date.now()}`,
    });
    const failed = await paymentRepo.markFailed(p2.id, 'insufficient_funds');
    expect(failed.status).toBe('failed');
    expect(failed.failure_reason).toBe('insufficient_funds');
    expect(failed.failed_at).not.toBeNull();
  });

  it('processRefund() cambia status a refunded y registra refund_amount', async () => {
    // createdPaymentId was already markCompleted, so processRefund must find it
    const refunded = await paymentRepo.processRefund(createdPaymentId, 108.00);
    expect(refunded.status).toBe('refunded');
    expect(Number(refunded.refund_amount)).toBe(108);
    expect(refunded.refunded_at).not.toBeNull();
  });

  it('getStatistics() retorna contadores coherentes', async () => {
    const stats = await paymentRepo.getStatistics();
    expect(typeof stats.totalPayments).toBe('number');
    expect(typeof stats.completedPayments).toBe('number');
    expect(typeof stats.failedPayments).toBe('number');
    expect(typeof stats.totalRevenue).toBe('number');
    expect(stats.totalPayments).toBeGreaterThanOrEqual(stats.completedPayments + stats.failedPayments);
  });
});

describe('PaymentRepository - provider mercadopago', () => {
  it('create() acepta provider mercadopago con payment_type remaining', async () => {
    const payment = await paymentRepo.create({
      reservation_id: testReservationId,
      guest_id: testGuestId,
      amount: 252.00,
      currency: 'BRL',
      provider: 'mercadopago',
      payment_type: 'remaining',
      provider_payment_id: `mp_remaining_${Date.now()}`,
    });
    expect(payment.status).toBe('pending');
    expect(payment.provider).toBe('mercadopago');
    expect(payment.payment_type).toBe('remaining');
    expect(Number(payment.amount)).toBe(252);
  });
});

describe('PaymentRepository - findByStripeIntent / findByMPId', () => {
  let stripePaymentId: string;
  let mpProviderPaymentId: string;

  beforeAll(async () => {
    stripePaymentId = `pi_find_test_${Date.now()}`;
    mpProviderPaymentId = `mp_find_test_${Date.now()}`;

    await paymentRepo.create({
      reservation_id: testReservationId,
      guest_id: testGuestId,
      amount: 50.00,
      currency: 'BRL',
      provider: 'stripe',
      payment_type: 'deposit',
      provider_payment_id: stripePaymentId,
    });

    await paymentRepo.create({
      reservation_id: testReservationId,
      guest_id: testGuestId,
      amount: 50.00,
      currency: 'BRL',
      provider: 'mercadopago',
      payment_type: 'deposit',
      provider_payment_id: mpProviderPaymentId,
    });
  });

  it('findByStripeIntent() retorna el pago stripe correcto', async () => {
    const p = await paymentRepo.findByStripeIntent(stripePaymentId);
    expect(p).not.toBeNull();
    expect(p!.provider).toBe('stripe');
    expect(p!.provider_payment_id).toBe(stripePaymentId);
  });

  it('findByMPId() retorna el pago mercadopago correcto', async () => {
    const p = await paymentRepo.findByMPId(mpProviderPaymentId);
    expect(p).not.toBeNull();
    expect(p!.provider).toBe('mercadopago');
    expect(p!.provider_payment_id).toBe(mpProviderPaymentId);
  });
});

describe('PaymentService.createPaymentIntent - modo test (sin keys reales)', () => {
  it('crea un pago en DB y devuelve payment_id cuando no hay STRIPE_SECRET_KEY', async () => {
    // En modo test, StripeHandler devuelve pi_test_... como ID falso
    const { paymentService } = await import('../../src/services/payment-service');

    const result = await paymentService.createPaymentIntent({
      reservation_id: testReservationId,
      guest_id: testGuestId,
      amount: 108.00,
      currency: 'BRL',
      guest_email: 'payment_test@lapa.test',
      payment_type: 'deposit',
      provider: 'stripe',
    });

    expect(result.payment_id).toBeDefined();
    expect(Number(result.amount)).toBe(108);
    expect(result.currency).toBe('BRL');
    // En modo test el client_secret y provider_payment_id son strings fake
    expect(result.provider_payment_id).toBeDefined();

    // Verificar que el pago quedó en la base
    const dbPayment = await paymentRepo.findById(result.payment_id);
    expect(dbPayment).not.toBeNull();
    expect(dbPayment!.status).toBe('pending');
    expect(dbPayment!.reservation_id).toBe(testReservationId);
  });

  it('usa mercadopago cuando el email es .com.br', async () => {
    const { paymentService } = await import('../../src/services/payment-service');

    const result = await paymentService.createPaymentIntent({
      reservation_id: testReservationId,
      guest_id: testGuestId,
      amount: 108.00,
      currency: 'BRL',
      guest_email: 'convidado@gmail.com.br',
      payment_type: 'deposit',
    });

    expect(result.payment_id).toBeDefined();
    const dbPayment = await paymentRepo.findById(result.payment_id);
    expect(dbPayment!.provider).toBe('mercadopago');
  });
});

describe('BookingRepository - update() y confirmReservation()', () => {
  it('update() acepta final_price sin columnas inexistentes', async () => {
    const updated = await bookingRepo.update(testReservationId, {
      final_price: 360.00,
      special_requests: 'Cama de baixo',
    });
    expect(updated.id).toBe(testReservationId);
    expect(Number(updated.final_price)).toBe(360);
    expect(updated.special_requests).toBe('Cama de baixo');
  });

  it('confirmReservation() cambia status a confirmed', async () => {
    const confirmed = await bookingRepo.confirmReservation(testReservationId);
    expect(confirmed.status).toBe('confirmed');
  });

  it('cancelReservation() cambia status a cancelled con razon', async () => {
    const cancelled = await bookingRepo.cancelReservation(testReservationId, 'test_cleanup');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellation_reason).toBe('test_cleanup');
  });
});

describe('SQL: calculate_cancellation_refund()', () => {
  // Politica vigente (0014_no_refund_cancellation_policy.sql): el
  // deposito no es reembolsable en ningun caso, sin importar la
  // antelacion -- se prueban los mismos 3 puntos que antes tenian
  // 100%/50%/0% para confirmar que ahora los tres dan 0%.
  it('reembolso 0% cancelando con mas de 168h de anticipacion', async () => {
    const { rows } = await pool.query(
      `SELECT calculate_cancellation_refund($1::numeric, $2::date, $3::timestamptz) AS refund`,
      [360.00, '2028-12-01', '2028-11-20T12:00:00Z']
    );
    expect(Number(rows[0].refund)).toBe(0.00);
  });

  it('reembolso 0% entre 48h y 168h', async () => {
    // Cancela 72h antes: 2028-11-28T00:00:00Z
    const { rows } = await pool.query(
      `SELECT calculate_cancellation_refund($1::numeric, $2::date, $3::timestamptz) AS refund`,
      [360.00, '2028-12-01', '2028-11-28T00:00:00Z']
    );
    expect(Number(rows[0].refund)).toBe(0.00);
  });

  it('reembolso 0% cuando cancela con menos de 48h', async () => {
    // Cancela 24h antes: 2028-11-30T00:00:00Z
    const { rows } = await pool.query(
      `SELECT calculate_cancellation_refund($1::numeric, $2::date, $3::timestamptz) AS refund`,
      [360.00, '2028-12-01', '2028-11-30T00:00:00Z']
    );
    expect(Number(rows[0].refund)).toBe(0.00);
  });
});

describe('SQL: calculate_deposit()', () => {
  it('deposito 30% para reservas < 15 camas', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM calculate_deposit($1::numeric, $2::int)`,
      [360.00, 2]
    );
    expect(Number(rows[0].deposit_percent)).toBe(0.30);
    expect(Number(rows[0].deposit_amount)).toBeCloseTo(108.00, 1);
  });

  it('deposito 50% para reservas >= 15 camas', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM calculate_deposit($1::numeric, $2::int)`,
      [900.00, 15]
    );
    expect(Number(rows[0].deposit_percent)).toBe(0.50);
    expect(Number(rows[0].deposit_amount)).toBeCloseTo(450.00, 1);
  });
});
