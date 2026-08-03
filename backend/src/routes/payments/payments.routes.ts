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

// POST /payments/webhook/stripe  — requiere raw body
router.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  handleWebhookHandler
);

// POST /payments/webhook/mercadopago
router.post(
  '/webhook/mercadopago',
  express.json(),
  async (req, res, next) => {
    try {
      logger.info('Webhook MercadoPago recibido', { body: req.body });
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
