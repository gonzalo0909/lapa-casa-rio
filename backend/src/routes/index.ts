/**
 * File: lapa-casa-hostel/backend/src/routes/index.ts
 * Main API Routes Index
 * Lapa Casa Channel Manager
 *
 * Centralizes all API route modules and applies global middleware
 * Implements versioning, rate limiting, and security headers
 *
 * @module routes/index
 * @requires express
 */

import { Router, type Request, type Response } from 'express';
import { bookingsRouter } from './bookings/bookings.routes';
import { photosRouter } from './photos/photos.routes';
import { availabilityRouter } from './availability/availability.routes';
import { paymentsRouter } from './payments/payments.routes';
import { roomsRouter } from './rooms/rooms.routes';
import { offersRouter } from './offers/offers.routes';
import { partnersRouter } from './partners/partners.routes';
import { adminRouter } from './admin/admin.routes';
import { adminAuthRouter } from './admin/admin-auth.routes';
import { ownerAuthRouter } from './owner/owner-auth.routes';
import { ownerRouter } from './owner/owner.routes';
import icalRouter from './ical/ical.routes';
import otaWebhooksRouter from './webhooks/ota.routes';
import { sentryWebhookRouter } from './webhooks/sentry.routes';
import { rateLimiter } from '../middleware/rate-limiter';
import { authenticateToken, requireRole, authenticateOwnerToken } from '../middleware/auth';
import { verifyCsrf } from '../middleware/csrf';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/responses';

const router = Router();

/**
 * API Health Check Endpoint
 * @route GET /health
 * @returns {object} 200 - Server health status
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * API Information Endpoint
 * @route GET /info
 * @returns {object} 200 - API information
 */
router.get('/info', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'Lapa Casa API',
    version: '1.0.0',
    description: 'Channel Manager & Booking Engine API',
    endpoints: {
      bookings: '/api/v1/bookings',
      availability: '/api/v1/availability',
      payments: '/api/v1/payments',
      rooms: '/api/v1/rooms',
      admin: '/api/v1/admin',
    },
    documentation: '/api/docs',
    support: 'lapalandiarj@gmail.com',
  });
});

/**
 * Debug Sentry Endpoint — solo para admin (evita spam en logs de Sentry)
 * @route GET /debug-sentry
 */
router.get('/debug-sentry', authenticateToken, requireRole(['admin']), (_req: Request, _res: Response) => {
  throw new Error('[Sentry test] Error de prueba desde /debug-sentry — si ves esto en Sentry, está funcionando.');
});

/**
 * Public Routes (No Authentication Required)
 * Rate limits ampliados para soportar carga real de uso:
 * - availability: 120 req/min (10 apts × varios refreshes simultáneos)
 * - rooms/photos: 60 req/min
 */
router.use(
  '/availability',
  rateLimiter({ max: 120, windowMs: 60000, prefix: 'availability' }),
  availabilityRouter,
);
router.use('/rooms', rateLimiter({ max: 60, windowMs: 60000, prefix: 'rooms' }), roomsRouter);
router.use('/photos', rateLimiter({ max: 60, windowMs: 60000, prefix: 'photos' }), photosRouter);
router.use('/offers', rateLimiter({ max: 30, windowMs: 60000, prefix: 'offers' }), offersRouter);
router.use('/partners', partnersRouter);

/**
 * iCal: export publico de disponibilidad + config/sync de
 * importacion (estas ultimas requieren admin, aplicado dentro del propio
 * router). Webhooks de reservas OTA: solo Booking.com y Expedia tienen
 * (Airbnb/Hostelworld son iCal-only) -- autenticados por firma HMAC +
 * API key propios, no por JWT de admin (ver routes/webhooks/ota.routes.ts).
 */
router.use('/ical', icalRouter);
router.use('/webhooks', otaWebhooksRouter);
router.use('/webhooks/sentry', sentryWebhookRouter);

/**
 * Semi-Protected Routes (Rate Limited)
 */
router.use(
  '/bookings',
  rateLimiter({ max: 3, windowMs: 1000, prefix: 'bookings' }),
  bookingsRouter,
);

/**
 * Payment Routes
 * GET /group/:token (polling de estado grupal) usa límite relajado (60/min).
 * El resto del router mantiene el límite estricto de 3/s.
 * Se aplica un único rateLimiter condicional para evitar que ambos se acumulen.
 */
router.use(
  '/payments',
  (req, res, next) => {
    // GETs de polling de pago grupal (titular y miembro) → límite relajado
    const isGroupPoll =
      req.method === 'GET' &&
      (/^\/group\/[^/]+$/.test(req.path) || /^\/group-member\/[^/]+$/.test(req.path));
    const limiter = isGroupPoll
      ? rateLimiter({ max: 60, windowMs: 60000, prefix: 'payments-poll' })
      : rateLimiter({ max: 3, windowMs: 1000, prefix: 'payments' });
    limiter(req, res, next);
  },
  paymentsRouter,
);

/**
 * Admin Login — público, montado ANTES del
 * authenticateToken de abajo (si no, nadie podría loguearse para
 * conseguir el primer token). Rate limit estricto contra fuerza bruta.
 */
router.use(
  '/admin/login',
  rateLimiter({ max: 10, windowMs: 60000, prefix: 'admin-login' }),
  adminAuthRouter,
);

/**
 * Admin Routes (Authentication + rol admin requeridos)
 *
 * FIX (auditoría de seguridad 2026-08-30): este montaje nunca aplicaba
 * authenticateToken/requireRole pese a que el comentario de arriba y los
 * comentarios de varios sub-routers (admin.routes.ts, guests.routes.ts,
 * etc.) afirmaban que sí -- todo /api/v1/admin/* quedaba accesible sin
 * ninguna credencial. Se agrega acá, en el punto de montaje, para cubrir
 * todos los sub-routers de una sola vez.
 */
router.use(
  '/admin',
  rateLimiter({ max: 30, windowMs: 1000, prefix: 'admin' }),
  authenticateToken,
  requireRole(['admin']),
  verifyCsrf('lch_admin_csrf'),
  adminRouter,
);

/**
 * Owner Login (0031_apartment_owner_login.sql) — login propio de cada
 * administrador de apartamento, separado del admin único de arriba.
 * Público, montado antes de authenticateOwnerToken por la misma razón
 * que /admin/login.
 */
router.use(
  '/owner/login',
  rateLimiter({ max: 10, windowMs: 60000, prefix: 'owner-login' }),
  ownerAuthRouter,
);

/**
 * Owner Routes (Authentication + rol owner requeridos) — cada
 * administrador ve solo lo suyo, filtrado por ownerId dentro de cada
 * endpoint (ver owner.routes.ts).
 */
router.use(
  '/owner',
  rateLimiter({ max: 30, windowMs: 1000, prefix: 'owner' }),
  authenticateOwnerToken,
  verifyCsrf('lch_owner_csrf'),
  ownerRouter,
);

/**
 * Catch-all 404 Handler
 */
router.use('*', (req: Request, res: Response) => {
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json(
    ApiResponse.error('The requested endpoint does not exist', {
      path: req.originalUrl,
    }),
  );
});

// Sección 8 auditoría 17 secciones: se elimina el error handler local que
// estaba acá. Contrario a lo que decía un diagnóstico previo ("nunca se
// alcanza en la práctica"), este handler SÍ se alcanzaba -- verificado con
// un test aislado de Express replicando este mismo anidado de routers --
// y ese era el problema real: siempre devolvía 500 sin leer
// error.statusCode, así que cualquier AppError con código propio
// (404 "Reserva no encontrada", 400 "El pago ya fue confirmado", 503
// "Pago con tarjeta no disponible", etc. -- 16+ lugares en services/)
// le llegaba al cliente como un 500 genérico. Se deja que el error
// burbujee al errorHandler de app.ts, que sí respeta el statusCode real.

export default router;
