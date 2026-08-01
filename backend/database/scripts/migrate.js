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

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT UNIQUE NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
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
