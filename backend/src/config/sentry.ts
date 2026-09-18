// Inicialización de Sentry — debe importarse ANTES de cualquier otro módulo
// en server.ts para que el auto-instrumentation capture todas las operaciones.

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // En producción capturamos el 10% de las transacciones normales y el
    // 100% de las que terminan en error, para no agotar la cuota gratuita.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Evita enviar datos en desarrollo local si no hay DSN configurado
    enabled: !!dsn,
    // Ignorar errores de configuración esperados: la ruta ya los captura,
    // devuelve 422 al cliente y loguea el warning. No son bugs del código.
    ignoreErrors: [
      'Cloudinary no está configurado',
    ],
  });
  console.info('[Sentry] Inicializado en entorno:', process.env.NODE_ENV);
} else {
  console.info('[Sentry] SENTRY_DSN no configurado — monitoreo desactivado');
}

export { Sentry };
