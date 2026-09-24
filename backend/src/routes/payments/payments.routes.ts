// 0021: agrega release-deposit y mark-received-at-desk (Stripe Connect + InfinityPay)

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { validate } from '../../middleware/validation';
import { createPaymentIntentHandler } from './create-payment-intent';
import { confirmPaymentHandler } from './confirm-payment';
import { processDepositHandler } from './process-deposit';
import { depositMpCardHandler } from './deposit-mp-card';
import { apartmentProcessDepositHandler } from './apartment-process-deposit';
import { apartmentDepositMpCardHandler } from './apartment-deposit-mp-card';
import { handleWebhookHandler } from './handle-webhook';
import releaseDepositRouter from './release-deposit';
import markReceivedAtDeskRouter from './mark-received-at-desk';
import { query } from '../../config/database';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { groupPaymentService } from '../../services/group-payment-service';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { generateConfirmationToken } from '../../utils/confirmation-token';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

// Middleware: verifies confirmationToken against the booking's reservationId.
// Reads reservationId from req.body; token from req.body.confirmationToken.
const verifyBookingToken = (req: Request, res: Response, next: NextFunction): void => {
  const { reservationId, confirmationToken } = req.body as Record<string, string | undefined>;
  if (!reservationId || !confirmationToken || confirmationToken !== generateConfirmationToken(reservationId)) {
    res.status(403).json(ApiResponse.error('Invalid or missing confirmation token'));
    return;
  }
  next();
};

const router = Router();

const StripeWaLinkSchema = z.object({
  amountBRL: z.number().positive(),
  description: z.string().trim().min(1).max(500).optional(),
  guestEmail: z.string().trim().email().optional(),
  frontendUrl: z.string().trim().url().optional(),
});

const StripeCheckoutSchema = z.object({
  reservationId: z.string().trim().min(1),
  confirmationToken: z.string().trim().min(1),
  frontendUrl: z.string().trim().url().optional(),
});

const GroupSessionSchema = z.object({
  checkIn: z.string().trim().min(1),
  checkOut: z.string().trim().min(1),
  totalBeds: z.number().int().min(2, 'El pago grupal requiere al menos 2 camas'),
  nights: z.number().int().positive(),
  guestGender: z.enum(['mixed', 'female', 'male']).optional(),
  titular: z.object({
    full_name: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: z.string().trim().optional(),
    country: z.string().trim().optional(),
    language: z.string().trim().optional(),
  }),
  specialRequests: z.string().trim().optional(),
  appBaseUrl: z.string().trim().url().optional(),
});

const GroupClaimPaySchema = z.object({
  guest: z.object({
    full_name: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: z.string().trim().optional(),
    country: z.string().trim().optional(),
    language: z.string().trim().optional(),
  }),
  paymentMethod: z.enum(['card', 'pix']),
  documentPhotoBase64: z.string().trim().min(1, 'La foto del documento es obligatoria'),
});

// POST /payments/stripe-wa-link — genera una Checkout Session sin reserva previa (flujo WhatsApp)
// Solo staff/admin pueden generar estos links de pago arbitrarios
router.post('/stripe-wa-link', authenticateToken, requireRole(['admin', 'staff']), validate(StripeWaLinkSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof StripeWaLinkSchema>;
    const result = await paymentService.createWhatsappCheckoutLink(data);
    res.status(200).json(ApiResponse.success(result, 'Link de pago generado'));
  } catch (error) {
    logger.error('Error al generar Stripe WA link', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
});

// POST /payments/stripe-checkout — genera una Checkout Session de Stripe (pago con tarjeta)
router.post('/stripe-checkout', verifyBookingToken, validate(StripeCheckoutSchema), async (req, res, next) => {
  try {
    const { reservationId, frontendUrl } = req.body as z.infer<typeof StripeCheckoutSchema>;

    const booking = await bookingService.getBooking(reservationId);
    if (!booking) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada', { reservationId }));
      return;
    }
    if (booking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('No se puede pagar una reserva cancelada'));
      return;
    }

    const result = await paymentService.createBookingCheckoutSession(booking, frontendUrl);
    res.status(200).json(ApiResponse.success(result, 'Checkout Session creada'));
  } catch (error) {
    logger.error('Error al crear Stripe Checkout Session', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
});

// GET /payments/surcharge — devuelve el card_surcharge_percent de system_config
router.get('/surcharge', async (_req, res, next) => {
  try {
    const { rows } = await query<{ value: number }>(
      `SELECT value FROM system_config WHERE key = 'card_surcharge_percent'`
    );
    res.json(ApiResponse.success({ cardSurchargePercent: rows[0]?.value ?? 0 }));
  } catch (error) {
    next(error);
  }
});

// POST /payments/intent
router.post('/intent', verifyBookingToken, createPaymentIntentHandler);

// POST /payments/confirm — verifies token using reservationId from body
router.post('/confirm', verifyBookingToken, confirmPaymentHandler);

// POST /payments/deposit
router.post('/deposit', verifyBookingToken, processDepositHandler);

// POST /payments/deposit-mp-card — pago con tarjeta brasileña via MP (token del SDK)
router.post('/deposit-mp-card', verifyBookingToken, depositMpCardHandler);

// ── Apartamentos (motor separado del hostel) ─────────────────────────────────

// POST /payments/apartments/deposit — depósito PIX o Stripe para apartamentos
router.post('/apartments/deposit', verifyBookingToken, apartmentProcessDepositHandler);

// POST /payments/apartments/deposit-mp-card — tarjeta BR via MP para apartamentos
router.post('/apartments/deposit-mp-card', verifyBookingToken, apartmentDepositMpCardHandler);

// ── Pago Grupal (Feature 2) ──────────────────────────────────────────────────

// POST /payments/group-session — el titular crea la sesión grupal
router.post('/group-session', validate(GroupSessionSchema), async (req, res, next) => {
  try {
    const {
      checkIn, checkOut, totalBeds, nights, guestGender,
      titular, specialRequests, appBaseUrl
    } = req.body as z.infer<typeof GroupSessionSchema>;

    // La página /group-payment/:token la sirve el backend, no el frontend
    const baseUrl = appBaseUrl || process.env.APP_URL || 'https://api.lapacasario.com';
    const result = await groupPaymentService.createGroupSession({
      checkIn, checkOut, totalBeds, nights,
      guestGender: guestGender ?? 'mixed',
      titular, specialRequests, appBaseUrl: baseUrl,
    });

    // result.token es la credencial bearer del titular (URL /group-payment/:token,
    // sin login) -- se trunca en el log por la misma razón que memberToken más abajo.
    logger.info('Sesión de pago grupal creada', {
      sessionId: result.sessionId, tokenPrefix: result.token.slice(0, 8), totalBeds,
    });
    res.status(201).json(ApiResponse.success(result, 'Sesión de pago grupal creada'));
  } catch (error) {
    logger.error('Error al crear sesión de pago grupal', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
});

// GET /payments/group/:token — estado general de la sesión (vista del titular)
router.get('/group/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const status = await groupPaymentService.getSessionStatus(token);
    if (!status.found) {
      res.status(404).json(ApiResponse.error('Sesión de pago no encontrada'));
      return;
    }
    res.status(200).json(ApiResponse.success(status, 'Estado de sesión grupal'));
  } catch (error) {
    next(error);
  }
});

// POST /payments/group/:token/pay — un invitado reclama el próximo cupo
// libre de la sesión (mismo link para todos) y paga su cama. Requiere foto
// del documento.
router.post('/group/:token/pay', validate(GroupClaimPaySchema), async (req, res, next) => {
  try {
    const { token } = req.params;
    const { guest, paymentMethod, documentPhotoBase64 } = req.body as z.infer<typeof GroupClaimPaySchema>;

    const result = await groupPaymentService.claimAndPaySlot({
      sessionToken: token, guest, paymentMethod, documentPhotoBase64,
    });
    // token es una credencial bearer -- quien lo tiene puede pagar en esta
    // sesión sin ningún otro login. Se trunca a un prefijo en el log para
    // no convertir el log en un vector de robo.
    logger.info('Pago de invitado grupal iniciado', {
      tokenPrefix: token.slice(0, 8),
      memberId: result.memberId,
      paymentMethod,
    });
    res.status(200).json(ApiResponse.success(result, 'Pago iniciado'));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('expiró') || msg.includes('cerrada') || msg.includes('no quedan camas')) {
      res.status(409).json(ApiResponse.error(msg));
      return;
    }
    logger.error('Error al iniciar pago de invitado grupal', { error: msg });
    next(error);
  }
});

// POST /payments/release-deposit — libera el 25% retenido al admin del apt (solo admin)
router.use('/release-deposit', releaseDepositRouter);

// POST /payments/mark-received-at-desk — registra pago físico InfinityPay/efectivo (solo admin)
router.use('/mark-received-at-desk', markReceivedAtDeskRouter);

// POST /payments/webhook/stripe
router.post(
  '/webhook/stripe',
  handleWebhookHandler
);

// Shared handler para webhooks de MercadoPago — usado por hostel y apartamentos.
// MP envía al mismo handler lógico; la separación de rutas sólo permite
// pasar notification_url distintos por pago (ver apartment-process-deposit.ts).
async function mpWebhookHandler(req: any, res: any): Promise<void> {
  try {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('MP_WEBHOOK_SECRET no configurado — webhook rechazado');
      res.status(500).json(ApiResponse.error('Webhook not configured'));
      return;
    }

    const signatureHeader = req.headers['x-signature'] as string | undefined;
    if (!signatureHeader) {
      logger.warn('Webhook MP sin header X-Signature');
      res.status(401).json(ApiResponse.error('Missing signature'));
      return;
    }

    const tsMatch = signatureHeader.match(/ts=(\d+)/);
    const v1Match = signatureHeader.match(/v1=([a-f0-9]+)/);
    if (!tsMatch || !v1Match) {
      logger.warn('Webhook MP: formato de X-Signature inválido', { signatureHeader });
      res.status(401).json(ApiResponse.error('Invalid signature format'));
      return;
    }

    const ts = tsMatch[1];
    const receivedHmac = v1Match[1];
    const xRequestId = req.headers['x-request-id'] as string | undefined ?? '';

    const dataId = (req.body as any)?.data?.id ?? '';
    const signedPayload = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expectedHmac = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // timingSafeEqual() explota con RangeError si los buffers tienen largo
    // distinto -- un v1= con longitud inválida (no son 64 chars hex de un
    // sha256) debe responder 401 acá, no caer al catch genérico que
    // devuelve 200 y deja pasar el webhook sin verificar.
    if (receivedHmac.length !== expectedHmac.length) {
      logger.warn('Webhook MP: firma con longitud inválida');
      res.status(401).json(ApiResponse.error('Invalid signature'));
      return;
    }

    const sigOk = timingSafeEqual(
      Buffer.from(receivedHmac),
      Buffer.from(expectedHmac),
    );

    if (!sigOk) {
      logger.warn('Webhook MP: firma inválida');
      res.status(401).json(ApiResponse.error('Invalid signature'));
      return;
    }

    logger.info('Webhook MercadoPago recibido y verificado', {
      type: (req.body as any)?.type,
      dataId,
    });
    await paymentService.handleMercadoPagoWebhook(req.body);
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error en webhook MercadoPago', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(200).json({ received: true, error: 'Processing failed' });
  }
}

// POST /payments/webhook/mercadopago — hostel
router.post('/webhook/mercadopago', mpWebhookHandler);

// POST /payments/apartments/webhook/mercadopago — apartamentos
router.post('/apartments/webhook/mercadopago', mpWebhookHandler);

// GET /payments/:id/status — requires reservationId + token as query params
router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reservationId, token } = req.query as Record<string, string | undefined>;

    if (!reservationId || !token || token !== generateConfirmationToken(reservationId)) {
      res.status(403).json(ApiResponse.error('Invalid or missing confirmation token'));
      return;
    }

    const payment = await paymentService.getPaymentById(id);
    if (!payment) {
      res.status(404).json(ApiResponse.error('Pago no encontrado', { paymentId: id }));
      return;
    }
    if (payment.reservation_id !== reservationId) {
      res.status(403).json(ApiResponse.error('Token does not match this payment'));
      return;
    }
    res.status(200).json(ApiResponse.success({
      id: payment.id,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      provider: payment.provider,
      paymentType: payment.payment_type,
      paidAt: payment.paid_at,
      createdAt: payment.created_at,
    }, 'Estado del pago'));
  } catch (error) {
    next(error);
  }
});

// GET /payments/reservation/:reservationId (admin/staff only)
router.get('/reservation/:reservationId', authenticateToken, requireRole(['admin', 'staff']), async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const booking = await bookingService.getBooking(reservationId);
    if (!booking) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada', { reservationId }));
      return;
    }
    const payments = await paymentService.getPaymentsByReservation(reservationId);
    const totalPaid = payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPending = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    res.status(200).json(ApiResponse.success({
      reservationId,
      payments,
      totalPaid,
      totalPending,
      remainingBalance: Number(booking.final_price) - totalPaid,
      currency: 'BRL',
    }, 'Historial de pagos'));
  } catch (error) {
    next(error);
  }
});

export const paymentsRouter = router;
