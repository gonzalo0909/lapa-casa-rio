// lapa-casa-hostel/backend/src/config/prisma.ts
//
// Cliente Prisma exclusivo para el dominio de administración/config de
// apartamentos (ver prisma/schema.prisma). El núcleo de reservas/pagos
// sigue en SQL crudo sobre el pool de `pg` en config/database.ts -- no
// se toca ni se comparte con este cliente.
//
// Prisma 7 requiere un "driver adapter" en vez de una URL en el schema
// (ver prisma/schema.prisma). Se usa @prisma/adapter-pg con su propio
// Pool, chico y separado del pool del núcleo (config/database.ts), para
// no competir con el límite de conexiones de Supabase -- mismo problema
// que causó la eliminación de Prisma en el commit fb1f4ea. Sumar
// DB_MAX_CONNECTIONS (pool del núcleo) + PRISMA_MAX_CONNECTIONS (este
// pool) no debe superar el límite del plan de Supabase.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { SUPABASE_CA_CERT } from './supabase-ca';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required (see backend/.env)');
}

// mismo manejo de certificado que config/database.ts -- ver ese archivo
// para el detalle de por qué rejectUnauthorized:true + CA explícita.
const databaseCaCert = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n') || SUPABASE_CA_CERT;

const prismaPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PRISMA_MAX_CONNECTIONS || '5', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true, ca: databaseCaCert }
    : false
});

prismaPool.on('error', (err) => {
  logger.error('Unexpected error on idle Prisma client', err);
});

const adapter = new PrismaPg(prismaPool);

export const prisma = new PrismaClient({ adapter });

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
  await prismaPool.end();
  logger.info('Prisma pool closed');
};

export default prisma;
