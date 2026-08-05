// lapa-casa-hostel/backend/src/routes/ical/ical.routes.ts
// ventana5
//
// Reescrito completo. La version anterior no estaba montada en
// routes/index.ts (nunca respondia a ningun request real) e importaba
// `authenticate` de middleware/auth.ts, que no existe (el real es
// `authenticateToken`) -- bug ya señalado en el prompt de esta ventana,
// junto con requireRole(...) recibiendo un string suelto en vez de
// string[]. Tambien consultaba una tabla `ical_feeds` que nunca existio
// en el schema real -- los feeds configurados viven en `system_config`
// (ver services/ical-service.ts).

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rate-limiter';
import { icalService } from '../../services/ical-service';
import { ApiResponse } from '../../utils/responses';

const router = Router();
const exportLimiter = rateLimiter({ max: 100, windowMs: 60 * 60 * 1000 });

const CreateFeedSchema = z.object({
  channelCode: z.enum(['direct', 'booking', 'hostelworld', 'airbnb', 'expedia']),
  roomTypeId: z.string().uuid(),
  url: z.string().url(),
});

const UpdateFeedSchema = z.object({
  url: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

function sendCalendar(res: import('express').Response, filename: string, calendar: string): void {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.send(calendar);
}

/** GET /api/ical/export/:roomId — feed iCal publico de disponibilidad de UNA habitacion (room_types.id real). */
router.get('/export/:roomId', exportLimiter, async (req, res) => {
  try {
    const calendar = await icalService.generateICalFeed(req.params.roomId);
    sendCalendar(res, `room-${req.params.roomId}.ics`, calendar);
  } catch (error) {
    res.status(404).json(ApiResponse.error('No se pudo generar el feed', error instanceof Error ? error.message : 'Error desconocido'));
  }
});

/** GET /api/ical/export — feed iCal publico combinado con las 5 habitaciones reales. */
router.get('/export', exportLimiter, async (_req, res) => {
  try {
    const calendar = await icalService.generateAllFeeds();
    sendCalendar(res, 'lapa-casa-hostel-all-rooms.ics', calendar);
  } catch (error) {
    res.status(500).json(ApiResponse.error('No se pudo generar el feed combinado', error instanceof Error ? error.message : 'Error desconocido'));
  }
});

/** GET /api/ical/feeds — feeds de importacion configurados (admin). */
router.get('/feeds', authenticateToken, requireRole(['admin']), async (_req, res, next) => {
  try {
    const feeds = await icalService.listFeeds();
    res.status(200).json(ApiResponse.success({ feeds }));
  } catch (error) {
    next(error);
  }
});

/** POST /api/ical/import/config — configura una URL de feed a importar (Airbnb, Hostelworld, o respaldo Booking/Expedia). */
router.post('/import/config', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const data = CreateFeedSchema.parse(req.body);
    const feed = await icalService.addFeed(data);
    res.status(201).json(ApiResponse.success({ feed }, 'Feed configurado'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json(ApiResponse.error('Validation error', error.errors));
      return;
    }
    next(error);
  }
});

/** PATCH /api/ical/feeds/:id — editar URL / activar-desactivar un feed configurado. */
router.patch('/feeds/:id', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const data = UpdateFeedSchema.parse(req.body);
    const feed = await icalService.updateFeed(req.params.id, data);
    if (!feed) {
      res.status(404).json(ApiResponse.error('Feed no encontrado'));
      return;
    }
    res.status(200).json(ApiResponse.success({ feed }, 'Feed actualizado'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json(ApiResponse.error('Validation error', error.errors));
      return;
    }
    next(error);
  }
});

/** DELETE /api/ical/feeds/:id */
router.delete('/feeds/:id', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const deleted = await icalService.deleteFeed(req.params.id);
    if (!deleted) {
      res.status(404).json(ApiResponse.error('Feed no encontrado'));
      return;
    }
    res.status(200).json(ApiResponse.success({ deleted: true }, 'Feed eliminado'));
  } catch (error) {
    next(error);
  }
});

/** POST /api/ical/sync — fuerza sincronizacion manual de todos los feeds configurados. */
router.post('/sync', authenticateToken, requireRole(['admin']), async (_req, res, next) => {
  try {
    const result = await icalService.syncICalFeeds();
    res.status(200).json(ApiResponse.success(result, 'Sincronización completada'));
  } catch (error) {
    next(error);
  }
});

/** GET /api/ical/status — estado de la ultima sincronizacion por canal + feeds configurados. */
router.get('/status', authenticateToken, requireRole(['admin']), async (_req, res, next) => {
  try {
    const [feeds, syncStatus] = await Promise.all([icalService.listFeeds(), icalService.getSyncStatus()]);
    res.status(200).json(ApiResponse.success({ feeds, syncStatus }));
  } catch (error) {
    next(error);
  }
});

export default router;
export const icalRouter = router;
