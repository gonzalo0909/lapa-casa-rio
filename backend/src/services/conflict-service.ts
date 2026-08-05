// lapa-casa-hostel/backend/src/services/conflict-service.ts
// ventana5
//
// REQUISITO CRITICO #1: el constraint EXCLUDE (0003_exclude_constraint.sql)
// es la autoridad final -- dos reservas realmente superpuestas sobre la
// MISMA cama nunca pueden coexistir en `reservation_beds`. Por eso un
// "conflicto entre canales" no es algo que se descubra escaneando datos
// ya persistidos: se produce en el momento en que channel-service.ts
// intenta insertar una reserva de OTA y no encuentra cama libre (o el
// INSERT es rechazado por el EXCLUDE/trigger bajo una carrera) -- ese
// intento se persiste aca via recordConflict(), con `rejected_payload`
// guardando los datos del intento que nunca llego a existir como fila
// real (booking_conflicts.reservation_id_b queda NULL en ese caso).
//
// detectConflicts() cumple dos roles:
//   1) chequeo defensivo (deberia dar siempre 0): confirma que no existe
//      ninguna superposicion ilegal en la misma cama -- si aparece una,
//      algo bypasseo la aplicacion (edicion manual de la base, etc.) y
//      se registra igual para que quede auditado.
//   2) recorre los conflictos con status='open' y los resuelve por
//      prioridad de canal (autoResolveByPriority), para el worker
//      programado -- la resolucion manual admin sigue disponible via
//      resolveConflict() para lo que la prioridad automatica no alcanza.

import { query } from '../config/database';
import { emailService } from './email-service';
import { CHANNEL_PRIORITY } from '../config/channels';
import { logger } from '../utils/logger';
import type { ChannelCode } from '../types/database';

export type ConflictStatus = 'open' | 'resolved_auto' | 'resolved_manual';
export type ConflictResolutionAction = 'keep_ota' | 'keep_direct' | 'keep_oldest';

export interface BookingConflictRow {
  id: string;
  reservation_id_a: string;
  reservation_id_b: string | null;
  bed_id: string | null;
  channel_a: ChannelCode;
  channel_b: ChannelCode | null;
  status: ConflictStatus;
  rejected_payload: Record<string, unknown> | null;
  detected_at: Date;
  resolved_at: Date | null;
  resolution_notes: string | null;
  created_at: Date;
}

export interface RecordConflictInput {
  reservationIdA: string;
  reservationIdB?: string | null;
  bedId?: string | null;
  channelA: ChannelCode;
  channelB?: ChannelCode | null;
  rejectedPayload?: Record<string, unknown> | null;
}

const priorityOf = (channel: ChannelCode | null | undefined): number =>
  channel ? (CHANNEL_PRIORITY[channel] ?? 0) : -1;

async function notifyConflict(conflict: BookingConflictRow): Promise<void> {
  await emailService.sendAdminAlert('Conflicto de reserva (overbooking) detectado', {
    conflictId: conflict.id,
    reservationA: conflict.reservation_id_a,
    reservationB: conflict.reservation_id_b ?? '(ninguna — intento rechazado)',
    channelA: conflict.channel_a,
    channelB: conflict.channel_b ?? '—',
    detectedAt: conflict.detected_at.toISOString(),
  });
}

/** Persiste un conflicto detectado y notifica al admin. Llamado por channel-service.ts al fallar un intento de reserva OTA. */
async function recordConflict(input: RecordConflictInput): Promise<BookingConflictRow> {
  const { rows } = await query<BookingConflictRow>(
    `INSERT INTO booking_conflicts (reservation_id_a, reservation_id_b, bed_id, channel_a, channel_b, rejected_payload)
     VALUES ($1, $2, $3, $4::channel_code, $5::channel_code, $6::jsonb)
     RETURNING *`,
    [
      input.reservationIdA,
      input.reservationIdB ?? null,
      input.bedId ?? null,
      input.channelA,
      input.channelB ?? null,
      input.rejectedPayload ? JSON.stringify(input.rejectedPayload) : null,
    ]
  );
  const conflict = rows[0];
  logger.warn('Conflicto de reserva registrado', { conflictId: conflict.id, channelA: conflict.channel_a, channelB: conflict.channel_b });
  await notifyConflict(conflict).catch((error) =>
    logger.warn('No se pudo notificar el conflicto por email', { conflictId: conflict.id, error: error.message })
  );
  return conflict;
}

async function getConflictById(id: string): Promise<BookingConflictRow | null> {
  const { rows } = await query<BookingConflictRow>(`SELECT * FROM booking_conflicts WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

async function getConflictHistory(filters: { status?: ConflictStatus } = {}): Promise<BookingConflictRow[]> {
  const params: unknown[] = [];
  let where = '';
  if (filters.status) {
    params.push(filters.status);
    where = `WHERE status = $1::conflict_status`;
  }
  const { rows } = await query<BookingConflictRow>(
    `SELECT * FROM booking_conflicts ${where} ORDER BY detected_at DESC LIMIT 200`,
    params
  );
  return rows;
}

async function cancelReservation(reservationId: string, reason: string): Promise<void> {
  await query(
    `UPDATE reservations SET status = 'cancelled', cancelled_at = now(), cancellation_reason = $2
     WHERE id = $1 AND status <> 'cancelled'`,
    [reservationId, reason]
  );
}

async function getReservationCreatedAt(reservationId: string): Promise<Date | null> {
  const { rows } = await query<{ created_at: Date }>(`SELECT created_at FROM reservations WHERE id = $1`, [reservationId]);
  return rows[0]?.created_at ?? null;
}

async function getReservationChannelCode(reservationId: string): Promise<ChannelCode> {
  const { rows } = await query<{ code: ChannelCode }>(
    `SELECT c.code FROM reservations r JOIN channels c ON c.id = r.channel_id WHERE r.id = $1`,
    [reservationId]
  );
  return rows[0].code;
}

/** Resolucion manual desde el panel admin (routes/admin/conflicts.ts). */
async function resolveConflict(conflictId: string, action: ConflictResolutionAction, reason: string): Promise<BookingConflictRow> {
  const conflict = await getConflictById(conflictId);
  if (!conflict) throw new Error('Conflicto no encontrado');
  if (conflict.status !== 'open') throw new Error(`El conflicto ya fue resuelto (${conflict.status})`);

  const bExists = Boolean(conflict.reservation_id_b);
  let notes = reason;

  if (action === 'keep_oldest') {
    if (bExists) {
      const [createdA, createdB] = await Promise.all([
        getReservationCreatedAt(conflict.reservation_id_a),
        getReservationCreatedAt(conflict.reservation_id_b!),
      ]);
      const bIsOlder = (createdB ?? new Date(0)) < (createdA ?? new Date(0));
      const loserId = bIsOlder ? conflict.reservation_id_a : conflict.reservation_id_b!;
      await cancelReservation(loserId, `conflict_resolved:${action}`);
    } else {
      notes += ' (sin segunda reserva persistida — el intento rechazado se descarta, nada que cancelar)';
    }
  } else if (action === 'keep_direct') {
    if (conflict.channel_a !== 'direct' ) {
      await cancelReservation(conflict.reservation_id_a, `conflict_resolved:${action}`);
    } else if (bExists && conflict.channel_b !== 'direct') {
      await cancelReservation(conflict.reservation_id_b!, `conflict_resolved:${action}`);
    } else {
      notes += ' (ninguna de las reservas es del canal directo)';
    }
  } else if (action === 'keep_ota') {
    if (conflict.channel_a === 'direct') {
      await cancelReservation(conflict.reservation_id_a, `conflict_resolved:${action}`);
      if (!bExists) notes += ' (el intento OTA nunca se persistió — requiere recrearse manualmente si aún hay disponibilidad)';
    } else if (bExists && conflict.channel_b === 'direct') {
      await cancelReservation(conflict.reservation_id_b!, `conflict_resolved:${action}`);
    } else {
      notes += ' (ninguna de las reservas es del canal directo)';
    }
  }

  const { rows } = await query<BookingConflictRow>(
    `UPDATE booking_conflicts SET status = 'resolved_manual', resolved_at = now(), resolution_notes = $2 WHERE id = $1 RETURNING *`,
    [conflictId, notes]
  );
  return rows[0];
}

/** Resolucion automatica por prioridad de canal (CHANNEL_PRIORITY, config/channels.ts). Usada por el worker programado. */
async function autoResolveByPriority(conflict: BookingConflictRow): Promise<BookingConflictRow> {
  if (conflict.status !== 'open') return conflict;

  const aWins = priorityOf(conflict.channel_a) >= priorityOf(conflict.channel_b);
  let notes: string;

  if (aWins) {
    if (conflict.reservation_id_b) await cancelReservation(conflict.reservation_id_b, 'conflict_auto_resolved:keep_a');
    notes = `Resuelto automáticamente por prioridad de canal: se mantiene "${conflict.channel_a}"`;
  } else {
    await cancelReservation(conflict.reservation_id_a, 'conflict_auto_resolved:keep_b');
    notes = conflict.reservation_id_b
      ? `Resuelto automáticamente por prioridad de canal: se mantiene "${conflict.channel_b}"`
      : `Resuelto automáticamente por prioridad de canal: se canceló "${conflict.channel_a}"; el intento de "${conflict.channel_b}" debe recrearse manualmente si aún hay disponibilidad`;
  }

  const { rows } = await query<BookingConflictRow>(
    `UPDATE booking_conflicts SET status = 'resolved_auto', resolved_at = now(), resolution_notes = $2 WHERE id = $1 RETURNING *`,
    [conflict.id, notes]
  );
  return rows[0];
}

/**
 * 1) Escaneo defensivo de superposiciones ilegales en la misma cama
 * (nunca deberían existir gracias al EXCLUDE constraint; si aparecen,
 * quedan igual registradas para auditoría).
 * 2) Auto-resuelve por prioridad de canal los conflictos que ya estén
 * abiertos (creados en tiempo real por channel-service.ts).
 */
async function detectConflicts(): Promise<{ newlyDetected: number; autoResolved: number; stillOpen: number }> {
  const { rows: overlaps } = await query<{ id_a: string; id_b: string; bed_id: string }>(
    `SELECT rb1.reservation_id AS id_a, rb2.reservation_id AS id_b, rb1.bed_id
     FROM reservation_beds rb1
     JOIN reservation_beds rb2
       ON rb2.bed_id = rb1.bed_id
      AND rb2.reservation_id > rb1.reservation_id
      AND daterange(rb1.check_in, rb1.check_out, '[)') && daterange(rb2.check_in, rb2.check_out, '[)')
     JOIN reservations ra ON ra.id = rb1.reservation_id AND ra.status IN ('confirmed', 'pending_payment', 'pending_ota_confirmation')
     JOIN reservations rb ON rb.id = rb2.reservation_id AND rb.status IN ('confirmed', 'pending_payment', 'pending_ota_confirmation')`
  );

  let newlyDetected = 0;
  for (const overlap of overlaps) {
    const { rows: existing } = await query(
      `SELECT id FROM booking_conflicts
       WHERE (reservation_id_a = $1 AND reservation_id_b = $2) OR (reservation_id_a = $2 AND reservation_id_b = $1)`,
      [overlap.id_a, overlap.id_b]
    );
    if (existing.length > 0) continue;

    const [channelA, channelB] = await Promise.all([
      getReservationChannelCode(overlap.id_a),
      getReservationChannelCode(overlap.id_b),
    ]);
    logger.error('Superposición ilegal detectada en la misma cama (bypass fuera de la app)', { bedId: overlap.bed_id, idA: overlap.id_a, idB: overlap.id_b });
    await recordConflict({ reservationIdA: overlap.id_a, reservationIdB: overlap.id_b, bedId: overlap.bed_id, channelA, channelB });
    newlyDetected++;
  }

  const open = await getConflictHistory({ status: 'open' });
  let autoResolved = 0;
  for (const conflict of open) {
    await autoResolveByPriority(conflict);
    autoResolved++;
  }

  return { newlyDetected, autoResolved, stillOpen: open.length - autoResolved };
}

export const conflictService = {
  recordConflict,
  notifyConflict,
  getConflictById,
  getConflictHistory,
  resolveConflict,
  autoResolveByPriority,
  detectConflicts,
};
