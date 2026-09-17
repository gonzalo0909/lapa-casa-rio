// lapa-casa-hostel/backend/prisma.config.ts
//
// Solo lo usa el CLI de Prisma (prisma db pull, prisma generate) para
// saber a qué base conectarse al introspectar. El cliente en tiempo de
// ejecución (src/config/prisma.ts) NO usa este archivo -- se conecta vía
// el driver adapter con su propio Pool, como exige Prisma 7.

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// process.env.DATABASE_URL directo (no el helper env() de prisma/config,
// que tira si falta): `prisma generate` no necesita conectarse a la base
// y no debe romperse solo porque no hay .env todavia (ej. clon nuevo,
// CI sin secretos). Solo `prisma db pull`/`migrate` la necesitan de
// verdad, y ahi el error de conexion ya es claro por si solo.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
