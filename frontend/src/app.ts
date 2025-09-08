import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import all API routes
import apiRoutes from './api';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: {
    ok: false,
    error: 'Too many requests, please try again later',
  },
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Health check global
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.nodeEnv,
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api', apiRoutes);

// Static files para servir frontend en producción
if (config.nodeEnv === 'production') {
  app.use(express.static('public'));
  
  app.get('*', (_req, res) => {
    res.sendFile('public/index.html', { root: process.cwd() });
  });
}

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app; src/api/routes/bookings.ts
// RUTA: /lapa-casa-backend/src/api/routes/bookings.ts
// PROPÓSITO: API endpoints para crear y gestionar reservas
// -----------------------------------------------------------------------------
import { Router } from 'express';
import { BookingService } from '../../core/booking';
import { validateBody } from '../../middleware/validation';
import { bookingRequestSchema } from '../../utils/validation/schemas';
import { logger } from '../../utils/logger';

const router = Router();
const bookingService = new BookingService();

/**
 * POST /api/bookings
 * Crear nueva reserva
 */
router.post('/', validateBody(bookingRequestSchema), async (req, res, next) => {
  try {
    const bookingData = req.body;

    logger.info('Booking creation requested', {
      guestEmail: bookingData.guest.email,
      dates: bookingData.dates,
      beds: bookingData.beds.length,
    });

    const result = await bookingService.createBooking(bookingData);

    res.status(201).json({
      ok: true,
      ...result,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/:bookingId
 * Obtener detalles de una reserva
 */
router.get('/:bookingId', async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await bookingService.getBooking(bookingId);
    
    res.json({
      ok: true,
      booking,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/bookings/:bookingId/status
 * Actualizar estado de reserva
 */
router.patch('/:bookingId/status', async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        ok: false,
        error: 'Estado inválido',
      });
    }

    const booking = await bookingService.updateBookingStatus(bookingId, status);

    res.json({
      ok: true,
      bookingId,
      status: booking.status,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/bookings/:bookingId/payment
 * Actualizar estado de pago
 */
router.patch('/:bookingId/payment', async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { payStatus } = req.body;

    if (!['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(payStatus)) {
      return res.status(400).json({
        ok: false,
        error: 'Estado de pago inválido',
      });
    }

    const booking = await bookingService.updatePaymentStatus(bookingId, payStatus);

    res.json({
      ok: true,
      bookingId,
      payStatus: booking.payStatus,
      status: booking.status,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/bookings/:bookingId
 * Cancelar reserva
 */
router.delete('/:bookingId', async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const result = await bookingService.cancelBooking(bookingId, reason);

    res.json({
      ok: true,
      ...result,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings
 * Buscar reservas con filtros
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      guestEmail: req.query.email as string,
      status: req.query.status as string,
      dateFrom: req.query.from as string,
      dateTo: req.query.to as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
    };

    const result = await bookingService.searchBookings(filters);

    res.json({
      ok: true,
      ...result,
    });

  } catch (error) {
    next(error);
  }
});

export default router;
