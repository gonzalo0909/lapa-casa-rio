// database/tests/concurrency.test.ts
//
// Ventana 2, entregable 10: "Test de concurrencia: N reservas
// simultaneas sobre la misma cama, con conexiones/promesas realmente
// paralelas -- verificar que solo una tiene exito y las demas fallan de
// forma manejada (no un crash)". Este es el escenario que exhibia el bug
// critico de hoy: bookingService.createBooking() nunca insertaba en
// reservation_beds, asi que el constraint EXCLUDE nunca llegaba a
// intervenir y dos reservas para la misma cama podian coexistir.

import { pool } from '../../src/config/database';
import { pricingService } from '../../src/services/pricing-service';
import { bookingService, InsufficientAvailabilityError } from '../../src/services/booking-service';

const CHECK_IN = '2028-02-10';
const CHECK_OUT = '2028-02-12';
const ROOM_CODE = 'mixto_7c';

const randomEmail = () => `concurrency-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

afterAll(async () => {
  await pool.end();
});

describe('Concurrencia real: N createBooking() simultaneos por la ultima cama disponible', () => {
  let roomId: string;

  beforeAll(async () => {
    const { rows } = await pool.query(`SELECT id FROM room_types WHERE code = $1`, [ROOM_CODE]);
    roomId = rows[0].id;

    // Limpiar cualquier reserva previa de este rango de fechas (idempotencia entre corridas)
    await pool.query(
      `DELETE FROM reservation_beds rb USING beds b
       WHERE rb.bed_id = b.id AND b.room_type_id = $1
         AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')`,
      [roomId, CHECK_IN, CHECK_OUT]
    );

    // Llenar todas las camas de la habitacion menos 1, para que solo quede
    // una cama en disputa entre los intentos concurrentes.
    const { rows: beds } = await pool.query(
      `SELECT id FROM beds WHERE room_type_id = $1 ORDER BY bed_code`,
      [roomId]
    );
    const bedsToFill = beds.slice(0, beds.length - 1);

    const { rows: guestRows } = await pool.query(
      `INSERT INTO guests (full_name, email) VALUES ('Filler', $1) RETURNING id`,
      [randomEmail()]
    );
    const { rows: channelRows } = await pool.query(`SELECT id FROM channels WHERE code = 'direct'`);
    const { rows: resRows } = await pool.query(
      `INSERT INTO reservations (
         reservation_number, guest_id, channel_id, check_in_date, check_out_date, nights_count, beds_count,
         base_price, season_multiplier, final_price, deposit_percent, deposit_amount, remaining_amount, status
       ) VALUES ($1,$2,$3,$4::date,$5::date,2,$6,60,1,$7,0.3,$7,$7,'confirmed') RETURNING id`,
      [`FILLER-${Date.now()}`, guestRows[0].id, channelRows[0].id, CHECK_IN, CHECK_OUT, bedsToFill.length, 60 * bedsToFill.length * 2]
    );
    for (const b of bedsToFill) {
      await pool.query(
        `INSERT INTO reservation_beds (reservation_id, bed_id, check_in, check_out) VALUES ($1,$2,$3::date,$4::date)`,
        [resRows[0].id, b.id, CHECK_IN, CHECK_OUT]
      );
    }
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM reservation_beds rb USING beds b
       WHERE rb.bed_id = b.id AND b.room_type_id = $1
         AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')`,
      [roomId, CHECK_IN, CHECK_OUT]
    );
  });

  it('de 5 intentos simultaneos por la ultima cama, exactamente 1 gana y los otros 4 fallan con InsufficientAvailabilityError (nunca un crash)', async () => {
    const pricing = await pricingService.calculateTotalPrice({
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      rooms: [{ roomId, bedsCount: 1 }],
      totalBeds: 1
    });

    const attempt = () =>
      bookingService.createBooking({
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
        rooms: [{ roomId, bedsCount: 1 }],
        guest: { full_name: 'Racer', email: randomEmail() },
        nights: 2,
        totalBeds: 1,
        pricing: {
          basePrice: pricing.basePrice,
          seasonMultiplier: pricing.seasonMultiplier,
          groupDiscount: pricing.groupDiscount,
          totalPrice: pricing.totalPrice,
          depositAmount: pricing.depositAmount,
          depositPercent: pricing.depositPercent,
          remainingAmount: pricing.remainingAmount
        }
      });

    const N = 5;
    const outcomes = await Promise.allSettled(Array.from({ length: N }, attempt));

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(N - 1);
    // "fallan de forma manejada": todos los rechazos son InsufficientAvailabilityError, nunca un error generico (crash/500)
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(InsufficientAvailabilityError);
    }

    // Prueba definitiva a nivel de datos: ninguna cama quedo con 2 reservas solapadas.
    const { rows: overlap } = await pool.query(
      `SELECT bed_id, COUNT(*) FROM reservation_beds
       WHERE daterange(check_in, check_out, '[)') && daterange($1::date, $2::date, '[)')
       GROUP BY bed_id HAVING COUNT(*) > 1`,
      [CHECK_IN, CHECK_OUT]
    );
    expect(overlap.length).toBe(0);
  }, 30000);
});
