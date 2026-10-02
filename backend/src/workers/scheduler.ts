//
// Planificador de tareas programadas del proceso worker. Un unico temporizador (cada
// 60 s, dentro del proceso) decide que tareas tocan segun la hora de Sao Paulo. No usa
// Redis ni colas: antes BullMQ consultaba Redis cada pocos segundos por cada tarea
// (decenas de miles de comandos por dia, que en Upstash se factura o corta el servicio).
//
// Cada tarea es idempotente (las que envian emails o cobran se apoyan en la tabla
// notifications / payments), asi que correr una de mas nunca duplica nada. Una tarea no
// se solapa consigo misma, y un error nunca tumba el proceso.

import { logger } from '../utils/logger';
import { runCleanup } from './cleanup.task';
import { runFlexibleConversion } from './flexible-conversion.task';
import { runOwnerPayouts } from './owner-payout.task';
import { runOtaSync } from './ota-sync.task';
import { runRemainingPaymentCharges } from './remaining-payment.task';
import { runRemainingPaymentRetries } from './remaining-payment-retries.task';
import { notificationService } from '../services/notification-service';

const TIMEZONE = 'America/Sao_Paulo';

export interface ClockParts {
  month: number; // 1-12
  hour: number; // 0-23
  minute: number; // 0-59
  slot: string; // identifica el minuto (para no correr dos veces en el mismo minuto)
}

export function clockParts(date: Date): ClockParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const [month, hour, minute] = [Number(p.month), Number(p.hour), Number(p.minute)];
  return { month, hour, minute, slot: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` };
}

const isHighSeason = (month: number) => month === 12 || month <= 3; // dic-mar

interface Task {
  name: string;
  /** true si la tarea toca en este minuto */
  due: (c: ClockParts) => boolean;
  run: () => Promise<void>;
  /** se ejecuta tambien una vez al arrancar el proceso (solo tareas idempotentes) */
  runAtStartup?: boolean;
}

export const TASKS: Task[] = [
  // Sincronizacion de calendarios iCal/OTA: cada 5 min.
  { name: 'ota-sync', due: (c) => c.minute % 5 === 0, run: runOtaSync, runAtStartup: true },
  // Limpieza + avisos al huesped: cada 2 h fuera de temporada alta, cada 5 min en dic-mar.
  {
    name: 'cleanup',
    due: (c) => (isHighSeason(c.month) ? c.minute % 5 === 0 : c.minute === 0 && c.hour % 2 === 0),
    run: runCleanup,
    runAtStartup: true
  },
  // Conversion de habitaciones flexibles: una vez por dia, 00:00.
  { name: 'flexible-conversion', due: (c) => c.hour === 0 && c.minute === 0, run: runFlexibleConversion },
  // Pagos a propietarios: una vez por dia, 13:00 (despues del check-out de las 12:00).
  { name: 'owner-payout', due: (c) => c.hour === 13 && c.minute === 0, run: runOwnerPayouts },
  // Cobro del 70% de apartamentos (desde las 8:00 del check-in) y sus reintentos: cada hora.
  { name: 'remaining-payment', due: (c) => c.minute === 0, run: runRemainingPaymentCharges, runAtStartup: true },
  { name: 'remaining-payment-retries', due: (c) => c.minute === 30, run: runRemainingPaymentRetries, runAtStartup: true },
  // Reintento de emails que fallaron: cada 15 min.
  { name: 'email-retries', due: (c) => c.minute % 15 === 0, run: () => notificationService.retryFailedNotifications(), runAtStartup: true }
];

const running = new Set<string>();
const lastSlot = new Map<string, string>();

async function execute(task: Task): Promise<void> {
  if (running.has(task.name)) {
    logger.warn('Tarea programada todavía en curso, se omite esta corrida', { task: task.name });
    return;
  }
  running.add(task.name);
  const start = Date.now();
  try {
    await task.run();
  } catch (error: any) {
    logger.error('Tarea programada falló', { task: task.name, error: error?.message });
  } finally {
    running.delete(task.name);
    logger.info('Tarea programada terminada', { task: task.name, ms: Date.now() - start });
  }
}

/** Corre las tareas que tocan en este minuto (una sola vez por minuto y tarea). Exportada para tests. */
export async function tick(now: Date = new Date()): Promise<string[]> {
  const clock = clockParts(now);
  const started: string[] = [];
  for (const task of TASKS) {
    if (!task.due(clock) || lastSlot.get(task.name) === clock.slot) {continue;}
    lastSlot.set(task.name, clock.slot);
    started.push(task.name);
    void execute(task);
  }
  return started;
}

export function startScheduler(): () => void {
  // Al arrancar (o reiniciar tras una caida) se ponen al dia las tareas idempotentes,
  // escalonadas para no saturar la base.
  TASKS.filter((t) => t.runAtStartup).forEach((task, i) => {
    setTimeout(() => void execute(task), 5_000 + i * 15_000);
  });

  const timer = setInterval(() => void tick(), 60_000);
  logger.info(`Planificador iniciado: ${TASKS.length} tareas programadas (sin Redis)`);
  return () => clearInterval(timer);
}
