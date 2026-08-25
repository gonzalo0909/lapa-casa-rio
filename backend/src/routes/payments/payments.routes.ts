// lapa-casa-hostel/backend/src/routes/payments/payments.routes.ts
// ventana3

import { Router } from 'express';
import express from 'express';
import { createPaymentIntentHandler } from './create-payment-intent';
import { confirmPaymentHandler } from './confirm-payment';
import { processDepositHandler } from './process-deposit';
import { handleWebhookHandler } from './handle-webhook';
import { paymentService } from '../../services/payment-service';
import { bookingService } from '../../services/booking-service';
import { stripeHandler } from '../../lib/payments/stripe-handler';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const router = Router();

// POST /payments/stripe-wa-link — genera una Checkout Session sin reserva previa (flujo WhatsApp)
router.post('/stripe-wa-link', async (req, res, next) => {
  try {
    const { amountBRL, description, guestEmail, frontendUrl } = req.body as {
      amountBRL: number;
      description?: string;
      guestEmail?: string;
      frontendUrl?: string;
    };
    if (!amountBRL || amountBRL <= 0) {
      res.status(400).json(ApiResponse.error('amountBRL es requerido y debe ser mayor a 0'));
      return;
    }
    const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'https://lapacasario.com';
    const session = await stripeHandler.createCheckoutSession({
      amount: amountBRL,
      description: description || 'Depósito reserva — Lapa Casa Hostel',
      customerEmail: guestEmail || '',
      reservationId: `wa-${Date.now()}`,
      successUrl: `${baseUrl}/pt/hostel?paid=1`,
      cancelUrl:  `${baseUrl}/pt/hostel`,
      metadata: { source: 'whatsapp' },
    });
    logger.info('Stripe WA link generado', { amount: amountBRL, sessionId: session.sessionId });
    res.status(200).json(ApiResponse.success({ url: session.url }, 'Link de pago generado'));
  } catch (error) {
    logger.error('Error al generar Stripe WA link', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
});

// POST /payments/stripe-checkout — genera una Checkout Session de Stripe (pago con tarjeta)
router.post('/stripe-checkout', async (req, res, next) => {
  try {
    const { reservationId, frontendUrl } = req.body as { reservationId: string; frontendUrl?: string };
    if (!reservationId) {
      res.status(400).json(ApiResponse.error('reservationId es requerido'));
      return;
    }

    const booking = await bookingService.getBooking(reservationId);
    if (!booking) {
      res.status(404).json(ApiResponse.error('Reserva no encontrada', { reservationId }));
      return;
    }
    if (booking.status === 'cancelled') {
      res.status(400).json(ApiResponse.error('No se puede pagar una reserva cancelada'));
      return;
    }

    const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'https://lapacasario.com';
    const depositAmount = Number(booking.deposit_amount);
    const displayCode = `LCH-${reservationId.substring(0, 8).toUpperCase()}`;
    const guestEmail = booking.guest?.email ?? '';

    const session = await stripeHandler.createCheckoutSession({
      amount: depositAmount,
      description: `Depósito reserva ${displayCode} — Lapa Casa Hostel`,
      customerEmail: guestEmail,
      reservationId,
      successUrl: `${baseUrl}/pt/hostel?paid=1&booking=${reservationId}`,
      cancelUrl: `${baseUrl}/pt/hostel`,
    });

    logger.info('Stripe Checkout Session creada', { reservationId, sessionId: session.sessionId });
    res.status(200).json(ApiResponse.success({
      url: session.url,
      sessionId: session.sessionId,
      amount: depositAmount,
      currency: 'BRL',
    }, 'Checkout Session creada'));
  } catch (error) {
    logger.error('Error al crear Stripe Checkout Session', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next(error);
  }
});

// POST /payments/intent
router.post('/intent', createPaymentIntentHandler);

// POST /payments/confirm
router.post('/confirm', confirmPaymentHandler);

// POST /payments/deposit
router.post('/deposit', processDepositHandler);

// POST /payments/webhook/stripe
// ventana6: el `express.raw({ type: 'application/json' })` que estaba aca
// era inefectivo (bug real, no cosmetico) -- app.ts ya corre
// express.json() de forma GLOBAL para toda la app antes de que cualquier
// request llegue a este router, asi que el body ya viene consumido y
// parseado a objeto cuando llega aca. body-parser no vuelve a leer el
// stream una segunda vez, asi que este express.raw() nunca tenia chance
// de producir el Buffer que Stripe necesita para verificar la firma --
// en produccion, CUALQUIER webhook real de Stripe fallaba con "Webhook
// inválido" (confirmado con una request real contra este endpoint).
// El fix real es el mismo patron que ya usan los webhooks de OTA (ver
// routes/webhooks/ota.routes.ts): app.ts captura el body crudo en
// req.rawBody durante el parseo global (verify callback), y
// handle-webhook.ts usa ESE buffer para stripeHandler.constructWebhookEvent(),
// nunca req.body.
router.post(
  '/webhook/stripe',
  handleWebhookHandler
);

// POST /payments/webhook/mercadopago
// C-01: verificar firma HMAC-SHA256 del header X-Signature antes de procesar.
// Activar "Firma de notificaciones" en el dashboard de MP y configurar
// MP_WEBHOOK_SECRET en las variables de entorno de Render.
router.post(
  '/webhook/mercadopago',
  async (req, res, next) => {
    try {
      const secret = process.env.MP_WEBHOOK_SECRET;
      if (!secret) {
        // Sin secret configurado: rechazar en lugar de aceptar sin verificar
        logger.error('MP_WEBHOOK_SECRET no configurado — webhook rechazado');
        res.status(500).json({ error: 'Webhook not configured' });
        return;
      }

      // MP envía: X-Signature: ts=<timestamp>,v1=<hmac>
      const signatureHeader = req.headers['x-signature'] as string | undefined;
      if (!signatureHeader) {
        logger.warn('Webhook MP sin header X-Signature');
        res.status(401).json({ error: 'Missing signature' });
        return;
      }

      const tsMatch = signatureHeader.match(/ts=(\d+)/);
      const v1Match = signatureHeader.match(/v1=([a-f0-9]+)/);
      if (!tsMatch || !v1Match) {
        logger.warn('Webhook MP: formato de X-Signature inválido', { signatureHeader });
        res.status(401).json({ error: 'Invalid signature format' });
        return;
      }

      const ts = tsMatch[1];
      const receivedHmac = v1Match[1];
      const xRequestId = req.headers['x-request-id'] as string | undefined ?? '';

      // Según documentación MP: signed_template = "id:<id>;request-id:<req-id>;ts:<ts>;"
      const dataId = (req.body as any)?.data?.id ?? '';
      const signedPayload = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const expectedHmac = require('crypto')
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      const sigOk = require('crypto').timingSafeEqual(
        Buffer.from(receivedHmac),
        Buffer.from(expectedHmac),
      );

      if (!sigOk) {
        logger.warn('Webhook MP: firma inválida');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      logger.info('Webhook MercadoPago recibido y verificado', { body: req.body });
      await paymentService.handleMercadoPagoWebhook(req.body);
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Error en webhook MercadoPago', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(200).json({ received: true, error: 'Processing failed' });
    }
  }
);

// GET /payments/:id/status
router.get('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await paymentService.getPaymentById(id);
    if (!payment) {
      res.status(404).json(ApiResponse.error('Pago no encontrado', { paymentId: id }));
      return;
    }
    res.status(200).json(ApiResponse.success({
      id: payment.id,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      provider: payment.provider,
      paymentType: payment.payment_type,
      providerPaymentId: payment.provider_payment_id,
      paidAt: payment.paid_at,
      createdAt: payment.created_at,
    }, 'Estado del pago'));
  } catch (error) {
    next(error);
  }
});

// GET /payments/reservation/:reservationId
router.get('/reservation/:reservationId', async (req, res, next) => {
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
