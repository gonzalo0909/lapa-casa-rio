// lapa-casa-hostel/backend/src/database/lock-middleware.ts
//
// Extraido de booking-service.ts (Ventana 2, entregable 7). Wrapper
// explicito de acquire_bed_locks() -- SIEMPRE recibe el PoolClient de
// una transaccion activa (withTransaction en config/database.ts), nunca
// abre su propia conexion. pg_advisory_xact_lock solo protege dentro de
// la misma conexion fisica: llamarlo con un client distinto al que
// despues hace el INSERT no protege nada (ver test dedicado en
// database/tests/lock-middleware.test.ts).
//
// Diferencia real vs. lo propuesto originalmente en el documento de
// Ventana 2: no existe un "timeout" configurable -- acquire_bed_locks()
// usa pg_advisory_xact_lock, que BLOQUEA hasta poder tomar el lock (no
// falla por timeout). withLock() acá reciben bedIds (UUID[]), no un
// resourceKey generico con timeout, porque asi es como se llama de
// verdad la funcion SQL.

import { PoolClient } from 'pg';
import { withTransaction } from '../config/database';

/** acquire_bed_locks() dentro de la transaccion activa. No-op si bedIds esta vacio. */
export const acquireLock = async (client: PoolClient, bedIds: string[]): Promise<void> => {
  if (bedIds.length === 0) return;
  await client.query('SELECT acquire_bed_locks($1::uuid[])', [bedIds]);
};

/**
 * No-op documentado a proposito: un advisory lock tomado con
 * pg_advisory_xact_lock se libera solo al terminar la transaccion
 * (COMMIT o ROLLBACK) -- no existe un "unlock" manual posible ni
 * necesario mientras el patron sea siempre lock -> verificar -> insertar
 * dentro de la misma transaccion.
 */
export const releaseLock = async (_client: PoolClient, _bedIds: string[]): Promise<void> => {};

/**
 * Ejecuta `callback` dentro de una transaccion nueva que ya tiene el
 * lock de `bedIds` tomado. Garantiza que lock, verificacion e insert
 * corren sobre el mismo PoolClient (Requisito Critico #1 del Maestro).
 */
export const withLock = async <T>(
  bedIds: string[],
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  return withTransaction(async (client) => {
    await acquireLock(client, bedIds);
    return callback(client);
  });
};
