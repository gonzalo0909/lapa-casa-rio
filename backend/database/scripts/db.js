// db.js
// Lapa Casa Hostel - Channel Manager
//
// Conexion compartida a Postgres para los scripts de la Ventana 1
// (migrate.js, seed.js, test-scenarios.js). En Ventana 2 la capa de
// servicios usa Prisma; estos scripts son deliberadamente independientes
// de Prisma porque corren ANTES de que exista el schema de Prisma.

const { Pool } = require('pg');
require('dotenv').config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://lapa_dev:lapa_dev_pw@localhost:5432/lapa_casa_hostel';

// Mismo criterio que src/config/database.ts: Supabase en produccion exige
// SSL. Sin esto, migrate.js fallaba al conectar en Render (npm run start
// encadena "migrate && server" -- si migrate.js no puede conectar, el
// servidor entero no llega a levantar).
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

module.exports = { pool };
