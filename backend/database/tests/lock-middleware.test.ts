// database/tests/lock-middleware.test.ts
//
// Ventana 2, entregable 10: "Test de lock-middleware: confirmar que el
// patron fuera de una transaccion compartida no protege nada, dejando
// documentado por que withTransaction es obligatorio".
//
// pg_advisory_xact_lock() vive dentro de una transaccion: se libera solo
// cuando esa transaccion termina (COMMIT/ROLLBACK). Si acquireLock() se
// llama con `query()` (autocommit de una sola sentencia, sin BEGIN
// explicito) en vez de con el client de una transaccion activa
// (withTransaction), el lock se toma y se libera en el mismo instante --
// no alcanza a proteger nada de lo que pase despues. Este test simula
// exactamente ese patron incorrecto para probarlo, y lo contrasta con el
// patron correcto que usa booking-service.ts de verdad.

import { pool, withTransaction } from '../../src/config/database';
import { acquireLock } from '../../src/database/lock-middleware';

const CHECK_IN = '2028-03-10';
const CHECK_OUT = '2028-03-11';
const ROOM_CODE = 'mixto_12b';

afterAll(async () => {
  await pool.end();
});

describe('lock-middleware: el lock solo protege dentro de la misma transaccion', () => {
  let bedId: string;
  let channelId: string;

  beforeAll(async () => {
    const { rows: bedRows } = await pool.query(
      `SELECT b.id FROM beds b JOIN room_types rt ON rt.id = b.room_type_id
       WHERE rt.code = $1 ORDER BY b.bed_code LIMIT 1`,
      [ROOM_CODE]
    );
    bedId = bedRows[0].id;
    const { rows: channelRows } = await pool.query(`SELECT id FROM channels WHERE code = 'direct'`);
    channelId = channelRows[0].id;
  });

  afterEach(async () => {
    await pool.query(
      `DELETE FROM reservation_beds WHERE bed_id = $1
         AND daterange(check_in, check_out, '[)') && daterange($2::date, $3::date, '[)')`,
      [bedId, CHECK_IN, CHECK_OUT]
    );
  });

  const insertReservationBed = async (client: { query: (t: string, p?: any[]) => Promise<any> }) => {
    const { rows: guestRows } = await client.query(
      `INSERT INTO guests (full_name, email) VALUES ('Racer', $1) RETURNING id`,
      [`racer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`]
    );
    const { rows: resRows } = await client.query(
      `INSERT INTO reservations (
         reservation_number, guest_id, channel_id, check_in_date, check_out_date, nights_count, beds_count,
         base_price, season_multiplier, final_price, deposit_percent, deposit_amount, remaining_amount, status
       ) VALUES ($1,$2,$3,$4::date,$5::date,1,1,60,1,60,0.3,18,42,'confirmed') RETURNING id`,
      [`R${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`.toUpperCase(), guestRows[0].id, channelId, CHECK_IN, CHECK_OUT]
    );
    await client.query(
      `INSERT INTO reservation_beds (reservation_id, bed_id, check_in, check_out) VALUES ($1,$2,$3::date,$4::date)`,
      [resRows[0].id, bedId, CHECK_IN, CHECK_OUT]
    );
  };

  it('PATRON INCORRECTO: acquireLock() llamado con query() (autocommit, fuera de una transaccion compartida) no evita que 2 intentos concurrentes lleguen ambos al INSERT', async () => {
    const wrongPatternAttempt = async (): Promise<'inserted' | 'rejected'> => {
      // Lock tomado y liberado en su propia sentencia -- ya no protege nada
      // para el momento en que este mismo proceso llega al INSERT.
      await pool.query('SELECT acquire_bed_locks($1::uuid[])', [[bedId]]);
      // Brecha deliberada para exhibir la carrera entre lock y trabajo real.
      await new Promise((r) => setTimeout(r, 30));
      try {
        await insertReservationBed({ query: (t, p) => pool.query(t, p) });
        return 'inserted';
      } catch (err: any) {
        if (err.code === '23505' || err.code === '23P01') return 'rejected';
        throw err;
      }
    };

    const [a, b] = await Promise.all([wrongPatternAttempt(), wrongPatternAttempt()]);
    const results = [a, b];

    // El lock mal usado no coordina nada: la unica razon por la que no
    // termina en overbooking real es que el EXCLUDE constraint (autoridad
    // final) rechaza el segundo INSERT solapado -- no el lock.
    expect(results.filter((r) => r === 'inserted').length).toBe(1);
    expect(results.filter((r) => r === 'rejected').length).toBe(1);

    const { rows: overlap } = await pool.query(
      `SELECT bed_id, COUNT(*) FROM reservation_beds
       WHERE bed_id = $1 AND daterange(check_in, check_out, '[)') && daterange($2::date, $3::date, '[)')
       GROUP BY bed_id HAVING COUNT(*) > 1`,
      [bedId, CHECK_IN, CHECK_OUT]
    );
    expect(overlap.length).toBe(0);
  }, 15000);

  it('PATRON CORRECTO: acquireLock() dentro de withTransaction (mismo client que el INSERT) tambien deja pasar solo 1, via coordinacion real del lock', async () => {
    const correctPatternAttempt = async (): Promise<'inserted' | 'rejected'> => {
      try {
        await withTransaction(async (client) => {
          await acquireLock(client, [bedId]);
          const { rows: existing } = await client.query(
            `SELECT 1 FROM reservation_beds
             WHERE bed_id = $1 AND daterange(check_in, check_out, '[)') && daterange($2::date, $3::date, '[)')`,
            [bedId, CHECK_IN, CHECK_OUT]
          );
          if (existing.length > 0) {
            throw Object.assign(new Error('bed already taken (checked under lock)'), { code: 'ALREADY_TAKEN' });
          }
          await insertReservationBed(client);
        });
        return 'inserted';
      } catch (err: any) {
        if (err.code === '23505' || err.code === '23P01' || err.code === 'ALREADY_TAKEN') return 'rejected';
        throw err;
      }
    };

    const [a, b] = await Promise.all([correctPatternAttempt(), correctPatternAttempt()]);
    const results = [a, b];

    expect(results.filter((r) => r === 'inserted').length).toBe(1);
    expect(results.filter((r) => r === 'rejected').length).toBe(1);
  }, 15000);
});
