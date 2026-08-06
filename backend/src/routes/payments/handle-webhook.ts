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
      // ventana6: la verificacion de firma de Stripe necesita los bytes
      // EXACTOS del body, no el objeto ya parseado por el express.json()
      // global de app.ts -- ese mismo parser guarda el buffer crudo en
      // req.rawBody antes de parsear (verify callback), igual que ya
      // hacen los webhooks de OTA (ver routes/webhooks/ota.routes.ts).
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (!rawBody) {
        logger.error('Stripe webhook sin rawBody -- no se puede verificar la firma');
        res.status(400).json({ error: 'Webhook inválido' });
        return;
      }
      let event;
      try {
        event = stripeHandler.constructWebhookEvent(rawBody, signature);
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
