// database/tests/cancel-release.test.ts
//
// Ventana 2, entregable 10: "Test de liberacion automatica al cancelar
// (confirmar que no hace falta codigo Node adicional, el trigger ya lo
// resuelve)". bookingService.cancelBooking() delega en el repositorio,
// que solo cambia `status` -- la fila de reservation_beds la borra
// trg_release_beds_on_status_change, nunca un DELETE manual desde Node.

import { pool } from '../../src/config/database';
import { pricingService } from '../../src/services/pricing-service';
import { bookingService } from '../../src/services/booking-service';

const CHECK_IN = '2028-04-05';
const CHECK_OUT = '2028-04-07';
const ROOM_CODE = 'mixto_12a';

const randomEmail = () => `cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

afterAll(async () => {
  await pool.end();
});

describe('cancelBooking: trg_release_beds_on_status_change libera las camas sin codigo Node adicional', () => {
  let roomId: string;

  beforeAll(async () => {
    const { rows } = await pool.query(`SELECT id FROM room_types WHERE code = $1`, [ROOM_CODE]);
    roomId = rows[0].id;
    await pool.query(
      `DELETE FROM reservation_beds rb USING beds b
       WHERE rb.bed_id = b.id AND b.room_type_id = $1
         AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')`,
      [roomId, CHECK_IN, CHECK_OUT]
    );
  });

  it('crear -> cancelar deja reservation_beds en 0 filas y la reserva en status cancelled', async () => {
    const pricing = await pricingService.calculateTotalPrice({
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      rooms: [{ roomId, bedsCount: 2 }],
      totalBeds: 2
    });

    const booking = await bookingService.createBooking({
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      rooms: [{ roomId, bedsCount: 2 }],
      guest: { full_name: 'Cancel Me', email: randomEmail() },
      nights: 2,
      totalBeds: 2,
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

    const { rows: beforeCancel } = await pool.query(
      `SELECT COUNT(*) FROM reservation_beds WHERE reservation_id = $1`,
      [booking.id]
    );
    expect(parseInt(beforeCancel[0].count, 10)).toBe(2);

    const cancelled = await bookingService.cancelBooking(booking.id, 'test suite');
    expect(cancelled.status).toBe('cancelled');

    const { rows: afterCancel } = await pool.query(
      `SELECT COUNT(*) FROM reservation_beds WHERE reservation_id = $1`,
      [booking.id]
    );
    expect(parseInt(afterCancel[0].count, 10)).toBe(0);
  });

  it('las camas liberadas por la cancelacion vuelven a estar disponibles para una nueva reserva en las mismas fechas', async () => {
    const pricing = await pricingService.calculateTotalPrice({
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      rooms: [{ roomId, bedsCount: 2 }],
      totalBeds: 2
    });

    // Reserva y cancelacion previas ya liberaron 2 camas de mixto_12a en este rango.
    // Una reserva nueva para las mismas fechas y la misma cantidad debe poder crearse sin error.
    const booking = await bookingService.createBooking({
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      rooms: [{ roomId, bedsCount: 2 }],
      guest: { full_name: 'Second Guest', email: randomEmail() },
      nights: 2,
      totalBeds: 2,
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
    expect(booking.bedIds.length).toBe(2);

    await bookingService.cancelBooking(booking.id, 'cleanup');
  });
});
