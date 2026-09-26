// reset.js
// Lapa Casa Hostel - Channel Manager
//
// SOLO DESARROLLO. Elimina el schema "public" completo (tablas, tipos,
// funciones, procedimientos) y lo vuelve a crear vacio, para poder
// correr migrate.js + seed.js desde cero. Nunca ejecutar contra una base
// con datos reales de produccion.
//
// Uso: node database/scripts/reset.js --yes-i-am-sure

const { pool } = require('./db');

async function reset() {
  if (!process.argv.includes('--yes-i-am-sure')) {
    console.error('Este script borra TODO el schema "public". Pasa --yes-i-am-sure para confirmar.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    console.log('Schema "public" recreado vacio.');
  } finally {
    client.release();
  }
}

reset()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Error reseteando la base:', err.message);
    pool.end();
    process.exit(1);
  });
