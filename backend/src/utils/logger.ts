// lapa-casa-hostel/backend/src/utils/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function log(level: LogLevel, message: string, meta?: any): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) {return;}

  const entry: Record<string, any> = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
  };

  if (meta !== undefined) {
    if (meta instanceof Error) {
      entry.error = { message: meta.message, stack: meta.stack };
    } else if (typeof meta === 'object') {
      Object.assign(entry, meta);
    } else {
      entry.meta = meta;
    }
  }

  // Bug corregido: antes solo el nivel 'error' imprimia el meta (motivo real
  // del error, ej. err.message de una excepcion) -- 'warn'/'info'/'debug'
  // imprimian el mensaje pelado y el detalle se perdia por completo (nunca
  // llegaba a los logs), aunque ya se calculaba arriba en `entry`.
  const line = `[${entry.timestamp}] ${level.toUpperCase()}: ${message}${meta !== undefined ? ` ${JSON.stringify(meta)}` : ''}`;

  if (level === 'error') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  debug: (message: string, meta?: any) => log('debug', message, meta),
  info:  (message: string, meta?: any) => log('info',  message, meta),
  warn:  (message: string, meta?: any) => log('warn',  message, meta),
  error: (message: string, meta?: any) => log('error', message, meta),
};

export default logger;
