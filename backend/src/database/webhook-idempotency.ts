// Idempotencia de webhooks de pago -- ver migración 0047_processed_webhook_events.sql.
// El constraint único (provider, event_id) es la fuente de verdad: si el
// INSERT falla por duplicado (23505), el evento ya fue procesado antes y
// no debe reprocesarse.

import { query } from '../config/database';

const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string })?.code === '23505';

/** true si es la primera vez que se ve este evento (hay que procesarlo), false si ya estaba registrado. */
export const tryMarkWebhookProcessed = async (
  provider: 'stripe' | 'mercadopago',
  eventId: string,
): Promise<boolean> => {
  try {
    await query(
      `INSERT INTO processed_webhook_events (provider, event_id) VALUES ($1, $2)`,
      [provider, eventId],
    );
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return false;
    }
    throw error;
  }
};
