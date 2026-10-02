//
// Espejo DB -> Google Sheets de una reserva. Se ejecuta directo (sin cola ni Redis),
// sin bloquear a quien lo llama: un fallo se loguea y no afecta a la reserva ni al pago.
// Si Google Sheets no esta configurado (ver sheets-client.ts), upsertBookingInSheet /
// deleteBookingFromSheet son no-ops que solo loguean.

import { upsertBookingInSheet, deleteBookingFromSheet } from '../integrations/google-sheets/booking-export';

/** Espeja la reserva en Sheets. Llamado desde booking-service.ts y payment-service.ts tras cada cambio persistido. */
export async function enqueueSheetsExport(reservationId: string, action: 'upsert' | 'delete' = 'upsert'): Promise<void> {
  if (action === 'delete') {
    await deleteBookingFromSheet(reservationId);
  } else {
    await upsertBookingInSheet(reservationId);
  }
}
