// seed.js
// Lapa Casa Hostel - Channel Manager
//
// Aplica los archivos .sql de database/seeds/. Es idempotente a nivel de
// "corrida completa": si room_types ya tiene filas, asume que el seed ya
// se aplico y no lo repite (evitar violar los UNIQUE de bed_code, etc.).
// Para volver a sembrar desde cero, correr primero reset.js.
//
// Uso: node database/scripts/seed.js

const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const SEEDS_DIR = path.join(__dirname, '..', 'seeds');

async function runSeeds() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM room_types');
    if (rows[0].n > 0) {
      console.log(`room_types ya tiene ${rows[0].n} filas -- seed omitido (correr reset.js para reiniciar).`);
      return;
    }

    const files = fs
      .readdirSync(SEEDS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`  seed   ${file}`);
    }

    const { rows: bedCount } = await client.query('SELECT count(*)::int AS n FROM beds');
    console.log(`\nSeed completo: ${bedCount[0].n} camas cargadas.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
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
