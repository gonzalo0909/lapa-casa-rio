// db.js
// Lapa Casa Hostel - Channel Manager
//
// Conexion compartida a Postgres para los scripts de las migraciones iniciales
// (migrate.js, seed.js, test-scenarios.js). En la versión con Prisma, la capa de
// servicios usa Prisma; estos scripts son deliberadamente independientes
// de Prisma porque corren ANTES de que exista el schema de Prisma.

const { Pool } = require('pg');
require('dotenv').config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://lapa_dev:lapa_dev_pw@localhost:5432/lapacasario';

// Mismo criterio que src/config/database.ts: Supabase en produccion exige
// SSL. Sin esto, migrate.js falla al conectar (npm run start encadena
// "migrate && server" -- si migrate.js no puede conectar, el servidor
// entero no llega a levantar).
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = { pool };
