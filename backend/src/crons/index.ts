// lapa-casa-hostel/backend/src/crons/index.ts
// ventana4
//
// Punto de entrada unico de los jobs programados del backend. Hasta ahora
// nada en el repo importaba `crons/sync-ota-calendars.ts`, asi que ese cron
// nunca corria al levantar el servidor. Ademas, los procedimientos SQL de
// `0007_procedures.sql` (sp_cleanup_expired_pending, sp_release_no_show,
// sp_process_flexible_conversion) ya existen en el Supabase real pero,
// segun el comentario del propio archivo de migracion, "quedan inertes
// hasta que algo los invoque" -- nada los invocaba. Este modulo los activa
// con `node-cron` (no BullMQ: BullMQ no esta instalado en el repo, ver
// prompts/combo-VENTANA-4-completa.md).
//
// Nota: `sp_daily_audit_report` y `sp_sync_ota_availability`, mencionados
// en el Prompt Maestro como parte de esta ventana, NO existen en ninguna
// migracion aplicada -- no se agregan aca para no invocar un procedimiento
// inexistente. Quedan pendientes de definirse en SQL primero.

import cron from 'node-cron';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import './sync-ota-calendars';

interface ScheduledProcedure {
  name: string;
  schedule: string;
  procedure: string;
}

// sp_cleanup_expired_pending: reservas directas expiran a los 15 min, se
//   revisa cada 5 min para liberarlas con poco retraso.
// sp_release_no_show: el corte real es 23:59 America/Sao_Paulo; corre a las
//   00:01 (hora local) del dia siguiente para dar margen.
// sp_process_flexible_conversion: la ventana de conversion es de 48h: correr
//   cada hora es mas que suficiente para no perderse el corte (ver comentario
//   en 0007_procedures.sql sobre el rango de fechas candidatas ampliado).
const PROCEDURES: ScheduledProcedure[] = [
  { name: 'cleanup_expired_pending', schedule: '*/5 * * * *', procedure: 'sp_cleanup_expired_pending' },
  { name: 'release_no_show', schedule: '1 0 * * *', procedure: 'sp_release_no_show' },
  { name: 'process_flexible_conversion', schedule: '0 * * * *', procedure: 'sp_process_flexible_conversion' },
];

const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';

const running = new Set<string>();

async function callProcedure(job: ScheduledProcedure): Promise<void> {
  if (running.has(job.name)) {
    logger.warn(`Cron ${job.name} sigue corriendo, se salta esta ejecucion`);
    return;
  }
  running.add(job.name);
  const start = Date.now();
  try {
    await query(`CALL ${job.procedure}()`);
    logger.info(`Cron ${job.name} (${job.procedure}) completado en ${Date.now() - start}ms`);
  } catch (error) {
    logger.error(`Cron ${job.name} (${job.procedure}) fallo`, { error });
  } finally {
    running.delete(job.name);
  }
}

export function initializeScheduledProcedures(): void {
  if (process.env.DISABLE_AUTO_CRON === 'true') {
    logger.info('Procedimientos programados deshabilitados via DISABLE_AUTO_CRON');
    return;
  }

  for (const job of PROCEDURES) {
    if (!cron.validate(job.schedule)) {
      logger.error(`Cron schedule invalido para ${job.name}: ${job.schedule}`);
      continue;
    }
    cron.schedule(job.schedule, () => callProcedure(job), { timezone: TIMEZONE });
    logger.info(`Cron ${job.name} (${job.procedure}) programado con "${job.schedule}" (${TIMEZONE})`);
  }
}

if (process.env.DISABLE_AUTO_CRON !== 'true') {
  initializeScheduledProcedures();
}
