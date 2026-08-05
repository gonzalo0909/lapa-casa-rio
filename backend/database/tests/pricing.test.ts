// database/tests/pricing.test.ts
//
// Ventana 2, entregable 10: "Test de precios: matriz temporada x grupo x
// early bird, comparado bit a bit contra invocar la funcion SQL
// directamente". pricingService es un wrapper delgado sobre las
// funciones SQL de Ventana 1 (Requisito Critico #6) -- si algun metodo
// alguna vez reimplementara la regla en JS en vez de llamar a la
// funcion, este test lo detecta por divergencia numerica.

import { pool } from '../../src/config/database';
import { pricingService } from '../../src/services/pricing-service';

afterAll(async () => {
  await pool.end();
});

describe('pricingService: wrapper delgado sobre las funciones SQL (bit a bit)', () => {
  // Una fecha por estacion, lejos de hoy para no interferir con reservas reales.
  const seasonDates = ['2028-01-15', '2028-04-15', '2028-07-15', '2028-11-15'];
  const bedCounts = [3, 10, 20];

  it.each(seasonDates)('calculateGroupDiscount coincide con calculate_group_discount() SQL para cada tramo de camas (fecha de referencia %s no afecta esta funcion)', async () => {
    for (const beds of bedCounts) {
      const service = await pricingService.calculateGroupDiscount(beds);
      const { rows } = await pool.query(`SELECT calculate_group_discount($1) AS d`, [beds]);
      expect(service.discount).toBe(parseFloat(rows[0].d));
    }
  });

  it.each(seasonDates)('calculateFinalPrice(%s) coincide con calculate_final_price() SQL', async (checkIn) => {
    const checkOut = new Date(new Date(checkIn).getTime() + 3 * 86400000).toISOString().slice(0, 10);
    for (const beds of bedCounts) {
      const nights = 3;
      const basePrice = 60;
      const bookingDate = new Date().toISOString().slice(0, 10);

      const service = await pricingService.calculateFinalPrice(checkIn, checkOut, beds);
      const { rows } = await pool.query(
        `SELECT calculate_final_price($1::numeric, $2, $3, $4::date, $5::date) AS p`,
        [basePrice, nights, beds, checkIn, bookingDate]
      );
      expect(service.totalPrice).toBe(parseFloat(rows[0].p));
    }
  });

  it.each([
    [900, 3],
    [3000, 10],
    [9000, 20]
  ])('calculateDeposit(%d, %d camas) coincide con calculate_deposit() SQL', async (totalPrice, beds) => {
    const service = await pricingService.calculateDeposit(totalPrice, beds);
    const { rows } = await pool.query(`SELECT * FROM calculate_deposit($1::numeric, $2)`, [totalPrice, beds]);
    expect(service.amount).toBe(parseFloat(rows[0].deposit_amount));
    expect(service.percent).toBe(parseFloat(rows[0].deposit_percent));
    expect(service.remaining).toBe(parseFloat(rows[0].remaining_amount));
  });

  it('determineSeason coincide con get_season_type()/calculate_season_multiplier()/get_min_nights() SQL para cada fecha de referencia', async () => {
    for (const date of seasonDates) {
      const service = await pricingService.determineSeason(date, date);
      const { rows: typeRows } = await pool.query(`SELECT get_season_type($1::date) AS t`, [date]);
      const { rows: multRows } = await pool.query(`SELECT calculate_season_multiplier($1::date) AS m`, [date]);
      const { rows: minRows } = await pool.query(`SELECT get_min_nights($1::date) AS n`, [date]);
      expect(service.type).toBe(typeRows[0].t);
      expect(service.multiplier).toBe(parseFloat(multRows[0].m));
      expect(service.minNights).toBe(minRows[0].n);
    }
  });

  it('early bird: calculateTotalPrice() incorpora calculate_early_bird_discount() de forma consistente con una llamada SQL directa', async () => {
    const { rows: roomRows } = await pool.query(`SELECT id, base_price FROM room_types WHERE code = 'mixto_7'`);
    const roomId = roomRows[0].id;
    const checkIn = '2028-09-20';
    const checkOut = '2028-09-22';
    const bookingDate = new Date().toISOString().slice(0, 10);

    const { rows: earlyBirdRows } = await pool.query(
      `SELECT calculate_early_bird_discount($1::date, $2::date) AS d`,
      [bookingDate, checkIn]
    );
    expect(Number.isFinite(parseFloat(earlyBirdRows[0].d))).toBe(true);

    // calculateTotalPrice no expone el early bird aislado en su firma actual,
    // pero el total debe seguir coincidiendo con la funcion SQL de precio final
    // para la misma combinacion -- confirma que no hay una segunda formula en JS.
    const result = await pricingService.calculateTotalPrice({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      rooms: [{ roomId, bedsCount: 2 }],
      totalBeds: 2
    });
    const { rows: sqlRows } = await pool.query(
      `SELECT calculate_final_price($1::numeric, 2, 2, $2::date, $3::date) AS p`,
      [roomRows[0].base_price, checkIn, bookingDate]
    );
    expect(result.totalPrice).toBe(parseFloat(sqlRows[0].p));
  });
});
