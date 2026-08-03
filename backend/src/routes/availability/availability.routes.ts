// lapa-casa-hostel/backend/src/routes/availability/availability.routes.ts
// ventana3

import { Router } from 'express';
import { checkAvailabilityHandler } from './check-availability';
import { roomAvailabilityHandler } from './room-availability';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import { availabilityService } from '../../services/availability-service';

const router = Router();

router.get('/check', checkAvailabilityHandler);

router.get('/room/:roomId', roomAvailabilityHandler);

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

    const days = await availabilityService.getDailyOccupancy(from, to);

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
