//
// Alertas configurables del sistema. Dos ya estaban
// resueltas antes de esta ventana y no se duplican aca:
//   - overbooking / conflicto entre canales detectado -> conflict-service.ts
//     (notifyConflict, se dispara al registrar cada booking_conflicts)
//   - pago fallido recurrente -> remaining-payment-retries.worker.ts
//     (PAYMENT_RETRIES_EXHAUSTED, al agotar los 3 reintentos)
// La que se agrega aca:
//   - servicio caido (checkServiceDownAlert)
//
// Se invoca desde el scheduler diario de queues/monitoring-alerts.queue.ts.

import { emailService } from '../services/email-service';
import { logger } from '../utils/logger';
import { getSystemHealth, type ServiceStatus } from './health';

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
  const serviceDown = await checkServiceDownAlert().catch((error) => {
    logger.error('Error chequeando servicios caidos', { error: error.message });
    return { alerted: [] as string[] };
  });

  logger.info('Chequeo de alertas programadas completado', {
    servicesAlerted: serviceDown.alerted,
  });
}
