// lapa-casa-hostel/backend/src/routes/payments/handle-webhook.ts
// ventana3

import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { stripeHandler } from '../../lib/payments/stripe-handler';
import { logger } from '../../utils/logger';

export const handleWebhookHandler = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const provider = (req.query.provider as string) || 'stripe';

  try {
    if (provider === 'stripe') {
      const signature = req.headers['stripe-signature'] as string;
      if (!signature) {
        res.status(400).json({ error: 'Falta stripe-signature' });
        return;
      }
      let event;
      try {
        event = stripeHandler.constructWebhookEvent(req.body, signature);
      } catch (err) {
        logger.warn('Stripe webhook inválido', { err: (err as Error).message });
        res.status(400).json({ error: 'Webhook inválido' });
        return;
      }
      await paymentService.handleStripeWebhook(event);
    } else if (provider === 'mercadopago') {
      await paymentService.handleMercadoPagoWebhook(req.body);
    } else {
      res.status(400).json({ error: 'Proveedor desconocido' });
      return;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error al procesar webhook', {
      provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Devolvemos 200 para evitar reintentos del proveedor
    res.status(200).json({ received: true, error: 'Processing failed' });
  }
};
