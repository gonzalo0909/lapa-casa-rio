import { Router } from 'express';
import { db } from '../../services/database';
import { redis } from '../../services/redis';
import { HoldsService } from '../../services/holds';
import { InventoryService } from '../../core/inventory';
import { config } from '../../config';
import { UnauthorizedError } from '../../utils/errors';

const router = Router();
const holdsService = new HoldsService();
const inventoryService = new InventoryService();

// Middleware de autenticación simple
const authenticateAdmin = (req: any, res: any, next: any) => {
  const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token || token !== config.adminToken) {
    throw new UnauthorizedError('Invalid admin token');
  }
  
  next();
};

router.use(authenticateAdmin);

/**
 * GET /api/admin/health
 * Health check del sistema completo
 */
router.get('/health', async (req, res, next) => {
  try {
    const [dbHealth, redisHealth] = await Promise.all([
      db.healthCheck(),
      redis.healthCheck(),
    ]);

    const prisma = db.getClient();
    const [bookingCount, guestCount] = await Promise.all([
      prisma.booking.count(),
      prisma.guest.count(),
    ]);

    const holdStats = await holdsService.getHoldStats();

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth ? 'healthy' : 'unhealthy',
        redis: redisHealth ? 'healthy' : 'unhealthy',
      },
      stats: {
        totalBookings: bookingCount,
        totalGuests: guestCount,
        activeHolds: holdStats.active,
      },
      config: {
        environment: config.nodeEnv,
        holdTimeout: config.business.holdTimeoutMinutes,
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/holds
 * Listar todos los holds activos
 */
router.get('/holds', async (req, res, next) => {
  try {
    const holds = await holdsService.listActiveHolds();
    const stats = await holdsService.getHoldStats();

    res.json({
      ok: true,
      holds,
      stats,
      count: holds.length,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/holds/cleanup
 * Limpiar holds expirados manualmente
 */
router.delete('/holds/cleanup', async (req, res, next) => {
  try {
    const cleaned = await holdsService.cleanupExpiredHolds();
    const locksCleaned = await inventoryService.cleanupExpiredLocks();

    res.json({
      ok: true,
      holdsCleanedUp: cleaned,
      locksCleanedUp: locksCleaned,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/bookings
 * Búsqueda avanzada de reservas
 */
router.get('/bookings', async (req, res, next) => {
  try {
    const prisma = db.getClient();
    
    const filters: any = {};
    const { status, payStatus, from, to, email, page = 1, limit = 20 } = req.query;

    if (status) filters.status = status;
    if (payStatus) filters.payStatus = payStatus;
    
    if (email) {
      filters.guest = {
        email: { contains: email as string, mode: 'insensitive' },
      };
    }

    if (from || to) {
      filters.entrada = {};
      if (from) filters.entrada.gte = new Date(from as string + 'T00:00:00');
      if (to) filters.entrada.lte = new Date(to as string + 'T23:59:59');
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: filters,
        include: {
          guest: true,
          beds: {
            include: { room: true },
          },
          payments: true,
        },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.count({ where: filters }),
    ]);

    res.json({
      ok: true,
      bookings,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/occupancy
 * Estadísticas de ocupación
 */
router.get('/occupancy', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan parámetros from y to (YYYY-MM-DD)',
      });
    }

    const stats = await inventoryService.getOccupancyStats(from as string, to as string);

    res.json({
      ok: true,
      period: { from, to },
      ...stats,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/dashboard
 * Datos para dashboard principal
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const prisma = db.getClient();
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Ocupación hoy
    const todayOccupancy = await inventoryService.getOccupancyStats(today, tomorrow);
    
    // Reservas por estado
    const bookingStats = await prisma.booking.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    // Reservas por estado de pago
    const paymentStats = await prisma.booking.groupBy({
      by: ['payStatus'],
      _count: { payStatus: true },
    });

    // Reservas recientes (últimas 10)
    const recentBookings = await prisma.booking.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        guest: { select: { nombre: true, email: true } },
      },
    });

    // Check-ins de hoy
    const todayCheckIns = await prisma.booking.findMany({
      where: {
        entrada: {
          gte: new Date(today + 'T00:00:00'),
          lte: new Date(today + 'T23:59:59'),
        },
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
      include: {
        guest: { select: { nombre: true } },
        beds: true,
      },
    });

    // Check-outs de hoy
    const todayCheckOuts = await prisma.booking.findMany({
      where: {
        salida: {
          gte: new Date(today + 'T00:00:00'),
          lte: new Date(today + 'T23:59:59'),
        },
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
      include: {
        guest: { select: { nombre: true } },
        beds: true,
      },
    });

    // Holds activos
    const holdStats = await holdsService.getHoldStats();

    res.json({
      ok: true,
      today: {
        date: today,
        occupancy: todayOccupancy,
        checkIns: todayCheckIns,
        checkOuts: todayCheckOuts,
      },
      stats: {
        bookings: bookingStats.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {} as Record<string, number>),
        payments: paymentStats.reduce((acc, item) => {
          acc[item.payStatus] = item._count.payStatus;
          return acc;
        }, {} as Record<string, number>),
        holds: holdStats,
      },
      recent: {
        bookings: recentBookings,
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/booking/:bookingId/check-in
 * Marcar check-in
 */
router.post('/booking/:bookingId/check-in', async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const prisma = db.getClient();

    const booking = await prisma.booking.update({
      where: { bookingId },
      data: { status: 'CHECKED_IN' },
      include: { guest: true, beds: true },
    });

    res.json({
      ok: true,
      booking,
      message: 'Check-in realizado exitosamente',
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/booking/:bookingId/check-out
 * Marcar check-out
 */
router.post('/booking/:bookingId/check-out', async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const prisma = db.getClient();

    const booking = await prisma.booking.update({
      where: { bookingId },
      data: { status: 'CHECKED_OUT' },
      include: { guest: true, beds: true },
    });

    res.json({
      ok: true,
      booking,
      message: 'Check-out realizado exitosamente',
    });

  } catch (error) {
    next(error);
  }
});

export default router;
