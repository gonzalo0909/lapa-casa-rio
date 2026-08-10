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
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

const router = Router();

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
