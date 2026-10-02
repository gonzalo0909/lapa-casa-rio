//
// Health check extendido, mas alla del `testConnection()` basico que ya
// vive en app.ts (GET /health, el que usa Fly.io como healthCheckPath).
// Este cubre los servicios que pide los servicios: DB, Redis,
// Stripe, MercadoPago, colas BullMQ.
//
// Distincion importante para no mentir en el reporte: DB y Redis se
// verifican con una operacion real contra el servicio (SELECT 1 / PING).
// Stripe y MercadoPago solo se reportan como "configured" (variable de
// entorno presente) -- una llamada real a esas APIs en cada hit de
// health check agrega latencia y costo a un endpoint que UptimeRobot u
// otro monitor puede pegarle cada minuto, y el Maestro ya deja explicito
// que esas integraciones "siguen sin probar por falta de salida de red
// en el sandbox de pruebas". No se finge una verificacion que no existe.

import { testConnection as testDatabase } from '../config/database';
import cacheClient from '../cache/redis-client';
import { env } from '../config/environment';

export type ServiceStatus = 'ok' | 'degraded' | 'down' | 'not_configured';

export interface ServiceHealth {
  status: ServiceStatus;
  detail?: string;
  latencyMs?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptimeSeconds: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    queues: ServiceHealth;
    stripe: ServiceHealth;
    mercadopago: ServiceHealth;
    email: ServiceHealth;
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - start };
}

async function checkDatabase(): Promise<ServiceHealth> {
  try {
    const { result: ok, latencyMs } = await timed(() => testDatabase());
    return ok
      ? { status: 'ok', latencyMs }
      : { status: 'down', detail: 'testConnection() devolvio false', latencyMs };
  } catch (error: any) {
    return { status: 'down', detail: error?.message ?? 'error desconocido' };
  }
}

// Fly consulta /health cada 30 s: sin cache, cada consulta seria un PING a Redis
// (miles de comandos por dia en un plan facturado por comando).
const REDIS_HEALTH_CACHE_MS = 10 * 60 * 1000;
let redisHealthCache: { at: number; value: ServiceHealth } | null = null;

async function checkRedis(): Promise<ServiceHealth> {
  if (!env.REDIS_URL) {
    return { status: 'not_configured', detail: 'REDIS_URL no configurada -- usando fallback en memoria, sin estado compartido entre instancias' };
  }
  if (redisHealthCache && Date.now() - redisHealthCache.at < REDIS_HEALTH_CACHE_MS) {
    return redisHealthCache.value;
  }
  let value: ServiceHealth;
  try {
    const { result: alive, latencyMs } = await timed(() => cacheClient.ping());
    value = alive
      ? { status: 'ok', latencyMs }
      : { status: 'down', detail: 'PING no respondio', latencyMs };
  } catch (error: any) {
    value = { status: 'down', detail: error?.message ?? 'error desconocido' };
  }
  redisHealthCache = { at: Date.now(), value };
  return value;
}

// Ya no hay colas: las tareas programadas corren con un planificador dentro del proceso worker.
async function checkQueues(): Promise<ServiceHealth> {
  return { status: 'ok', detail: 'sin colas -- tareas programadas en el proceso worker (workers/scheduler.ts)' };
}

function checkStripe(): ServiceHealth {
  return process.env.STRIPE_SECRET_KEY
    ? { status: 'ok', detail: 'configured (sin ping en vivo -- ver comentario del modulo)' }
    : { status: 'not_configured', detail: 'STRIPE_SECRET_KEY no configurada -- pagos Stripe deshabilitados' };
}

function checkMercadoPago(): ServiceHealth {
  return process.env.MP_ACCESS_TOKEN
    ? { status: 'ok', detail: 'configured (sin ping en vivo -- ver comentario del modulo)' }
    : { status: 'not_configured', detail: 'MP_ACCESS_TOKEN no configurada -- pagos MercadoPago deshabilitados' };
}

function checkEmail(): ServiceHealth {
  return process.env.RESEND_API_KEY
    ? { status: 'ok', detail: 'configured (sin ping en vivo)' }
    : { status: 'not_configured', detail: 'RESEND_API_KEY no configurada -- envio de emails deshabilitado' };
}

function overallStatus(services: SystemHealth['services']): SystemHealth['status'] {
  const critical = [services.database];
  if (critical.some((s) => s.status === 'down')) {return 'unhealthy';}

  const all = Object.values(services);
  if (all.some((s) => s.status === 'down' || s.status === 'not_configured')) {return 'degraded';}
  return 'healthy';
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [database, redis, queues] = await Promise.all([checkDatabase(), checkRedis(), checkQueues()]);
  const services = {
    database,
    redis,
    queues,
    stripe: checkStripe(),
    mercadopago: checkMercadoPago(),
    email: checkEmail(),
  };

  return {
    status: overallStatus(services),
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    services,
  };
}
