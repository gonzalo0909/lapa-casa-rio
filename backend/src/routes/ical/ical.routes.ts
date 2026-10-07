//
// Reescrito completo. La version anterior no estaba montada en
// routes/index.ts (nunca respondia a ningun request real) e importaba
// `authenticate` de middleware/auth.ts, que no existe (el real es
// `authenticateToken`) -- bug conocido,
// junto con requireRole(...) recibiendo un string suelto en vez de
// string[]. Tambien consultaba una tabla `ical_feeds` que nunca existio
// en el schema real -- los feeds configurados viven en `system_config`
// (ver services/ical-service.ts).

import { randomBytes, timingSafeEqual } from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/environment';
import { query } from '../../config/database';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rate-limiter';
import { DuplicateFeedError, icalService } from '../../services/ical-service';
import { ApiResponse } from '../../utils/responses';

const router = Router();
const exportLimiter = rateLimiter({ max: 600, windowMs: 60 * 60 * 1000, prefix: 'ical-export' });

const CreateFeedSchema = z.object({
  channelCode: z.enum(['direct', 'booking', 'hostelworld', 'airbnb', 'expedia']),
  roomTypeId: z.string().uuid(),
  url: z.string().url(),
});

const UpdateFeedSchema = z.object({
  url: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

/** Las URLs de exportacion exigen ?token=ICAL_EXPORT_TOKEN: sin token valido no se revela nada. */
function requireExportToken(req: Request, res: Response, next: NextFunction): void {
  if (!env.ICAL_EXPORT_TOKEN) {
    res.status(503).json(ApiResponse.error('Exportación iCal no configurada (falta ICAL_EXPORT_TOKEN)'));
    return;
  }
  // El token puede ir en la ruta (/feed/:token/...) o en ?token=: algunas OTAs (Booking) no aceptan bien
  // URLs con parámetros de consulta.
  const rawToken = typeof req.params.token === 'string' ? req.params.token : req.query.token;
  const given = Buffer.from(typeof rawToken === 'string' ? rawToken : '');
  const expected = Buffer.from(env.ICAL_EXPORT_TOKEN);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    res.status(404).json(ApiResponse.error('No encontrado'));
    return;
  }
  next();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Feeds de UN apartamento: se valida con el token PROPIO del apartamento (room_types.ical_export_token)
 * si tiene uno; si no, con el global ICAL_EXPORT_TOKEN. Así regenerar el enlace de un apartamento
 * invalida el anterior solo para ese apartamento.
 */
async function requireApartmentExportToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roomTypeId = req.params.roomTypeId;
    const rawToken = typeof req.params.token === 'string' ? req.params.token : req.query.token;
    const given = typeof rawToken === 'string' ? rawToken : '';
    if (!roomTypeId || !UUID_RE.test(roomTypeId) || !given) {
      res.status(404).json(ApiResponse.error('No encontrado'));
      return;
    }
    const { rows } = await query<{ ical_export_token: string | null }>(
      `SELECT ical_export_token FROM room_types WHERE id = $1 AND property_type = 'apartment'`,
      [roomTypeId],
    );
    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('No encontrado'));
      return;
    }
    const own = rows[0]!.ical_export_token;
    const expected = own || env.ICAL_EXPORT_TOKEN;
    if (!expected) {
      res.status(503).json(ApiResponse.error('Exportación iCal no configurada (falta ICAL_EXPORT_TOKEN)'));
      return;
    }
    if (!safeEqual(given, expected)) {
      res.status(404).json(ApiResponse.error('No encontrado'));
      return;
    }
    next();
  } catch (error) {
    res.status(500).json(ApiResponse.error('Error validando el token', error instanceof Error ? error.message : 'Error desconocido'));
  }
}

const ChannelQuerySchema = z.enum(['direct', 'booking', 'hostelworld', 'airbnb', 'expedia']).optional();

/** ?channel=booking: el feed omite las reservas que vinieron de ese canal (evita el eco OTA -> Lapa -> OTA). */
const channelOf = (req: Request) => ChannelQuerySchema.parse(req.params.channel ?? req.query.channel);

function sendCalendar(res: Response, filename: string, calendar: string): void {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.send(calendar);
}

/** GET /api/ical/export/:roomId — feed iCal publico de disponibilidad de UNA habitacion (room_types.id real). */
router.get('/export/:roomId', exportLimiter, requireExportToken, async (req, res) => {
  try {
    const calendar = await icalService.generateICalFeed(req.params.roomId, channelOf(req));
    sendCalendar(res, `room-${req.params.roomId}.ics`, calendar);
  } catch (error) {
    res.status(404).json(ApiResponse.error('No se pudo generar el feed', error instanceof Error ? error.message : 'Error desconocido'));
  }
});

/** GET /api/ical/export — feed iCal publico combinado con las 5 habitaciones reales. */
router.get('/export', exportLimiter, requireExportToken, async (req, res) => {
  try {
    const calendar = await icalService.generateAllFeeds(channelOf(req));
    sendCalendar(res, 'lapa-casa-hostel-all-rooms.ics', calendar);
  } catch (error) {
    res.status(500).json(ApiResponse.error('No se pudo generar el feed combinado', error instanceof Error ? error.message : 'Error desconocido'));
  }
});

/** GET /api/ical/apartment/export/:roomTypeId — feed iCal público de UN apartamento. */
router.get('/apartment/export/:roomTypeId', exportLimiter, requireApartmentExportToken, async (req, res) => {
  try {
    const calendar = await icalService.generateApartmentICalFeed(req.params.roomTypeId, channelOf(req));
    sendCalendar(res, `apartment-${req.params.roomTypeId}.ics`, calendar);
  } catch (error) {
    res.status(404).json(ApiResponse.error('No se pudo generar el feed', error instanceof Error ? error.message : 'Error desconocido'));
  }
});

/**
 * GET /api/ical/apartment/feed/:token/:roomTypeId/:channel.ics — mismo feed de UN apartamento, pero con
 * token y canal en la RUTA (sin ?query) y terminado en .ics. Es la forma más aceptada por los validadores
 * de Booking.com, que dejaban el enlace con query en "Comprobando conexión".
 */
router.get('/apartment/feed/:token/:roomTypeId/:channel.ics', exportLimiter, requireApartmentExportToken, async (req, res) => {
  try {
    const calendar = await icalService.generateApartmentICalFeed(req.params.roomTypeId, channelOf(req));
    sendCalendar(res, `apartment-${req.params.roomTypeId}.ics`, calendar);
  } catch (error) {
    res.status(404).json(ApiResponse.error('No se pudo generar el feed', error instanceof Error ? error.message : 'Error desconocido'));
  }
});

/** GET /api/ical/apartment/export — feed iCal público combinado de todos los apartamentos. */
router.get('/apartment/export', exportLimiter, requireExportToken, async (req, res) => {
  try {
    const calendar = await icalService.generateAllApartmentFeeds(channelOf(req));
    sendCalendar(res, 'lapa-casa-apartamentos.ics', calendar);
  } catch (error) {
    res.status(500).json(ApiResponse.error('No se pudo generar el feed combinado', error instanceof Error ? error.message : 'Error desconocido'));
  }
});

/** GET /api/ical/export-token — token que el panel admin agrega a las URLs de exportacion. */
router.get('/export-token', authenticateToken, requireRole(['admin']), (_req, res) => {
  res.status(200).json(ApiResponse.success({ token: env.ICAL_EXPORT_TOKEN || null }));
});

/** GET /api/ical/apartment-tokens — token efectivo de cada apartamento (propio si tiene, si no el global). */
router.get('/apartment-tokens', authenticateToken, requireRole(['admin']), async (_req, res, next) => {
  try {
    const { rows } = await query<{ id: string; ical_export_token: string | null }>(
      `SELECT id, ical_export_token FROM room_types WHERE property_type = 'apartment'`,
    );
    const tokens: Record<string, string | null> = {};
    for (const r of rows) {tokens[r.id] = r.ical_export_token || env.ICAL_EXPORT_TOKEN || null;}
    res.status(200).json(ApiResponse.success({ tokens }));
  } catch (error) {
    next(error);
  }
});

/** POST /api/ical/apartment/:roomTypeId/regenerate-token — genera un token nuevo SOLO para este apartamento. */
router.post('/apartment/:roomTypeId/regenerate-token', authenticateToken, requireRole(['admin']), async (req, res, next) => {
  try {
    const roomTypeId = req.params.roomTypeId;
    if (!roomTypeId || !UUID_RE.test(roomTypeId)) {
      res.status(400).json(ApiResponse.error('roomTypeId inválido'));
      return;
    }
    const token = randomBytes(32).toString('hex');
    const { rows } = await query(
      `UPDATE room_types SET ical_export_token = $1, updated_at = now()
       WHERE id = $2 AND property_type = 'apartment' RETURNING id`,
      [token, roomTypeId],
    );
    if (rows.length === 0) {
      res.status(404).json(ApiResponse.error('Apartamento no encontrado'));
      return;
    }
    res.status(200).json(ApiResponse.success({ roomTypeId, token }, 'Enlace regenerado: el anterior dejó de funcionar'));
  } catch (error) {
    next(error);
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
    if (error instanceof DuplicateFeedError) {
      res.status(409).json(ApiResponse.error(error.message));
      return;
    }
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
    const result = await icalService.deleteFeed(req.params.id);
    if (!result) {
      res.status(404).json(ApiResponse.error('Feed no encontrado'));
      return;
    }
    res.status(200).json(ApiResponse.success({ deleted: true, orphanedReservations: result.orphanedReservations }, 'Feed eliminado'));
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
    const [feeds, syncStatus, feedStatus] = await Promise.all([
      icalService.listFeeds(),
      icalService.getSyncStatus(),
      icalService.getFeedStatuses(),
    ]);
    res.status(200).json(ApiResponse.success({ feeds, syncStatus, feedStatus }));
  } catch (error) {
    next(error);
  }
});

export default router;
export const icalRouter = router;
