import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Formato para desarrollo
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    }`;
  })
);

// Formato para producción
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: config.logLevel,
  format: config.nodeEnv === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'lapa-casa-backend' },
  transports: [
    new winston.transports.Console(),
  ],
});

// Agregar archivo de logs en producción
if (config.nodeEnv === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log' 
  }));
}

export default logger;
