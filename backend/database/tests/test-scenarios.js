// test-scenarios.js
// Lapa Casa Hostel - Channel Manager
//
// Los 13 escenarios de prueba de la Ventana 1, corridos contra una base
// Postgres real (no mocks). Cubren la jerarquia anti-overbooking
// completa, el ciclo de vida de reservas directas y OTA, la conversion
// de Flexible 7 por fecha, y la matriz de pricing.
//
// Uso: node database/tests/test-scenarios.js
// (requiere DATABASE_URL apuntando a una base con las migraciones y el
// seed de la Ventana 1 ya aplicados)

const { Pool } = require('pg');
const { Client } = require('pg');
require('dotenv').config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://lapa_dev:lapa_dev_pw@localhost:5432/lapa_casa_hostel';

const pool = new Pool({ connectionString });

const results = [];
let scenarioCounter = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function scenario(name, fn) {
  scenarioCounter += 1;
  const label = `${scenarioCounter}. ${name}`;
  try {
    await fn();
    results.push({ label, passed: true });
    console.log(`  PASS  ${label}`);
  } catch (err) {
    results.push({ label, passed: false, error: err.message });
    console.log(`  FAIL  ${label}`);
    console.log(`        ${err.message}`);
  }
}

// ------------------------------------------------------------
// Helpers de datos de prueba
// ------------------------------------------------------------

async function getChannelId(client, code) {
  const { rows } = await client.query('SELECT id FROM channels WHERE code = $1', [code]);
  return rows[0].id;
}

async function getBedId(client, bedCode) {
  const { rows } = await client.query('SELECT id FROM beds WHERE bed_code = $1', [bedCode]);
  return rows[0].id;
}

async function getRoomTypeId(client, code) {
  const { rows } = await client.query('SELECT id FROM room_types WHERE code = $1', [code]);
  return rows[0].id;
}

async function createGuest(client, email, gender = null) {
  const { rows } = await client.query(
    `INSERT INTO guests (full_name, email, gender) VALUES ($1, $2, $3) RETURNING id`,
    [`Test Guest ${email}`, email, gender]
  );
  return rows[0].id;
}

// Inserta una reserva ya con el precio calculado via las funciones SQL
// (nunca reimplementadas en JS -- REQUISITO CRITICO #6).
async function createReservation(client, opts) {
  const {
    reservationNumber,
    guestId,
    channelId,
    externalReservationId = null,
    guestGender = null,
    checkIn,
    checkOut,
    nights,
    beds,
    roomTypeId,
    status = 'pending_payment',
    pendingExpiresAt = null,
    bookingDate = '2020-01-01', // lejos en el pasado -> sin early bird por defecto, salvo que el escenario lo pida
  } = opts;

  const basePrice = 60;
  const { rows: seasonRows } = await client.query('SELECT calculate_season_multiplier($1) AS m', [checkIn]);
  const seasonMultiplier = Number(seasonRows[0].m);
  const { rows: groupRows } = await client.query('SELECT calculate_group_discount($1, $2) AS d', [roomTypeId, beds]);
  const groupDiscount = Number(groupRows[0].d);
  const { rows: ebRows } = await client.query('SELECT calculate_early_bird_discount($1, $2) AS d', [bookingDate, checkIn]);
  const earlyBirdDiscount = Number(ebRows[0].d);
  const { rows: priceRows } = await client.query(
    'SELECT calculate_final_price($1, $2, $3, $4, $5, $6) AS p',
    [roomTypeId, basePrice, nights, beds, checkIn, bookingDate]
  );
  const finalPrice = Number(priceRows[0].p);
  const { rows: depositRows } = await client.query('SELECT * FROM calculate_deposit($1, $2)', [finalPrice, beds]);
  const { deposit_percent: depositPercent, deposit_amount: depositAmount, remaining_amount: remainingAmount } = depositRows[0];

  const { rows } = await client.query(
    `INSERT INTO reservations (
      reservation_number, guest_id, channel_id, external_reservation_id, guest_gender,
      check_in_date, check_out_date, nights_count, beds_count,
      base_price, season_multiplier, group_discount, early_bird_discount, final_price,
      deposit_percent, deposit_amount, remaining_amount, status, pending_expires_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING id`,
    [
      reservationNumber, guestId, channelId, externalReservationId, guestGender,
      checkIn, checkOut, nights, beds,
      basePrice, seasonMultiplier, groupDiscount, earlyBirdDiscount, finalPrice,
      depositPercent, depositAmount, remainingAmount, status, pendingExpiresAt,
    ]
  );
  return { id: rows[0].id, finalPrice, depositAmount, remainingAmount, depositPercent };
}

async function assignBed(client, reservationId, bedId, checkIn, checkOut) {
  await client.query(
    `INSERT INTO reservation_beds (reservation_id, bed_id, check_in, check_out) VALUES ($1,$2,$3,$4)`,
    [reservationId, bedId, checkIn, checkOut]
  );
}

// ------------------------------------------------------------
// Escenario 1: reserva directa feliz, precio y deposito correctos
// ------------------------------------------------------------
async function testHappyPath(client) {
  const guestId = await createGuest(client, 'sc1@test.lapacasahostel.internal', 'mixed');
  const channelId = await getChannelId(client, 'direct');
  const bedId = await getBedId(client, 'C1');
  const roomTypeId = await getRoomTypeId(client, 'mixto_7');

  const r = await createReservation(client, {
    reservationNumber: 'LCH-SC1-0001',
    guestId,
    channelId,
    checkIn: '2027-07-10',
    checkOut: '2027-07-12',
    nights: 2,
    beds: 1,
    roomTypeId,
    bookingDate: '2027-07-01', // 9 dias antes -> sin early bird, para aislar el efecto de la temporada
    pendingExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  await assignBed(client, r.id, bedId, '2027-07-10', '2027-07-12');

  // baja temporada (jul) -> 0.8x, sin descuento de grupo (1 cama), sin early bird (reserva a 9 dias)
  assert(Math.abs(r.finalPrice - 60 * 2 * 0.8) < 0.01, `precio final esperado 96.00, obtuvo ${r.finalPrice}`);
  assert(Math.abs(r.depositAmount - r.finalPrice * 0.3) < 0.01, 'deposito deberia ser 30% para grupo chico');

  const { rows } = await client.query('SELECT status, pending_expires_at FROM reservations WHERE id = $1', [r.id]);
  assert(rows[0].status === 'pending_payment', 'status inicial deberia ser pending_payment');
  assert(rows[0].pending_expires_at !== null, 'reserva directa debe tener pending_expires_at');
}

// ------------------------------------------------------------
// Escenario 2: concurrencia real -- 2 conexiones compiten por la unica
// cama de una habitacion de prueba aislada. Solo una debe ganar.
// ------------------------------------------------------------
async function testRealConcurrency(client) {
  await client.query(`INSERT INTO room_types (code, name, capacity, default_gender, is_flexible, base_price)
    VALUES ('test_conc', 'Test Concurrencia', 1, 'mixed', false, 60) ON CONFLICT (code) DO NOTHING`);
  const roomTypeId = await getRoomTypeId(client, 'test_conc');
  await client.query(`INSERT INTO beds (room_type_id, bed_code) VALUES ($1, 'TC1') ON CONFLICT (bed_code) DO NOTHING`, [roomTypeId]);
  const bedId = await getBedId(client, 'TC1');
  const channelId = await getChannelId(client, 'direct');

  const guestA = await createGuest(client, 'sc2-a@test.lapacasahostel.internal', 'mixed');
  const guestB = await createGuest(client, 'sc2-b@test.lapacasahostel.internal', 'mixed');

  const checkIn = '2027-09-01';
  const checkOut = '2027-09-03';

  // Simula exactamente el patron de Ventana 2: BEGIN; acquire_bed_locks;
  // check_availability; INSERT; COMMIT -- todo en la MISMA conexion/transaccion.
  async function attemptBooking(guestId, reservationNumber) {
    const c = new Client({ connectionString });
    await c.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT acquire_bed_locks($1::uuid[])', [[bedId]]);
      const { rows } = await c.query(
        `SELECT is_available FROM check_availability($1, $2, 'mixed') WHERE bed_id = $3`,
        [checkIn, checkOut, bedId]
      );
      if (!rows[0] || !rows[0].is_available) {
        await c.query('ROLLBACK');
        return { ok: false, reason: 'not_available' };
      }
      await c.query(
        `INSERT INTO reservations (
          reservation_number, guest_id, channel_id, check_in_date, check_out_date,
          nights_count, beds_count, base_price, season_multiplier, final_price,
          deposit_percent, deposit_amount, remaining_amount, status
        ) VALUES ($1,$2,$3,$4,$5,2,1,60,0.8,96,0.3,28.8,67.2,'pending_payment') RETURNING id`,
        [reservationNumber, guestId, channelId, checkIn, checkOut]
      );
      const resId = (await c.query('SELECT id FROM reservations WHERE reservation_number = $1', [reservationNumber])).rows[0].id;
      await c.query(
        `INSERT INTO reservation_beds (reservation_id, bed_id, check_in, check_out) VALUES ($1,$2,$3,$4)`,
        [resId, bedId, checkIn, checkOut]
      );
      await c.query('COMMIT');
      return { ok: true };
    } catch (err) {
      await c.query('ROLLBACK').catch(() => {});
      return { ok: false, reason: err.message };
    } finally {
      await c.end();
    }
  }

  const [resA, resB] = await Promise.all([
    attemptBooking(guestA, 'LCH-SC2-A'),
    attemptBooking(guestB, 'LCH-SC2-B'),
  ]);

  const successes = [resA, resB].filter((r) => r.ok).length;
  assert(successes === 1, `exactamente 1 de las 2 reservas concurrentes deberia ganar la cama, ganaron ${successes}`);
}

// ------------------------------------------------------------
// Escenario 3: el EXCLUDE constraint es la autoridad final incluso con
// el trigger de aplicacion deshabilitado.
// ------------------------------------------------------------
async function testExcludeIsFinalAuthority(client) {
  const guestId = await createGuest(client, 'sc3@test.lapacasahostel.internal', 'mixed');
  const channelId = await getChannelId(client, 'direct');
  const bedId = await getBedId(client, 'C2');
  const roomTypeId = await getRoomTypeId(client, 'mixto_7');

  const r1 = await createReservation(client, {
    reservationNumber: 'LCH-SC3-0001', guestId, channelId,
    checkIn: '2027-07-15', checkOut: '2027-07-17', nights: 2, beds: 1, roomTypeId,
    status: 'confirmed',
  });
  await assignBed(client, r1.id, bedId, '2027-07-15', '2027-07-17');

  await client.query('ALTER TABLE reservation_beds DISABLE TRIGGER trg_prevent_overbooking');
  let excludeCaught = false;
  try {
    const r2 = await createReservation(client, {
      reservationNumber: 'LCH-SC3-0002', guestId, channelId,
      checkIn: '2027-07-16', checkOut: '2027-07-18', nights: 2, beds: 1, roomTypeId,
      status: 'confirmed',
    });
    await assignBed(client, r2.id, bedId, '2027-07-16', '2027-07-18');
  } catch (err) {
    excludeCaught = err.message.includes('exclusion constraint');
  } finally {
    await client.query('ALTER TABLE reservation_beds ENABLE TRIGGER trg_prevent_overbooking');
  }

  assert(excludeCaught, 'el EXCLUDE constraint deberia rechazar el overlap aunque el trigger este deshabilitado');
}

// ------------------------------------------------------------
// Escenario 4: OTA con webhook (Booking.com) -> confirmed inmediato, sin timeout
// ------------------------------------------------------------
async function testOtaWebhookChannel(client) {
  const guestId = await createGuest(client, 'sc4@test.lapacasahostel.internal', 'mixed');
  const channelId = await getChannelId(client, 'booking');
  const bedId = await getBedId(client, 'C3');
  const roomTypeId = await getRoomTypeId(client, 'mixto_7');

  const r = await createReservation(client, {
    reservationNumber: 'LCH-SC4-0001', guestId, channelId,
    externalReservationId: 'BOOKING-EXT-0001',
    checkIn: '2027-07-20', checkOut: '2027-07-22', nights: 2, beds: 1, roomTypeId,
    status: 'confirmed', pendingExpiresAt: null,
  });
  await assignBed(client, r.id, bedId, '2027-07-20', '2027-07-22');

  const { rows } = await client.query('SELECT status, pending_expires_at FROM reservations WHERE id = $1', [r.id]);
  assert(rows[0].status === 'confirmed', 'reserva OTA con webhook deberia entrar confirmed');
  assert(rows[0].pending_expires_at === null, 'reserva OTA no deberia tener timeout de 15 min');

  const { rows: occ } = await client.query(
    `SELECT is_available FROM check_availability('2027-07-20','2027-07-22','mixed') WHERE bed_id = $1`, [bedId]
  );
  assert(occ[0].is_available === false, 'la cama debe quedar bloqueada de inmediato');
}

// ------------------------------------------------------------
// Escenario 5: OTA solo iCal (Hostelworld/Airbnb) -> pending_ota_confirmation,
// pero igual bloquea la cama de inmediato (verificacion atomica).
// ------------------------------------------------------------
async function testOtaIcalOnlyChannel(client) {
  const guestId = await createGuest(client, 'sc5@test.lapacasahostel.internal', 'mixed');
  const channelId = await getChannelId(client, 'hostelworld');
  const bedId = await getBedId(client, 'C4');
  const roomTypeId = await getRoomTypeId(client, 'mixto_7');

  const r = await createReservation(client, {
    reservationNumber: 'LCH-SC5-0001', guestId, channelId,
    externalReservationId: 'HW-EXT-0001',
    checkIn: '2027-07-25', checkOut: '2027-07-27', nights: 2, beds: 1, roomTypeId,
    status: 'pending_ota_confirmation', pendingExpiresAt: null,
  });
  await assignBed(client, r.id, bedId, '2027-07-25', '2027-07-27');

  const { rows } = await client.query('SELECT status FROM reservations WHERE id = $1', [r.id]);
  assert(rows[0].status === 'pending_ota_confirmation', 'reserva iCal-only deberia entrar pending_ota_confirmation');

  const { rows: occ } = await client.query(
    `SELECT is_available FROM check_availability('2027-07-25','2027-07-27','mixed') WHERE bed_id = $1`, [bedId]
  );
  assert(occ[0].is_available === false, 'la cama debe quedar bloqueada de inmediato aunque no este verificada aun');
}

// ------------------------------------------------------------
// Escenario 6: sp_cleanup_expired_pending cancela y libera camas
// ------------------------------------------------------------
async function testExpiredPendingCleanup(client) {
  const guestId = await createGuest(client, 'sc6@test.lapacasahostel.internal', 'mixed');
  const channelId = await getChannelId(client, 'direct');
  const bedId = await getBedId(client, 'C5');
  const roomTypeId = await getRoomTypeId(client, 'mixto_7');

  const r = await createReservation(client, {
    reservationNumber: 'LCH-SC6-0001', guestId, channelId,
    checkIn: '2027-08-01', checkOut: '2027-08-03', nights: 2, beds: 1, roomTypeId,
    status: 'pending_payment',
    pendingExpiresAt: new Date(Date.now() - 60 * 1000), // vencido hace 1 minuto
  });
  await assignBed(client, r.id, bedId, '2027-08-01', '2027-08-03');

  await client.query('CALL sp_cleanup_expired_pending()');

  const { rows } = await client.query('SELECT status FROM reservations WHERE id = $1', [r.id]);
  assert(rows[0].status === 'cancelled', `deberia estar cancelled, esta ${rows[0].status}`);

  const { rows: beds } = await client.query('SELECT count(*)::int AS n FROM reservation_beds WHERE reservation_id = $1', [r.id]);
  assert(beds[0].n === 0, 'la cama deberia haberse liberado (reservation_beds sin filas)');

  const { rows: occ } = await client.query(
    `SELECT is_available FROM check_availability('2027-08-01','2027-08-03','mixed') WHERE bed_id = $1`, [bedId]
  );
  assert(occ[0].is_available === true, 'la cama deberia volver a estar disponible');
}

// ------------------------------------------------------------
// Escenario 7: las reservas OTA NO expiran (pending_expires_at NULL),
// aunque sean "viejas", sp_cleanup_expired_pending no las toca.
// ------------------------------------------------------------
async function testOtaExemptFromTimeout(client) {
  const guestId = await createGuest(client, 'sc7@test.lapacasahostel.internal', 'mixed');
  const channelId = await getChannelId(client, 'airbnb');
  const bedId = await getBedId(client, 'C6');
  const roomTypeId = await getRoomTypeId(client, 'mixto_7');

  const r = await createReservation(client, {
    reservationNumber: 'LCH-SC7-0001', guestId, channelId,
    externalReservationId: 'ABB-EXT-0001',
    checkIn: '2027-08-05', checkOut: '2027-08-07', nights: 2, beds: 1, roomTypeId,
    status: 'pending_ota_confirmation', pendingExpiresAt: null,
  });
  await assignBed(client, r.id, bedId, '2027-08-05', '2027-08-07');

  await client.query('CALL sp_cleanup_expired_pending()');

  const { rows } = await client.query('SELECT status FROM reservations WHERE id = $1', [r.id]);
  assert(rows[0].status === 'pending_ota_confirmation', 'la reserva OTA no deberia haber sido tocada por el timeout de 15 min');
}

// ------------------------------------------------------------
// Escenario 8: sp_release_no_show marca no_show y libera la cama
// ------------------------------------------------------------
async function testNoShowRelease(client) {
  const guestId = await createGuest(client, 'sc8@test.lapacasahostel.internal', 'mixed');
  const channelId = await getChannelId(client, 'direct');
  const bedId = await getBedId(client, 'C7');
  const roomTypeId = await getRoomTypeId(client, 'mixto_7');

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 2);
  const checkInPast = yesterday.toISOString().slice(0, 10);
  const checkOutPast = new Date(yesterday.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const r = await createReservation(client, {
    reservationNumber: 'LCH-SC8-0001', guestId, channelId,
    checkIn: checkInPast, checkOut: checkOutPast, nights: 2, beds: 1, roomTypeId,
    status: 'confirmed',
  });
  await assignBed(client, r.id, bedId, checkInPast, checkOutPast);

  await client.query('CALL sp_release_no_show()');

  const { rows } = await client.query('SELECT status FROM reservations WHERE id = $1', [r.id]);
  assert(rows[0].status === 'no_show', `deberia estar no_show, esta ${rows[0].status}`);

  const { rows: beds } = await client.query('SELECT count(*)::int AS n FROM reservation_beds WHERE reservation_id = $1', [r.id]);
  assert(beds[0].n === 0, 'la cama deberia haberse liberado tras el no_show');
}

// ------------------------------------------------------------
// Escenarios 9-11: conversion de Flexible 7 por fecha especifica
// ------------------------------------------------------------
async function testFlexibleConversion(client) {
  const { rows: today } = await client.query(`SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d`);
  const brtToday = today[0].d;
  const addDays = (d, n) => {
    const dt = new Date(d);
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  const dateA = addDays(brtToday, 1); // dentro de ventana 48h, sin reserva femenina -> deberia convertir
  const dateB = addDays(brtToday, 2); // dentro de ventana 48h, CON reserva femenina -> NO deberia convertir
  const dateC = addDays(brtToday, 3); // fuera de ventana -> no se evalua todavia

  const flexRoomId = await getRoomTypeId(client, 'flexible_7');
  const bedF2 = await getBedId(client, 'F2'); // F1 se deja libre para no interferir con otros escenarios que puedan correr en paralelo

  const guestId = await createGuest(client, 'sc9-10-11@test.lapacasahostel.internal', 'female');
  const channelId = await getChannelId(client, 'direct');
  const rB = await createReservation(client, {
    reservationNumber: 'LCH-SC10-0001', guestId, channelId, guestGender: 'female',
    checkIn: dateB, checkOut: addDays(dateB, 2), nights: 2, beds: 1, roomTypeId: flexRoomId, status: 'confirmed',
  });
  await assignBed(client, rB.id, bedF2, dateB, addDays(dateB, 2));

  await scenario('Flexible 7 se convierte a mixto sin reservas femeninas dentro de la ventana de 48h', async () => {
    const before = await client.query('SELECT * FROM get_flexible_room_status($1, $2)', [flexRoomId, dateA]);
    assert(before.rows[0].is_converted === false, 'antes de correr el proceso, la fecha A no deberia estar convertida aun');

    await client.query('CALL sp_process_flexible_conversion()');

    const after = await client.query('SELECT * FROM get_flexible_room_status($1, $2)', [flexRoomId, dateA]);
    assert(after.rows[0].is_converted === true, 'fecha A deberia quedar convertida a mixto');
    assert(after.rows[0].effective_gender === 'mixed', 'genero efectivo de fecha A deberia ser mixed');
  });

  await scenario('Flexible 7 permanece femenino cuando hay una reserva femenina dentro de la ventana', async () => {
    const status = await client.query('SELECT * FROM get_flexible_room_status($1, $2)', [flexRoomId, dateB]);
    assert(status.rows[0].is_converted === false, 'fecha B NO deberia haberse convertido (hay reserva femenina)');
    assert(status.rows[0].effective_gender === 'female', 'fecha B deberia seguir femenina');
  });

  await scenario('La conversion es por fecha especifica: fecha fuera de ventana no se ve afectada, y el proceso es idempotente', async () => {
    const statusC = await client.query('SELECT * FROM get_flexible_room_status($1, $2)', [flexRoomId, dateC]);
    assert(statusC.rows[0].is_converted === false, 'fecha C (fuera de ventana) no deberia haberse evaluado todavia');

    const before = await client.query('SELECT count(*)::int AS n FROM room_conversion_logs WHERE room_type_id = $1', [flexRoomId]);
    await client.query('CALL sp_process_flexible_conversion()');
    const afterRerun = await client.query('SELECT count(*)::int AS n FROM room_conversion_logs WHERE room_type_id = $1', [flexRoomId]);
    assert(before.rows[0].n === afterRerun.rows[0].n, 'volver a correr el proceso no deberia duplicar conversiones (irreversibilidad + idempotencia)');
  });

  // limpieza especifica de este bloque (fechas sinteticas relativas a "hoy")
  await client.query('DELETE FROM reservations WHERE reservation_number = $1', ['LCH-SC10-0001']);
  await client.query('DELETE FROM room_conversion_logs WHERE room_type_id = $1 AND target_date IN ($2,$3,$4)', [flexRoomId, dateA, dateB, dateC]);
}

// ------------------------------------------------------------
// Escenario 12: matriz de precios (temporada x grupo x early bird),
// y la comision de canal jamas afecta el precio del huesped.
// ------------------------------------------------------------
async function testPricingMatrix(client) {
  // El descuento por grupo es por cuarto (room_types.group_discount_min_beds/
  // percentage, ver 0009_room_group_discount.sql) -- se lee de la tabla real,
  // nunca se hardcodea un tramo aca (Requisito Critico #6).
  const roomTypeId = await getRoomTypeId(client, 'mixto_12a');
  const { rows: roomRows } = await client.query(
    'SELECT group_discount_min_beds, group_discount_percentage FROM room_types WHERE id = $1',
    [roomTypeId]
  );
  const minBeds = roomRows[0].group_discount_min_beds;
  const pct = Number(roomRows[0].group_discount_percentage);

  const cases = [
    // [checkIn, bookingDate, beds, nights, temporada esperada, multiplicador, early bird] -- descuento de grupo se calcula segun minBeds/pct del cuarto
    { checkIn: '2027-01-15', bookingDate: '2026-12-01', beds: minBeds - 1, nights: 3, multiplier: 1.5, earlyBird: 0.05 },
    { checkIn: '2027-07-15', bookingDate: '2027-07-01', beds: minBeds, nights: 2, multiplier: 0.8, earlyBird: 0.00 },
    { checkIn: '2027-04-15', bookingDate: '2027-03-01', beds: minBeds + 2, nights: 2, multiplier: 1.0, earlyBird: 0.05 },
    // 2027-02-08 cae dentro del rango de Carnaval sembrado en system_config (2027-02-06 a 2027-02-10)
    { checkIn: '2027-02-08', bookingDate: '2027-01-01', beds: 12, nights: 5, multiplier: 2.0, earlyBird: 0.05 },
  ];

  for (const c of cases) {
    const groupDiscount = c.beds >= minBeds ? pct : 0;
    const { rows } = await client.query(
      'SELECT calculate_final_price($1,$2,$3,$4,$5,$6) AS p',
      [roomTypeId, 60, c.nights, c.beds, c.checkIn, c.bookingDate]
    );
    const expected = 60 * c.nights * c.beds * c.multiplier * (1 - groupDiscount) * (1 - c.earlyBird);
    const actual = Number(rows[0].p);
    assert(
      Math.abs(actual - expected) < 0.01,
      `pricing para checkIn=${c.checkIn} beds=${c.beds}: esperado ${expected.toFixed(2)}, obtuvo ${actual}`
    );
  }

  // La comision de canal es independiente del precio del huesped
  const { rows: priceRows } = await client.query(
    'SELECT calculate_final_price($1,$2,$3,$4,$5,$6) AS p',
    [roomTypeId, 60, 2, 7, '2027-06-01', '2027-05-01']
  );
  const guestPrice = Number(priceRows[0].p);

  const { rows: channelRows } = await client.query('SELECT id, code, commission_rate FROM channels');
  for (const ch of channelRows) {
    const { rows: netRows } = await client.query('SELECT calculate_channel_net_revenue($1, $2) AS net', [guestPrice, ch.id]);
    const net = Number(netRows[0].net);
    const expectedNet = guestPrice * (1 - Number(ch.commission_rate));
    assert(Math.abs(net - expectedNet) < 0.01, `revenue neto de canal ${ch.code} incorrecto`);
    assert(net <= guestPrice, `el ingreso neto del canal ${ch.code} nunca deberia superar el precio del huesped`);
  }
  // Verificar explicitamente que guestPrice no depende del canal: recalcular con otro "canal" hipotetico
  // no cambia nada porque calculate_final_price no recibe channel_id como parametro.
}

// ------------------------------------------------------------
// Escenario 13: depositos 30%/50% segun tamano de grupo
// ------------------------------------------------------------
async function testDepositTiers(client) {
  const cases = [
    { beds: 1, total: 100, expectedPercent: 0.30 },
    { beds: 14, total: 1000, expectedPercent: 0.30 },
    { beds: 15, total: 1000, expectedPercent: 0.50 },
    { beds: 40, total: 5000, expectedPercent: 0.50 },
  ];
  for (const c of cases) {
    const { rows } = await client.query('SELECT * FROM calculate_deposit($1, $2)', [c.total, c.beds]);
    const row = rows[0];
    assert(Number(row.deposit_percent) === c.expectedPercent, `beds=${c.beds}: deposit_percent esperado ${c.expectedPercent}, obtuvo ${row.deposit_percent}`);
    assert(Math.abs(Number(row.deposit_amount) - c.total * c.expectedPercent) < 0.01, `beds=${c.beds}: deposit_amount incorrecto`);
    assert(
      Math.abs(Number(row.deposit_amount) + Number(row.remaining_amount) - c.total) < 0.01,
      `beds=${c.beds}: deposito + saldo deberia ser igual al total`
    );
  }
}

// ------------------------------------------------------------
// Limpieza de todos los datos sinteticos creados por esta suite
// ------------------------------------------------------------
async function cleanup(client) {
  // audit_logs.reservation_id -> RESTRICT (a proposito, ver Maestro): hay que
  // borrar primero el rastro de auditoria generado por sp_cleanup_expired_pending
  // y sp_release_no_show en los escenarios 6 y 8 antes de poder borrar la reserva.
  await client.query(`DELETE FROM audit_logs WHERE reservation_id IN (SELECT id FROM reservations WHERE reservation_number LIKE 'LCH-SC%')`);
  await client.query(`DELETE FROM reservations WHERE reservation_number LIKE 'LCH-SC%'`);
  await client.query(`DELETE FROM guests WHERE email LIKE '%@test.lapacasahostel.internal'`);
  await client.query(`DELETE FROM reservation_beds WHERE bed_id IN (SELECT id FROM beds WHERE bed_code = 'TC1')`);
  await client.query(`DELETE FROM beds WHERE bed_code = 'TC1'`);
  await client.query(`DELETE FROM room_types WHERE code = 'test_conc'`);
}

async function main() {
  const client = await pool.connect();
  try {
    await cleanup(client); // por si quedo basura de una corrida anterior interrumpida

    await scenario('Reserva directa feliz: precio y deposito calculados via funciones SQL', () => testHappyPath(client));
    await scenario('Concurrencia real: 2 conexiones compiten por la ultima cama, solo 1 gana', () => testRealConcurrency(client));
    await scenario('El EXCLUDE constraint es la autoridad final (bypass del trigger)', () => testExcludeIsFinalAuthority(client));
    await scenario('OTA con webhook (Booking.com) entra confirmed sin timeout', () => testOtaWebhookChannel(client));
    await scenario('OTA solo iCal (Hostelworld) entra pending_ota_confirmation y bloquea camas', () => testOtaIcalOnlyChannel(client));
    await scenario('sp_cleanup_expired_pending cancela y libera camas tras 15 min', () => testExpiredPendingCleanup(client));
    await scenario('Reservas OTA estan exentas del timeout de 15 min', () => testOtaExemptFromTimeout(client));
    await scenario('sp_release_no_show marca no_show y libera camas a las 23:59', () => testNoShowRelease(client));
    await testFlexibleConversion(client); // agrega los escenarios 9, 10 y 11 internamente
    await scenario('Matriz de precios: temporada x grupo x early bird, comision de canal independiente', () => testPricingMatrix(client));
    await scenario('Depositos: 30% estandar vs 50% para grupos de 15+ camas', () => testDepositTiers(client));

    await cleanup(client);
  } finally {
    client.release();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} escenarios pasaron.`);
  if (failed > 0) {
    console.log(`${failed} fallaron:`);
    results.filter((r) => !r.passed).forEach((r) => console.log(`  - ${r.label}: ${r.error}`));
  }

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Error inesperado corriendo la suite de tests:', err);
  process.exit(1);
});
