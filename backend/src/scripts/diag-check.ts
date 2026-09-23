// Diagnóstico puntual (correr manual por SSH, no se invoca desde ningún
// flujo normal): ver qué migraciones quedaron aplicadas en producción y si
// los apartamentos tienen el bloqueo por default de feriados (0042).
// Se borra después de usarlo -- no es parte del código permanente.

import { query } from '../config/database';

async function main() {
  const migrations = await query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY id DESC LIMIT 15'
  );
  console.log('LAST_MIGRATIONS', JSON.stringify(migrations.rows));

  const blocks = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM room_blocks rb
     JOIN room_types rt ON rt.id = rb.room_type_id
     WHERE rt.property_type = 'apartment'`
  );
  console.log('APARTMENT_BLOCK_ROWS', JSON.stringify(blocks.rows));

  const apartments = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM room_types WHERE property_type = 'apartment'`
  );
  console.log('APARTMENT_COUNT', JSON.stringify(apartments.rows));

  process.exit(0);
}

main().catch((err) => {
  console.error('DIAG_ERROR', err.message);
  process.exit(1);
});
