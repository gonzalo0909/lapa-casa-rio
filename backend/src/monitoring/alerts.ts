//
// Alertas configurables del sistema. Dos ya estaban
// resueltas antes de esta ventana y no se duplican aca:
//   - overbooking / conflicto entre canales detectado -> conflict-service.ts
//     (notifyConflict, se dispara al registrar cada booking_conflicts)
//   - pago fallido recurrente -> remaining-payment-retries.worker.ts
//     (PAYMENT_RETRIES_EXHAUSTED, al agotar los 3 reintentos)
// Las que se agregan aca:
//   - servicio caido (checkServiceDownAlert)
//   - sincronizacion iCal/OTA detenida o con errores (checkOtaSyncAlert)
//
// Se invoca desde el scheduler de queues/monitoring-alerts.queue.ts (cada 30 min).

import { emailService } from '../services/email-service';
import { listFeeds, getSyncStatus } from '../services/ical-service';
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

// La sync corre cada 5 min: sin una corrida en 20 min algo se detuvo.
const OTA_SYNC_STALE_MINUTES = 20;
let previousOtaSyncProblem = '';

interface ChannelSyncStatus {
  lastSyncAt?: string;
  success?: boolean;
  errors?: string[];
}

/**
 * Avisa por email cuando la sincronizacion de feeds iCal se detuvo (el worker
 * no corre) o termino con errores. Dedupe por "firma" del problema: manda un
 * email cuando aparece o cambia, no uno por cada chequeo mientras sigue igual.
 */
export async function checkOtaSyncAlert(): Promise<{ alerted: boolean }> {
  const activeFeeds = (await listFeeds()).filter((f) => f.isActive);
  if (activeFeeds.length === 0) {
    previousOtaSyncProblem = '';
    return { alerted: false };
  }

  const status = (await getSyncStatus()) as Record<string, ChannelSyncStatus>;
  const problems: string[] = [];
  const now = Date.now();

  for (const channel of new Set(activeFeeds.map((f) => f.channelCode))) {
    const st = status[channel];
    const lastSync = st?.lastSyncAt ? new Date(st.lastSyncAt).getTime() : NaN;
    if (!st || Number.isNaN(lastSync) || now - lastSync > OTA_SYNC_STALE_MINUTES * 60_000) {
      problems.push(`${channel}: sin sincronizar desde ${st?.lastSyncAt ?? 'nunca'} (el worker de sincronizacion puede estar detenido)`);
    } else if (st.success === false) {
      problems.push(`${channel}: la ultima sincronizacion termino con errores: ${(st.errors ?? []).slice(0, 3).join(' | ')}`);
    }
  }

  const signature = problems.join('\n');
  if (!signature) {
    previousOtaSyncProblem = '';
    return { alerted: false };
  }
  if (signature === previousOtaSyncProblem) {
    return { alerted: false };
  }
  previousOtaSyncProblem = signature;

  logger.error('Sincronizacion iCal/OTA con problemas', { problems });
  await emailService.sendAdminAlert('ota_sync_problem', { detalle: problems.join(' // '), detectedAt: new Date().toISOString() });
  return { alerted: true };
}

export async function runScheduledAlertChecks(): Promise<void> {
  const serviceDown = await checkServiceDownAlert().catch((error) => {
    logger.error('Error chequeando servicios caidos', { error: error.message });
    return { alerted: [] as string[] };
  });

  const otaSync = await checkOtaSyncAlert().catch((error) => {
    logger.error('Error chequeando sincronizacion OTA', { error: error.message });
    return { alerted: false };
  });

  logger.info('Chequeo de alertas programadas completado', {
    servicesAlerted: serviceDown.alerted,
    otaSyncAlerted: otaSync.alerted,
  });
}
