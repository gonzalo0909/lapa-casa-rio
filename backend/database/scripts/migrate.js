// migrate.js
// Lapa Casa Hostel - Channel Manager
//
// Aplica, en orden, los archivos .sql de database/migrations/ que aun no
// figuren en la tabla schema_migrations. Cada archivo corre dentro de su
// propia transaccion: si un archivo falla, no queda parcialmente
// aplicado y los siguientes no se ejecutan.
//
// Uso: node database/scripts/migrate.js

const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// La base de produccion (Supabase) tenia el esquema completo de 0001 a
// 0008 desde antes de que este script existiera -- se cargo a mano en su
// momento, sin pasar por schema_migrations. La primera vez que este
// script corrio contra esa base, encontro schema_migrations vacia e
// intento reaplicar 0001 desde cero, chocando con tipos/tablas que ya
// existian ("type booking_status already exists"). Si la tabla de
// bookkeeping esta vacia pero el esquema real ya existe (room_types),
// se asume que todo lo anterior a 0009 ya esta aplicado y se marca como
// tal sin volver a correrlo -- recien de ahi en mas corre normalmente.
const PRE_EXISTING_MIGRATIONS = [
  '0001_extensions_and_enums.sql',
  '0002_tables.sql',
  '0003_exclude_constraint.sql',
  '0004_pricing_functions.sql',
  '0005_availability_and_locks.sql',
  '0006_triggers.sql',
  '0007_procedures.sql',
  '0008_fix_integer_params.sql',
];

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await client.query('SELECT count(*)::int AS n FROM schema_migrations');
  if (rows[0].n > 0) return;

  const { rows: roomTypeRows } = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'room_types'
    ) AS exists
  `);
  if (!roomTypeRows[0].exists) return;

  for (const filename of PRE_EXISTING_MIGRATIONS) {
    await client.query(
      'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
      [filename]
    );
    console.log(`  bootstrap  ${filename} (esquema ya existia, marcada como aplicada)`);
  }
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip   ${file} (ya aplicada)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  apply  ${file}`);
        appliedCount += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  FAIL   ${file}`);
        throw err;
      }
    }

    console.log(`\nMigraciones aplicadas: ${appliedCount}/${files.length} (total ${files.length} archivos)`);
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Error corriendo migraciones:', err.message);
    pool.end();
    process.exit(1);
  });
