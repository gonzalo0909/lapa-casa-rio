// seed.js
// Lapa Casa Hostel - Channel Manager
//
// Aplica, en orden, los archivos .sql de database/seeds/ que aun no
// figuren en la tabla schema_seeds -- mismo patron que migrate.js con
// schema_migrations, en vez de un guard unico "room_types no vacia ->
// saltar todo". Ese guard anterior asumia que room_types solo se llenaba
// via este script: en produccion (Supabase) ya tenia las 5 room_types
// del hostel cargadas a mano desde antes de que este script existiera
// (mismo caso que PRE_EXISTING_MIGRATIONS en migrate.js), asi que el
// guard veia esas filas, asumia "ya sembrado" y NUNCA corria
// 0002_seed_apartments.sql -- los 10 apartamentos jamas se insertaron.
//
// Uso: node database/scripts/seed.js

const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const SEEDS_DIR = path.join(__dirname, '..', 'seeds');

// 0001_seed.sql no tiene ON CONFLICT DO NOTHING (a diferencia de
// 0002_seed_apartments.sql) -- si room_types ya tiene filas al arrancar,
// se asume que 0001 ya se aplico (a mano, en su momento) y se marca como
// tal sin volver a correrlo.
const PRE_EXISTING_SEEDS = ['0001_seed.sql'];

async function ensureSeedsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_seeds (
      id          SERIAL PRIMARY KEY,
      filename    TEXT UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await client.query('SELECT count(*)::int AS n FROM schema_seeds');
  if (rows[0].n > 0) return;

  const { rows: roomTypeRows } = await client.query('SELECT count(*)::int AS n FROM room_types');
  if (roomTypeRows[0].n === 0) return;

  for (const filename of PRE_EXISTING_SEEDS) {
    await client.query(
      'INSERT INTO schema_seeds (filename) VALUES ($1) ON CONFLICT DO NOTHING',
      [filename]
    );
    console.log(`  bootstrap  ${filename} (datos ya existian, marcado como aplicado)`);
  }
}

async function getAppliedSeeds(client) {
  const { rows } = await client.query('SELECT filename FROM schema_seeds');
  return new Set(rows.map((r) => r.filename));
}

async function runSeeds() {
  const client = await pool.connect();
  try {
    await ensureSeedsTable(client);
    const applied = await getAppliedSeeds(client);

    const files = fs
      .readdirSync(SEEDS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip   ${file} (ya aplicado)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_seeds (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  seed   ${file}`);
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  FAIL   ${file}`);
        throw err;
      }
    }

    const { rows: bedCount } = await client.query('SELECT count(*)::int AS n FROM beds');
    console.log(`\nSeeds aplicados: ${appliedCount}/${files.length} (total ${bedCount[0].n} camas cargadas).`);
  } finally {
    client.release();
  }
}

runSeeds()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Error corriendo seeds:', err.message);
    pool.end();
    process.exit(1);
  });
