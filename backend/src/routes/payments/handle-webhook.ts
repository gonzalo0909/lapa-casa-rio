// lapa-casa-hostel/backend/src/routes/payments/handle-webhook.ts
//
// FIX (auditoría de seguridad 2026-08-30): este handler solo está montado
// en POST /payments/webhook/stripe (ver payments.routes.ts), pero antes
// aceptaba un query param `?provider=mercadopago` que lo desviaba a
// paymentService.handleMercadoPagoWebhook(req.body) SIN verificar ninguna
// firma -- bypass completo del HMAC que sí exige la ruta real y correcta
// /payments/webhook/mercadopago (misma archivo, ver payments.routes.ts).
// Se elimina esa rama: este handler procesa exclusivamente Stripe.

import type { Request, Response, NextFunction } from 'express';
import { paymentService } from '../../services/payment-service';
import { stripeHandler } from '../../lib/payments/stripe-handler';
import { logger } from '../../utils/logger';
import { ApiResponse } from '../../utils/responses';

export const handleWebhookHandler = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      res.status(400).json(ApiResponse.error('Falta stripe-signature'));
      return;
    }
    // La verificación de firma de Stripe necesita los bytes
    // EXACTOS del body, no el objeto ya parseado por el express.json()
    // global de app.ts -- ese mismo parser guarda el buffer crudo en
    // req.rawBody antes de parsear (verify callback), igual que ya
    // hacen los webhooks de OTA (ver routes/webhooks/ota.routes.ts).
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      logger.error('Stripe webhook sin rawBody -- no se puede verificar la firma');
      res.status(400).json(ApiResponse.error('Webhook inválido'));
      return;
    }
    let event;
    try {
      event = stripeHandler.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      logger.warn('Stripe webhook inválido', { err: (err as Error).message });
      res.status(400).json(ApiResponse.error('Webhook inválido'));
      return;
    }
    await paymentService.handleStripeWebhook(event);

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error al procesar webhook de Stripe', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Devolvemos 200 para evitar reintentos del proveedor
    res.status(200).json({ received: true, error: 'Processing failed' });
  }
};
