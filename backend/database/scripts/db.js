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

const pool = new Pool({ connectionString });

module.exports = { pool };
