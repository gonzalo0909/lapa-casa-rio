// lapa-casa-hostel/backend/src/integrations/google-sheets/booking-export.ts
// ventana4 (bloque 2)
//
// Reemplaza a booking-sync.ts (schema viejo, tabla `rooms` inexistente,
// nunca probado). Sentido único DB -> Sheets: la base es la fuente de
// verdad, la hoja es un espejo de reporting. A propósito NO existe acá
// ningún método que lea de Sheets y escriba en la base -- el archivo
// anterior tenía uno (syncFromSheets) que violaba directamente el
// criterio de aceptación "un cambio manual en la hoja no se refleja en
// la base de datos".

import { query } from '../../config/database';
import { sheetsClient } from './sheets-client';
import { formatBookingForSheet, type RawBookingExportRow } from './data-formatter';
import { logger } from '../../utils/logger';

async function fetchBookingRow(reservationId: string): Promise<RawBookingExportRow | null> {
  const { rows } = await query<RawBookingExportRow>(
    `SELECT
       r.id,
       g.full_name AS guest_name,
       g.email AS guest_email,
       g.phone AS guest_phone,
       r.check_in_date,
       r.check_out_date,
       (SELECT string_agg(DISTINCT rt.name, ', ' ORDER BY rt.name)
          FROM reservation_beds rb
          JOIN beds b ON b.id = rb.bed_id
          JOIN room_types rt ON rt.id = b.room_type_id
          WHERE rb.reservation_id = r.id) AS room_assigned,
       r.beds_count,
       r.final_price,
       COALESCE((SELECT SUM(amount) FROM payments WHERE reservation_id = r.id AND payment_type = 'deposit' AND status = 'succeeded'), 0) AS deposit_paid,
       COALESCE((SELECT SUM(amount) FROM payments WHERE reservation_id = r.id AND payment_type = 'remaining' AND status = 'succeeded'), 0) AS remaining_paid,
       r.status,
       r.created_at,
       r.special_requests
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     WHERE r.id = $1`,
    [reservationId]
  );
  return rows[0] ?? null;
}

/** Crea o actualiza la fila de una reserva en la hoja. No-op silencioso si Sheets no está configurado. */
export async function upsertBookingInSheet(reservationId: string): Promise<void> {
  if (!sheetsClient.isEnabled()) {
    logger.warn('Google Sheets no configurado, export omitido', { reservationId });
    return;
  }

  const raw = await fetchBookingRow(reservationId);
  if (!raw) {
    logger.warn('upsertBookingInSheet: reserva no encontrada, se omite', { reservationId });
    return;
  }

  await sheetsClient.initializeSheet();
  const rowData = formatBookingForSheet(raw);
  const existingRow = await sheetsClient.findRowByBookingId(reservationId);

  if (existingRow) {
    await sheetsClient.updateRow(existingRow, rowData);
  } else {
    await sheetsClient.appendRow(rowData);
  }
}

/** Quita la fila de una reserva de la hoja (ej. si se decide no reportarla más). No-op si no está configurado o no existe la fila. */
export async function deleteBookingFromSheet(reservationId: string): Promise<void> {
  if (!sheetsClient.isEnabled()) {
    logger.warn('Google Sheets no configurado, delete omitido', { reservationId });
    return;
  }

  const rowIndex = await sheetsClient.findRowByBookingId(reservationId);
  if (rowIndex) await sheetsClient.deleteRow(rowIndex);
}

/** Exporta todas las reservas activas (confirmed/pending_payment/completed) -- usado por el sync manual desde el panel admin. */
export async function fullExport(): Promise<{ exported: number; errors: string[] }> {
  const errors: string[] = [];
  let exported = 0;

  if (!sheetsClient.isEnabled()) {
    return { exported: 0, errors: ['Google Sheets no configurado'] };
  }

  // ventana4: sin filtro de status a propósito -- la hoja es un espejo de
  // reporting completo (incluye canceladas/no_show con su status real en
  // la columna L), no solo reservas activas.
  await sheetsClient.initializeSheet();
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM reservations ORDER BY created_at`
  );

  for (const row of rows) {
    try {
      await upsertBookingInSheet(row.id);
      exported++;
    } catch (error: any) {
      errors.push(`${row.id}: ${error.message}`);
    }
  }

  return { exported, errors };
}
