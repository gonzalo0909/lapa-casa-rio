// lapa-casa-hostel/backend/src/routes/availability/availability.routes.ts
// ventana3

import { Router } from 'express';
import { checkAvailabilityHandler } from './check-availability';
import { roomAvailabilityHandler } from './room-availability';
import { checkApartmentAvailabilityHandler } from './apartment-availability';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { availabilityService } from '../../services/availability-service';
import { pricingService } from '../../services/pricing-service';
import { query } from '../../config/database';

const router = Router();

router.get('/check', checkAvailabilityHandler);

/**
 * GET /availability/carnival-dates — fechas de Carnaval (system_config.carnival_dates),
 * expuesto público para que el calendario del motor de Apartamentos pueda pintar los
 * días de Carnaval antes de que el huésped elija fechas (ver frontend/src/lib/apartment-seasons.ts).
 */
router.get('/carnival-dates', async (req, res, next) => {
  try {
    const { rows } = await query<{ value: Array<{ year: number; start_date: string; end_date: string }> }>(
      `SELECT value FROM system_config WHERE key = 'carnival_dates'`
    );
    const dates = rows[0]?.value ?? [];

    res.status(200).json(ApiResponse.success({
      dates: dates.map(d => ({ year: d.year, startDate: d.start_date, endDate: d.end_date }))
    }, 'Carnival dates retrieved'));
  } catch (error) {
    logger.error('Error getting carnival dates', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

/** GET /availability/apartments — disponibilidad de los 10 apartamentos para un rango de fechas. */
router.get('/apartments', checkApartmentAvailabilityHandler);

router.get('/room/:roomId', roomAvailabilityHandler);

/**
 * POST /availability/quote — precio real (mismo camino que create-booking.ts,
 * pricingService.calculateTotalPrice) para los cuartos/camas que el huésped
 * ya eligió en el paso de reserva. El frontend antes recalculaba esto solo,
 * en el navegador, con un precio base fijo (60 BRL) y tramos de descuento
 * viejos -- ese numero podia no coincidir con lo que create-booking.ts
 * termina cobrando de verdad.
 */
router.post('/quote', async (req, res, next) => {
  try {
    const { checkIn, checkOut, rooms } = req.body as {
      checkIn?: string;
      checkOut?: string;
      rooms?: Array<{ roomId: string; bedsCount: number }>;
    };

    if (!checkIn || !checkOut || !rooms || rooms.length === 0) {
      res.status(400).json(ApiResponse.error('checkIn, checkOut y rooms (con al menos 1 cuarto) son requeridos'));
      return;
    }

    const totalBeds = rooms.reduce((sum, r) => sum + r.bedsCount, 0);
    const pricing = await pricingService.calculateTotalPrice({ checkInDate: checkIn, checkOutDate: checkOut, rooms, totalBeds });

    res.status(200).json(ApiResponse.success(pricing, 'Quote calculated'));
  } catch (error) {
    logger.error('Error calculating quote', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

router.get('/calendar', async (req, res, next) => {
  try {
    const { month, roomId } = req.query as { month?: string; roomId?: string };

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json(ApiResponse.error('month parameter required in YYYY-MM format'));
      return;
    }

    const [year, mon] = month.split('-').map(Number);
    const from = `${month}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, '0')}`;

    logger.info('Calendar availability request', { month, from, to, roomId });

    const days = await availabilityService.getDailyOccupancy(from, to, roomId);

    res.status(200).json(ApiResponse.success({
      month,
      roomId: roomId ?? 'all',
      from,
      to,
      days: days.map(d => ({
        date: d.date,
        availableBeds: d.available,
        occupiedBeds: d.occupied,
        totalBeds: d.total,
        occupancyRate: d.total > 0 ? Math.round((d.occupied / d.total) * 100) : 0
      }))
    }, 'Calendar availability retrieved'));
  } catch (error) {
    logger.error('Error getting calendar availability', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    if (!from || !to) {
      res.status(400).json(ApiResponse.error('from and to query parameters are required (YYYY-MM-DD)'));
      return;
    }

    logger.info('Availability summary request', { from, to });

    const days = await availabilityService.getDailyOccupancy(from, to);
    const totalBeds = days[0]?.total ?? 0;
    const avgOccupied = days.length > 0
      ? Math.round(days.reduce((s, d) => s + d.occupied, 0) / days.length)
      : 0;
    const averageOccupancy = totalBeds > 0
      ? Math.round((avgOccupied / totalBeds) * 100)
      : 0;

    const highDemandDates = days
      .filter(d => d.total > 0 && d.occupied / d.total >= 0.8)
      .map(d => d.date);

    const lowDemandDates = days
      .filter(d => d.total > 0 && d.occupied / d.total <= 0.3)
      .map(d => d.date);

    res.status(200).json(ApiResponse.success({
      period: { from, to },
      summary: {
        totalBeds,
        averageOccupancy,
        highDemandDates,
        lowDemandDates
      }
    }, 'Availability summary retrieved'));
  } catch (error) {
    logger.error('Error getting availability summary', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

export const availabilityRouter = router;
