// lapa-casa-hostel/frontend/sentry.client.config.ts
// Corre en el navegador. Se inicializa automáticamente gracias a withSentryConfig
// en next.config.js — no hace falta importarlo a mano.

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // En producción: 10% de las sesiones con trazas de performance.
  // En desarrollo: 100% para poder depurar fácilmente.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Graba una replay del navegador solo cuando ocurre un error.
  // 0% en sesiones normales, 100% en sesiones con error.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
  ],
});
