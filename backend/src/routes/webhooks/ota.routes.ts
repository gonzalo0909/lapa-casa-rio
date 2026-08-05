// lapa-casa-hostel/backend/src/routes/webhooks/ota.routes.ts
// ventana5
//
// Webhooks de reservas OTA -- SOLO para los canales que realmente los
// ofrecen (REQUISITO CRITICO #4 / config/channels.ts WEBHOOK_CHANNELS):
// Booking.com y Expedia. Airbnb y Hostelworld son iCal-only a proposito:
// no existe (ni debe existir) un endpoint de webhook de reservas para
// ellos -- sus reservas y cancelaciones se detectan por importacion
// periodica de iCal (ver services/ical-service.ts).
//
// Contrato del payload (normalizado por este sistema, no es el formato
// nativo real de ninguna OTA -- cada integracion real se adaptaria al
// formato que la OTA entregue, pero la validacion/enrutamiento hacia
// channel-service.ts es igual para ambos canales):
//   {
//     "event": "booking.created" | "booking.modified" | "booking.cancelled",
//     "reservationId": "<external_reservation_id de la OTA>",
//     "roomId": "<nombre o codigo de habitacion, ver mapExternalRoomId>",
//     "guestName": "...", "guestEmail": "...",
//     "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD",
//     "bedsCount": 1
//   }
//
// Seguridad, en capas (todas obligatorias si el canal tiene el secret
// configurado -- ver config/environment.ts):
//   1. API key fija por header X-Api-Key
//   2. IP whitelist (X-Forwarded-For / req.ip, si esta configurada)
//   3. Firma HMAC-SHA256 (X-Signature, hex) sobre el body crudo
//      (req.rawBody, ver app.ts) con el secret del canal

import { Router, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { env } from '../../config/environment';
import { rateLimiter } from '../../middleware/rate-limiter';
import { verifyHmacSignature } from '../../utils/encryption';
import { channelService } from '../../services/channel-service';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';
import type { ChannelCode } from '../../types/database';

const router = Router();
const webhookLimiter = rateLimiter({ max: 120, windowMs: 60 * 1000 });

interface WebhookChannelConfig {
  channelCode: Extract<ChannelCode, 'booking' | 'expedia'>;
  secret: string;
  apiKey: string;
  allowedIps: string[];
}

const CHANNEL_CONFIGS: Record<'booking' | 'expedia', WebhookChannelConfig> = {
  booking: {
    channelCode: 'booking',
    secret: env.BOOKING_WEBHOOK_SECRET,
    apiKey: env.BOOKING_WEBHOOK_API_KEY,
    allowedIps: env.BOOKING_WEBHOOK_IPS.split(',').map((ip) => ip.trim()).filter(Boolean),
  },
  expedia: {
    channelCode: 'expedia',
    secret: env.EXPEDIA_WEBHOOK_SECRET,
    apiKey: env.EXPEDIA_WEBHOOK_API_KEY,
    allowedIps: env.EXPEDIA_WEBHOOK_IPS.split(',').map((ip) => ip.trim()).filter(Boolean),
  },
};

const OtaWebhookSchema = z
  .object({
    event: z.enum(['booking.created', 'booking.modified', 'booking.cancelled']),
    reservationId: z.string().min(1),
    roomId: z.string().min(1).optional(),
    guestName: z.string().min(1).optional(),
    guestEmail: z.string().email().optional(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    bedsCount: z.number().int().positive().max(45).optional(),
  })
  .refine(
    (data) => data.event === 'booking.cancelled' || Boolean(data.roomId && data.guestName && data.checkIn && data.checkOut),
    { message: 'roomId, guestName, checkIn y checkOut son requeridos salvo en booking.cancelled' }
  );

function verifyWebhookRequest(config: WebhookChannelConfig, req: Request): { ok: true } | { ok: false; status: number; reason: string } {
  if (!config.secret) {
    return { ok: false, status: 503, reason: `Webhook de "${config.channelCode}" no configurado (falta el secret)` };
  }

  const apiKey = req.headers['x-api-key'];
  if (config.apiKey && apiKey !== config.apiKey) {
    return { ok: false, status: 401, reason: 'API key inválida' };
  }

  if (config.allowedIps.length > 0 && !config.allowedIps.includes(req.ip ?? '')) {
    return { ok: false, status: 403, reason: `IP no autorizada: ${req.ip}` };
  }

  const signature = req.headers['x-signature'];
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (typeof signature !== 'string' || !rawBody) {
    return { ok: false, status: 401, reason: 'Falta la firma de la petición' };
  }
  try {
    if (!verifyHmacSignature(rawBody.toString('utf8'), signature, config.secret)) {
      return { ok: false, status: 401, reason: 'Firma inválida' };
    }
  } catch {
    return { ok: false, status: 401, reason: 'Firma inválida' };
  }

  return { ok: true };
}

async function handleOtaWebhook(config: WebhookChannelConfig, req: Request, res: Response): Promise<void> {
  const verification = verifyWebhookRequest(config, req);
  if (!verification.ok) {
    logger.warn('Webhook OTA rechazado', { channelCode: config.channelCode, reason: verification.reason });
    res.status(verification.status).json(ApiResponse.error(verification.reason));
    return;
  }

  try {
    const payload = OtaWebhookSchema.parse(req.body);

    const { rows: channelRows } = await query<{ id: string }>(`SELECT id FROM channels WHERE code = $1::channel_code`, [config.channelCode]);
    if (channelRows.length === 0) {
      res.status(500).json(ApiResponse.error(`Canal "${config.channelCode}" no encontrado en la base`));
      return;
    }
    const channelId = channelRows[0].id;

    if (payload.event === 'booking.cancelled') {
      const result = await channelService.handleChannelCancellation(payload.reservationId, channelId);
      logger.info('Webhook OTA: cancelación procesada', { channelCode: config.channelCode, reservationId: payload.reservationId, result });
      res.status(200).json(ApiResponse.success({ received: true, ...result }));
      return;
    }

    const result = await channelService.handleChannelBooking(
      {
        externalReservationId: payload.reservationId,
        roomExternalId: payload.roomId,
        guestName: payload.guestName!,
        guestEmail: payload.guestEmail,
        checkIn: payload.checkIn!,
        checkOut: payload.checkOut!,
        bedsCount: payload.bedsCount,
      },
      channelId
    );
    logger.info('Webhook OTA: reserva procesada', { channelCode: config.channelCode, reservationId: payload.reservationId, result });
    res.status(200).json(ApiResponse.success({ received: true, ...result }));
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json(ApiResponse.error('Payload inválido', error.errors));
      return;
    }
    // Se responde 200 igual que en los webhooks de pagos (handle-webhook.ts):
    // un 5xx haría que la OTA reintente indefinidamente el mismo evento ya
    // registrado en logs; el conflicto/rechazo de disponibilidad ya quedó
    // persistido en booking_conflicts si correspondía (channel-service.ts).
    logger.error('Error procesando webhook OTA', {
      channelCode: config.channelCode,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
    res.status(200).json(ApiResponse.success({ received: true, processed: false }));
  }
}

router.post('/booking', webhookLimiter, (req, res) => handleOtaWebhook(CHANNEL_CONFIGS.booking, req, res));
router.post('/expedia', webhookLimiter, (req, res) => handleOtaWebhook(CHANNEL_CONFIGS.expedia, req, res));

export default router;
export const otaWebhooksRouter = router;
