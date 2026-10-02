import { query } from '../config/database';
import { logger } from '../utils/logger';

/** Convierte habitaciones flexibles (ej. femenino -> mixto 48 h antes). Idempotente. */
export async function runFlexibleConversion(): Promise<void> {
  const start = Date.now();
  await query('CALL sp_process_flexible_conversion()');
  logger.info('flexible-conversion completado', { ms: Date.now() - start });
}
