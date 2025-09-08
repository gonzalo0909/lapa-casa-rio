import { Router } from 'express';
import { StripeService } from '../../services/payments/stripe';
import { MercadoPagoService } from '../../services/payments/mercadopago';
import { PixService } from '../../services/payments/pix';
import { BookingService } from '../../core/booking';
import { validateBody } from '../../middleware/validation';
import { z } from 'zod';
import { logger } from '../../utils/logger';

const router = Router();

// Instanciar servicios
const stripeService = new StripeService();
const mpService = new MercadoPagoService();
const pixService = new PixService();
const bookingService = new BookingService();

// Schemas de validación
const paymentRequestSchema = z.object({
  bookingId: z.string(),
  method: z.enum(['stripe', 'mercadopago', 'pix']),
  guestInfo: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
});

/**
 * POST /api/payments/create
 * Crear sesión de pago unificada
 */
router.post('/create', validateBody(paymentRequestSchema), async (req, res, next) => {
  try {
    const { bookingId, method, guestInfo } = req.body;

    // Obtener datos del booking
    const booking = await bookingService.getBooking(bookingId);
    
    const paymentData = {
      bookingId,
      amount: parseFloat(booking.totalPrice.toString()),
      currency: 'BRL',
      guestEmail: guestInfo.email,
      guestName: guestInfo.name,
      description: `Reserva ${booking.beds.length} camas - ${booking.hombres + booking.mujeres} huéspedes`,
    };

    let result;

    switch (method) {
      case 'stripe':
        result = await stripeService.createCheckoutSession(paymentData);
        break;
        
      case 'mercadopago':
        result = await mpService.createPreference(paymentData);
        break;
        
      case 'pix':
        result = pixService.generatePixCode(paymentData);
        break;
        
      default:
        return res.status(400).json({
          ok: false,
          error: 'Invalid payment method',
        });
    }

    // Crear registro de pago en BD
    const prisma = bookingService['prisma'] || require('../../services/database').db.getClient();
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        method: method.toUpperCase(),
        status: 'PENDING',
        externalId: result.sessionId || result.preferenceId || null,
      },
    });

    res.json({
      ok: true,
      method,
      ...result,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/stripe/webhook
 * Webhook de Stripe
 */
router.post('/stripe/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const payload = JSON.stringify(req.body);

    const event = await stripeService.verifyWebhookSignature(payload, signature);
    const result = await stripeService.handleWebhookEvent(event);

    if (result.bookingId && result.status === 'completed') {
      await bookingService.updatePaymentStatus(result.bookingId, 'PAID');
      logger.info('Booking payment confirmed via Stripe', { bookingId: result.bookingId });
    }

    res.json({ received: true });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/mercadopago/webhook
 * Webhook de MercadoPago
 */
router.post('/mercadopago/webhook', async (req, res, next) => {
  try {
    const { id, topic } = req.body;
    
    const result = await mpService.handleWebhook({ id, topic });

    if (result.bookingId && result.status === 'approved') {
      await bookingService.updatePaymentStatus(result.bookingId, 'PAID');
      logger.info('Booking payment confirmed via MercadoPago', { bookingId: result.bookingId });
    }

    res.status(200).send('OK');

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/:paymentId/status
 * Verificar estado de pago
 */
router.get('/:paymentId/status', async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    
    // Buscar pago en BD
    const prisma = require('../../services/database').db.getClient();
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });

    if (!payment) {
      return res.status(404).json({
        ok: false,
        error: 'Payment not found',
      });
    }

    // Verificar estado actual según método
    let externalStatus;
    switch (payment.method) {
      case 'STRIPE':
        if (payment.externalId) {
          externalStatus = await stripeService.getPaymentDetails(payment.externalId);
        }
        break;
        
      case 'MERCADOPAGO':
        if (payment.externalId) {
          externalStatus = await mpService.getPaymentDetails(payment.externalId);
        }
        break;
        
      case 'PIX':
        // PIX verification logic
        break;
    }

    res.json({
      ok: true,
      payment: {
        id: payment.id,
        status: payment.status,
        method: payment.method,
        amount: payment.amount,
        bookingId: payment.booking.bookingId,
        externalStatus,
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/payments/:paymentId/refund
 * Procesar reembolso
 */
router.post('/:paymentId/refund', async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    const prisma = require('../../services/database').db.getClient();
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.status !== 'PAID') {
      return res.status(400).json({
        ok: false,
        error: 'Payment cannot be refunded',
      });
    }

    let refundResult;
    switch (payment.method) {
      case 'STRIPE':
        refundResult = await stripeService.createRefund(payment.externalId!, amount);
        break;
        
      case 'MERCADOPAGO':
        refundResult = await mpService.createRefund(payment.externalId!, amount);
        break;
        
      default:
        return res.status(400).json({
          ok: false,
          error: 'Refund not supported for this payment method',
        });
    }

    // Actualizar estado del pago
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED' },
    });

    logger.info('Payment refunded', { paymentId, refundId: refundResult.refundId, reason });

    res.json({
      ok: true,
      refund: refundResult,
    });

  } catch (error) {
    next(error);
  }
});

export default router;
