// lapa-casa-hostel/backend/src/monitoring/alerts.ts
// ventana6
//
// Alertas configurables del checklist de Ventana 6. Dos ya estaban
// resueltas antes de esta ventana y no se duplican aca:
//   - overbooking / conflicto entre canales detectado -> conflict-service.ts
//     (notifyConflict, se dispara al registrar cada booking_conflicts)
//   - pago fallido recurrente -> remaining-payment-retries.worker.ts
//     (PAYMENT_RETRIES_EXHAUSTED, al agotar los 3 reintentos)
// Las dos que faltaban, agregadas aca:
//   - servicio caido (checkServiceDownAlert)
//   - fechas de Carnaval del año siguiente faltantes (checkCarnivalDatesAlert)
//
// Ambas se invocan desde el scheduler diario de
// queues/monitoring-alerts.queue.ts.

import { query } from '../config/database';
import { emailService } from '../services/email-service';
import { logger } from '../utils/logger';
import { getSystemHealth, ServiceStatus } from './health';

interface CarnivalDateEntry {
  year: number;
  start_date: string;
  end_date: string;
}

const CARNIVAL_ALERT_WINDOW_DAYS = 60;

/**
 * Si faltan menos de 60 dias para el fin del año en curso y todavia no
 * hay fechas de Carnaval cargadas en system_config para el año siguiente,
 * dispara la alerta. Se compara contra "hoy" en horario de Sao Paulo
 * (America/Sao_Paulo, ver Maestro -- zona horaria operativa unica).
 */
export async function checkCarnivalDatesAlert(): Promise<{ alerted: boolean }> {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59));
  const daysUntilYearEnd = Math.ceil((endOfYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilYearEnd > CARNIVAL_ALERT_WINDOW_DAYS || daysUntilYearEnd < 0) {
    return { alerted: false };
  }

  const nextYear = currentYear + 1;
  const { rows } = await query<{ value: CarnivalDateEntry[] }>(
    `SELECT value FROM system_config WHERE key = 'carnival_dates'`
  );
  const dates: CarnivalDateEntry[] = rows[0]?.value ?? [];
  const hasNextYear = dates.some((d) => d.year === nextYear);

  if (hasNextYear) {
    return { alerted: false };
  }

  logger.warn('Fechas de Carnaval del año siguiente no cargadas', { nextYear, daysUntilYearEnd });
  await emailService.sendAdminAlert('carnival_dates_missing', {
    nextYear,
    daysUntilYearEnd,
    action: `Cargar en system_config.carnival_dates las fechas oficiales de Carnaval ${nextYear} (ver backend/database/README.md)`,
  });
  return { alerted: true };
}

/**
 * Dedupe en memoria: solo alerta en la transicion ok -> down de cada
 * servicio critico, no en cada corrida del scheduler mientras sigue
 * caido (si no, un servicio caido durante horas manda un email por cada
 * ejecucion del job). Vive en memoria del proceso de workers -- se
 * resetea en cada restart, lo cual en el peor caso re-alerta una vez de
 * mas tras un deploy, nunca deja de alertar una caida real.
 */
const previousStatus = new Map<string, ServiceStatus>();
const CRITICAL_SERVICES = ['database', 'redis', 'queues'] as const;

export async function checkServiceDownAlert(): Promise<{ alerted: string[] }> {
  const health = await getSystemHealth();
  const alerted: string[] = [];

  for (const service of CRITICAL_SERVICES) {
    const current = health.services[service].status;
    const previous = previousStatus.get(service);
    previousStatus.set(service, current);

    if (current === 'down' && previous !== 'down') {
      logger.error('Servicio caido', { service, detail: health.services[service].detail });
      await emailService.sendAdminAlert('service_down', {
        service,
        detail: health.services[service].detail ?? '(sin detalle)',
        detectedAt: health.timestamp,
      });
      alerted.push(service);
    }
  }

  return { alerted };
}

export async function runScheduledAlertChecks(): Promise<void> {
  const [carnival, serviceDown] = await Promise.all([
    checkCarnivalDatesAlert().catch((error) => {
      logger.error('Error chequeando fechas de Carnaval', { error: error.message });
      return { alerted: false };
    }),
    checkServiceDownAlert().catch((error) => {
      logger.error('Error chequeando servicios caidos', { error: error.message });
      return { alerted: [] as string[] };
    }),
  ]);

  logger.info('Chequeo de alertas programadas completado', {
    carnivalDatesAlerted: carnival.alerted,
    servicesAlerted: serviceDown.alerted,
  });
}
