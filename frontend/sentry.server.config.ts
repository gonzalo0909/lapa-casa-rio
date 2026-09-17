// lapa-casa-hostel/frontend/sentry.server.config.ts
// Corre en el servidor de Next.js (Node.js). Se carga automáticamente.

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
