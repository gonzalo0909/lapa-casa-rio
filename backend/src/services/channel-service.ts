//
// Reservas entrantes de OTA (via webhook para Booking.com/Expedia, via
// iCal para Airbnb/Hostelworld) pasan por el MISMO motor anti-overbooking
// que booking-service.createBooking() (Requisito Critico #1):
// elegir camas candidatas -> acquire_bed_locks() -> re-verificar bajo
// lock -> INSERT, todo dentro de la misma transaccion. La diferencia es
// el status inicial ('pending_ota_confirmation' en vez de
// 'pending_payment') y que no hay pago propio (deposito/saldo en 0 --
// la OTA cobra al huesped, no este sistema).
//
// Deduplicacion webhook vs iCal reimportado (Booking.com, que tiene
// ambos): se resuelve por el indice unico real
// `idx_reservations_external_unique` (channel_id, external_reservation_id),
// 0002_tables.sql -- handleChannelBooking primero chequea si ya existe
// antes de intentar insertar de nuevo.
//
// Si no hay cama disponible (u ocurre una carrera y el INSERT es
// rechazado por el EXCLUDE/trigger), se registra un conflicto real en
// booking_conflicts via conflict-service.ts, referenciando la reserva
// que efectivamente esta ocupando la cama.

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../config/database';
import guestRepo from '../database/repositories/guest-repository';
import { acquireLock } from '../database/lock-middleware';
import { insertUnitBlock, isApartmentRoomType, isUnitOccupied } from './apartment-unit';
import { conflictService } from './conflict-service';
import { emailService } from './email-service';
import { resolveRoomCodeFromName } from '../config/channels';
import { logger } from '../utils/logger';
import type { ChannelCode } from '../types/database';

export class OtaAvailabilityError extends Error {
  constructor(public readonly details: unknown) {
    super('No hay camas suficientes disponibles para las fechas solicitadas (reserva OTA)');
    this.name = 'OtaAvailabilityError';
  }
}

const isOverbookingError = (error: unknown): boolean => {
  const code = (error as { code?: string })?.code;
  // 23505 = unique_violation (trg_prevent_overbooking), 23P01 = exclusion_violation (constraint EXCLUDE)
  return code === '23505' || code === '23P01';
};

// LCH = hostel, LCA = apartamentos (mismo criterio que las reservas directas).
const generateReservationNumber = (prefix: 'LCH' | 'LCA'): string =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

interface RoomTypeRow {
  id: string;
  code: string;
  name: string;
}

interface ChannelRow {
  id: string;
  code: ChannelCode;
  name: string;
  commission_rate: number;
  has_webhook: boolean;
  ical_enabled: boolean;
  is_active: boolean;
}

export interface IncomingOtaBooking {
  externalReservationId: string;
  /** UUID real de room_types, si ya se resolvio (ej. viene de un feed iCal ya configurado con su room_type). */
  roomTypeId?: string;
  /** Identificador o nombre libre de habitacion tal como lo manda la OTA (webhook), a resolver via mapExternalRoomId. */
  roomExternalId?: string;
  guestName: string;
  guestEmail?: string;
  checkIn: string;
  checkOut: string;
  bedsCount?: number;
  guestGender?: 'male' | 'female' | 'mixed';
  /** De donde llega: el webhook trae el id real de la OTA, el iCal solo el UID del evento. */
  source?: 'webhook' | 'ical';
  /** iCal: ids de todos los eventos de la lectura actual (para reconocer una estadia con fechas cambiadas). */
  feedExternalIds?: string[];
  /** Cierre del propietario en la OTA (no es un huesped): se guarda sin precio y fuera de las estadisticas. */
  ownerBlock?: boolean;
}

export interface ChannelBookingResult {
  reservationId: string;
  deduplicated: boolean;
  /** true si la reserva ya existia y la OTA cambio sus fechas (se actualizaron aca). */
  updated?: boolean;
  /**
   * Si la reserva ya existia bajo OTRO id externo (misma estadia llegada por webhook e iCal), el id con el
   * que esta guardada. Quien sincroniza feeds lo cuenta como "visto" para no cancelarla por ausencia.
   */
  matchedExternalId?: string;
}

export interface ChannelCancellationResult {
  found: boolean;
  alreadyCancelled?: boolean;
  reservationId?: string;
}

export interface ChannelStats {
  totalBookings: number;
  confirmedBookings: number;
  pendingConfirmation: number;
  cancelledBookings: number;
  grossRevenue: number;
  netRevenue: number;
}

async function getChannelById(channelId: string): Promise<ChannelRow> {
  const { rows } = await query<ChannelRow>(`SELECT * FROM channels WHERE id = $1`, [channelId]);
  if (rows.length === 0) {throw new Error(`Canal no encontrado: ${channelId}`);}
  return rows[0];
}

async function getRoomTypeById(roomTypeId: string): Promise<RoomTypeRow | null> {
  const { rows } = await query<RoomTypeRow>(`SELECT id, code, name FROM room_types WHERE id = $1`, [roomTypeId]);
  return rows[0] ?? null;
}

/** Mapea un ID/nombre externo de habitacion de OTA al room_type real, por UUID, `code` exacto, o alias de nombre (config/channels.ts). */
async function mapExternalRoomId(externalRoomIdOrName: string, channelId?: string): Promise<RoomTypeRow | null> {
  if (!externalRoomIdOrName) {return null;}

  // 1) Buscar en la tabla de mapeos por canal (más específico)
  if (channelId) {
    const { rows: mapped } = await query<RoomTypeRow>(
      `SELECT rt.id, rt.code, rt.name
       FROM channel_room_mappings crm
       JOIN room_types rt ON rt.id = crm.room_type_id
       WHERE crm.channel_id = $1 AND crm.external_room_id = $2`,
      [channelId, externalRoomIdOrName]
    );
    if (mapped.length > 0) {return mapped[0];}
  }

  // 2) Intentar match directo por UUID o code
  const { rows: direct } = await query<RoomTypeRow>(
    `SELECT id, code, name FROM room_types WHERE id::text = $1 OR code = $1`,
    [externalRoomIdOrName]
  );
  if (direct.length > 0) {return direct[0];}

  // 3) Fallback: resolver por nombre libre
  const code = resolveRoomCodeFromName(externalRoomIdOrName);
  if (!code) {return null;}
  const { rows } = await query<RoomTypeRow>(`SELECT id, code, name FROM room_types WHERE code = $1`, [code]);
  return rows[0] ?? null;
}

/** Selecciona `count` camas libres y elegibles por genero, bajo la transaccion activa (misma logica que booking-service.ts). */
async function pickAvailableBedsInRoom(
  client: PoolClient,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  count: number,
  gender: 'mixed' | 'female' | 'male'
): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT bed_id FROM check_availability($1::date, $2::date, $3::bed_gender)
     WHERE room_type_id = $4::uuid AND is_gender_eligible = true AND is_available = true
     LIMIT $5`,
    [checkIn, checkOut, gender, roomTypeId, count]
  );
  return rows.map((r: { bed_id: string }) => r.bed_id);
}

/** Camas activas sin reserva superpuesta, ignorando bloqueos manuales (room_blocks) y género. Solo para importar reservas de OTA. */
async function pickBedsIgnoringManualBlocks(
  client: PoolClient,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
  count: number
): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT b.id AS bed_id
       FROM beds b
      WHERE b.room_type_id = $1::uuid
        AND b.is_active
        AND NOT EXISTS (
          SELECT 1 FROM reservation_beds rb
           WHERE rb.bed_id = b.id
             AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')
        )
      ORDER BY b.bed_code
      LIMIT $4`,
    [roomTypeId, checkIn, checkOut, count]
  );
  return rows.map((r: { bed_id: string }) => r.bed_id);
}

/**
 * Un apartamento es una unidad: en un mismo canal no puede haber dos reservas activas con las mismas
 * fechas. Booking/Expedia mandan la reserva por webhook (con su numero) y de nuevo en el iCal (con el UID
 * del evento, que NO es ese numero): sin esto la segunda se rechaza como superposicion y deja un conflicto
 * falso. Solo apartamentos: en un dormitorio varias reservas de la misma OTA pueden compartir fechas.
 */
async function findSameStayReservation(
  roomTypeId: string,
  channelId: string,
  checkIn: string,
  checkOut: string,
  externalReservationId: string
): Promise<{ id: string; externalId: string } | null> {
  const { rows } = await query<{ id: string; external_reservation_id: string }>(
    `SELECT r.id, r.external_reservation_id
     FROM reservations r
     JOIN reservation_beds rb ON rb.reservation_id = r.id
     JOIN room_types rt ON rt.id = rb.room_type_id
     WHERE rb.room_type_id = $1 AND rt.property_type = 'apartment'
       AND r.channel_id = $2
       AND r.status IN ('confirmed', 'pending_ota_confirmation')
       AND r.check_in_date = $3::date AND r.check_out_date = $4::date
       AND r.external_reservation_id IS NOT NULL AND r.external_reservation_id <> $5
     ORDER BY r.created_at ASC
     LIMIT 1`,
    [roomTypeId, channelId, checkIn, checkOut, externalReservationId]
  );
  return rows[0] ? { id: rows[0].id, externalId: rows[0].external_reservation_id } : null;
}

/** Misma regla que isUnitOccupied (apartment-unit.ts): cualquier reserva no cancelada ocupa la unidad, tambien no_show y completed. */
/**
 * Apartamento, mismo canal, fechas que SE SUPERPONEN y un id externo que ya no esta en el feed actual: la OTA
 * no permite dos reservas superpuestas de la misma unidad, asi que es la misma estadia con otras fechas.
 */
async function findShiftedStayReservations(
  roomTypeId: string,
  channelId: string,
  checkIn: string,
  checkOut: string,
  feedExternalIds: string[],
  exceptReservationId?: string
): Promise<Array<{ id: string; externalId: string }>> {
  const { rows } = await query<{ id: string; external_reservation_id: string }>(
    `SELECT DISTINCT r.id, r.external_reservation_id, r.created_at
     FROM reservations r
     JOIN reservation_beds rb ON rb.reservation_id = r.id
     JOIN room_types rt ON rt.id = rb.room_type_id
     WHERE rb.room_type_id = $1 AND rt.property_type = 'apartment'
       AND r.channel_id = $2
       AND r.status IN ('confirmed', 'pending_ota_confirmation')
       AND daterange(rb.check_in, rb.check_out, '[)') && daterange($3::date, $4::date, '[)')
       AND r.external_reservation_id IS NOT NULL
       AND NOT (r.external_reservation_id = ANY($5::text[]))
       AND ($6::uuid IS NULL OR r.id <> $6::uuid)
     ORDER BY r.created_at ASC`,
    [roomTypeId, channelId, checkIn, checkOut, feedExternalIds, exceptReservationId ?? null]
  );
  return rows.map((r) => ({ id: r.id, externalId: r.external_reservation_id }));
}

/**
 * Booking junta las estadias pegadas (una sale el dia que entra la otra) en UN solo evento, y le cambia el UID/fechas.
 * Lapa las tenia guardadas por separado: ninguna coincide con el evento nuevo y el cambio de fechas choca con la otra.
 * Las reservas guardadas que se superponen con el evento y ya no figuran en el feed son pedazos viejos de esa misma
 * estadia: se cancelan para que la que sobrevive pueda tomar las fechas completas.
 */
async function cancelStaleOverlapping(ids: string[]): Promise<void> {
  for (const id of ids) {
    await query(
      `UPDATE reservations SET status = 'cancelled', cancelled_at = now(), cancellation_reason = 'ota_cancellation' WHERE id = $1`,
      [id]
    );
    logger.info('Reserva OTA reemplazada por un evento que junta varias estadias', { reservationId: id });
  }
}

async function findBlockingReservation(
  roomTypeId: string,
  checkIn: string,
  checkOut: string
): Promise<{ id: string; channelCode: ChannelCode; coversWholeStay: boolean } | null> {
  const { rows } = await query<{ id: string; channel_code: ChannelCode; covers: boolean }>(
    `SELECT r.id, c.code AS channel_code,
            (rb.check_in <= $2::date AND rb.check_out >= $3::date) AS covers
     FROM reservation_beds rb
     JOIN reservations r ON r.id = rb.reservation_id
     JOIN channels c ON c.id = r.channel_id
     WHERE rb.room_type_id = $1
       AND r.status <> 'cancelled'
       AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')
     ORDER BY r.created_at ASC
     LIMIT 1`,
    [roomTypeId, checkIn, checkOut]
  );
  if (rows.length === 0) {return null;}
  return { id: rows[0].id, channelCode: rows[0].channel_code, coversWholeStay: rows[0].covers };
}

async function alertUnplacedOtaBooking(
  roomTypeId: string,
  bookingData: IncomingOtaBooking,
  channelCode: ChannelCode,
  channelId: string
): Promise<void> {
  const key = `ota_unplaced:${channelId}:${bookingData.externalReservationId}:${bookingData.checkIn}:${bookingData.checkOut}`.slice(0, 250);
  const { rows } = await query(
    `INSERT INTO system_config (key, value, description)
     VALUES ($1, $2::jsonb, 'Reserva OTA rechazada sin bloqueador (ya avisada al admin)')
     ON CONFLICT (key) DO NOTHING RETURNING key`,
    [key, JSON.stringify({ roomTypeId, channelCode, detectedAt: new Date().toISOString() })]
  );
  if (rows.length === 0) {return;} // ya se aviso
  await emailService
    .sendAdminAlert('Reserva de OTA rechazada sin reserva que la bloquee', {
      canal: channelCode,
      habitacion: roomTypeId,
      reservaExterna: bookingData.externalReservationId,
      entrada: bookingData.checkIn,
      salida: bookingData.checkOut,
      huesped: bookingData.guestName,
      motivo: 'No hay lugar para esta reserva y no se encontró ninguna reserva que la bloquee: revisar la disponibilidad a mano',
    })
    .catch((error) => logger.warn('No se pudo avisar la reserva OTA sin bloqueador', { error: error instanceof Error ? error.message : String(error) }));
}

/** Check-in en los proximos 2 dias: no se espera para avisar, un overbooking real ya es urgente. */
const isUrgentCheckIn = (checkIn: string): boolean => new Date(checkIn).getTime() - Date.now() <= 2 * 24 * 60 * 60 * 1000;

async function recordAvailabilityConflict(
  roomTypeId: string,
  bookingData: IncomingOtaBooking,
  incomingChannelCode: ChannelCode,
  channelId: string
): Promise<void> {
  const blocker = await findBlockingReservation(roomTypeId, bookingData.checkIn, bookingData.checkOut);
  if (!blocker) {
    // No hay ninguna reserva real bloqueando -- no es un conflicto entre canales, sino que
    // se pidieron mas camas de las que la habitacion tiene fisicamente. booking_conflicts.reservation_id_a
    // es NOT NULL (siempre debe referenciar una reserva real), asi que no se puede registrar ahi.
    // Antes quedaba solo en el log y la reserva de la OTA se perdia sin que nadie lo supiera: se avisa
    // al admin por email, una sola vez por evento (el feed lo repite en cada sync, cada 5 min).
    logger.error('Reserva OTA rechazada sin bloqueador identificable (¿capacidad insuficiente de la habitación?)', {
      roomTypeId, channelCode: incomingChannelCode, externalReservationId: bookingData.externalReservationId
    });
    await alertUnplacedOtaBooking(roomTypeId, bookingData, incomingChannelCode, channelId);
    return;
  }
  // El intento rechazado no se guarda como reserva, asi que el feed lo vuelve a traer en cada sync
  // (cada 5 min). Si ya hay un conflicto registrado para este mismo evento y fechas, no se duplica
  // la fila ni el email al admin.
  const { rows: already } = await query(
    `SELECT 1 FROM booking_conflicts
     WHERE rejected_payload->>'externalReservationId' = $1
       AND rejected_payload->>'channelId' = $2
       AND rejected_payload->>'checkIn' = $3
       AND rejected_payload->>'checkOut' = $4
     LIMIT 1`,
    [bookingData.externalReservationId, channelId, bookingData.checkIn, bookingData.checkOut]
  );
  if (already.length > 0) {return;}
  // Probable eco: un iCal sin huesped real (source 'ical') cuyas fechas caben enteras en UNA reserva de otro
  // canal es, casi siempre, lo que la OTA reexporta de lo que Lapa le cerro. Se registra igual (queda visible
  // en el panel) pero sin email inmediato: ver conflictService.detectConflicts.
  const probableEcho = bookingData.source === 'ical' && blocker.coversWholeStay && blocker.channelCode !== incomingChannelCode;
  await conflictService.recordConflict(
    {
      reservationIdA: blocker.id,
      channelA: blocker.channelCode,
      channelB: incomingChannelCode,
      rejectedPayload: { ...bookingData, channelId, ...(probableEcho ? { probableEcho: true } : {}) },
    },
    { notify: !probableEcho || isUrgentCheckIn(bookingData.checkIn) }
  );
}

/**
 * La OTA mando una reserva ya conocida con otras fechas (el huesped las cambio): se actualizan
 * reserva y camas/unidad. Si las fechas nuevas chocan con otra reserva, el EXCLUDE las rechaza:
 * se deja todo como estaba (la reserva sigue bloqueando las fechas viejas) y se avisa en el log.
 */
async function applyOtaDateChange(
  reservationId: string,
  channelCode: ChannelCode,
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
  try {
    await withTransaction(async (client) => {
      const { rows: beds } = await client.query<{ bed_id: string | null; room_type_id: string }>(
        `SELECT bed_id, room_type_id FROM reservation_beds WHERE reservation_id = $1`,
        [reservationId]
      );
      const lockIds = beds.map((b) => b.bed_id ?? b.room_type_id);
      if (lockIds.length > 0) {await acquireLock(client, [...new Set(lockIds)]);}
      await client.query(
        `UPDATE reservations SET check_in_date = $2::date, check_out_date = $3::date, nights_count = $4 WHERE id = $1`,
        [reservationId, checkIn, checkOut, nights]
      );
      await client.query(
        `UPDATE reservation_beds SET check_in = $2::date, check_out = $3::date WHERE reservation_id = $1`,
        [reservationId, checkIn, checkOut]
      );
    });
    logger.info('Reserva OTA: fechas actualizadas', { reservationId, channelCode, checkIn, checkOut });
    return true;
  } catch (error) {
    if (isOverbookingError(error)) {
      logger.warn('Reserva OTA: cambio de fechas rechazado por superposicion, se conservan las fechas anteriores', {
        reservationId, channelCode, checkIn, checkOut,
      });
      return false;
    }
    throw error;
  }
}

/**
 * Procesa una reserva entrante de OTA (webhook Booking/Expedia, o evento
 * detectado por iCal para Airbnb/Hostelworld). Idempotente por
 * (channelId, externalReservationId).
 */
async function handleChannelBooking(bookingData: IncomingOtaBooking, channelId: string): Promise<ChannelBookingResult> {
  const channel = await getChannelById(channelId);

  const { rows: existingRows } = await query<{
    id: string; status: string; cancellation_reason: string | null; check_in: string; check_out: string;
  }>(
    `SELECT id, status, cancellation_reason, check_in_date::text AS check_in, check_out_date::text AS check_out
     FROM reservations WHERE channel_id = $1 AND external_reservation_id = $2`,
    [channelId, bookingData.externalReservationId]
  );
  if (existingRows.length > 0) {
    const existing = existingRows[0];
    if (existing.status === 'cancelled' && bookingData.source === 'ical') {
      // La reserva se cancelo aca por ausencia en el feed (o aviso de la OTA) y el evento volvio a
      // aparecer: la OTA la sigue teniendo. Se libera su id externo (queda como historial) y se
      // sigue de largo para crearla de nuevo con el control normal de disponibilidad. Las
      // canceladas por conflicto o a mano tambien se recrean (via iCal): mientras el evento siga en el
      // feed la OTA tiene esas fechas ocupadas, y Lapa debe reflejarlo; si siguen ocupadas, el intento falla sin duplicar el aviso.
      await query(
        `UPDATE reservations SET external_reservation_id = left(external_reservation_id, 230) || '#cancelled-' || left(id::text, 8)
         WHERE id = $1`,
        [existing.id]
      );
      logger.info('Reserva OTA cancelada que reaparece en la OTA: se recrea', {
        reservationId: existing.id, channelCode: channel.code, externalReservationId: bookingData.externalReservationId,
      });
    } else {
      const datesChanged = existing.check_in !== bookingData.checkIn || existing.check_out !== bookingData.checkOut;
      if (datesChanged && existing.status !== 'cancelled') {
        let updated = await applyOtaDateChange(existing.id, channel.code, bookingData.checkIn, bookingData.checkOut);
        if (!updated && bookingData.source === 'ical' && bookingData.feedExternalIds) {
          // El cambio choca con pedazos viejos de la misma estadia (ver cancelStaleOverlapping): se limpian y se reintenta.
          const roomId = await query<{ room_type_id: string }>(`SELECT room_type_id FROM reservation_beds WHERE reservation_id = $1 LIMIT 1`, [existing.id]);
          const stale = roomId.rows[0]
            ? await findShiftedStayReservations(roomId.rows[0].room_type_id, channelId, bookingData.checkIn, bookingData.checkOut, bookingData.feedExternalIds, existing.id)
            : [];
          if (stale.length > 0) {
            await cancelStaleOverlapping(stale.map((r) => r.id));
            updated = await applyOtaDateChange(existing.id, channel.code, bookingData.checkIn, bookingData.checkOut);
          }
        }
        return { reservationId: existing.id, deduplicated: true, updated };
      }
      return { reservationId: existing.id, deduplicated: true };
    }
  }

  const roomType = bookingData.roomTypeId
    ? await getRoomTypeById(bookingData.roomTypeId)
    : await mapExternalRoomId(bookingData.roomExternalId ?? '', channelId);
  if (!roomType) {
    throw new Error(`No se pudo mapear la habitación de "${channel.code}": ${bookingData.roomExternalId ?? bookingData.roomTypeId ?? '(vacío)'}`);
  }

  const sameStay = await findSameStayReservation(
    roomType.id, channelId, bookingData.checkIn, bookingData.checkOut, bookingData.externalReservationId
  );
  if (sameStay) {
    logger.info('Reserva OTA ya registrada con otro id externo (misma estadia): no se duplica', {
      reservationId: sameStay.id, channelCode: channel.code,
      externalReservationId: bookingData.externalReservationId, storedExternalId: sameStay.externalId,
    });
    if (bookingData.source === 'webhook') {
      // El webhook trae el id real de la OTA (el que usara para cancelar); el iCal la guardo con el UID del
      // evento. Se adopta el id del webhook: el iCal sigue reconociendola por estadia y la cancelacion la encuentra.
      await query(`UPDATE reservations SET external_reservation_id = $2 WHERE id = $1`, [sameStay.id, bookingData.externalReservationId]);
      return { reservationId: sameStay.id, deduplicated: true, matchedExternalId: bookingData.externalReservationId };
    }
    return { reservationId: sameStay.id, deduplicated: true, matchedExternalId: sameStay.externalId };
  }

  // iCal: el huesped cambio las fechas en la OTA. El evento llega con otro UID y fechas nuevas, pero la reserva
  // guardada (con el id del webhook) ya no figura en el feed y se superpone con el: es la misma estadia.
  if (bookingData.source === 'ical' && bookingData.feedExternalIds) {
    const shifted = await findShiftedStayReservations(
      roomType.id, channelId, bookingData.checkIn, bookingData.checkOut, bookingData.feedExternalIds
    );
    if (shifted.length > 0) {
      const [survivor, ...others] = shifted;
      await cancelStaleOverlapping(others.map((r) => r.id));
      if (await applyOtaDateChange(survivor.id, channel.code, bookingData.checkIn, bookingData.checkOut)) {
        return { reservationId: survivor.id, deduplicated: true, updated: true, matchedExternalId: survivor.externalId };
      }
    }
  }

  const bedsCount = bookingData.bedsCount ?? 1;
  const gender = bookingData.guestGender ?? 'mixed';
  const nights = Math.max(
    1,
    Math.round((new Date(bookingData.checkOut).getTime() - new Date(bookingData.checkIn).getTime()) / 86400000)
  );

  try {
    return await withTransaction(async (client) => {
      const { rows: raceCheck } = await client.query(
        `SELECT id FROM reservations WHERE channel_id = $1 AND external_reservation_id = $2`,
        [channelId, bookingData.externalReservationId]
      );
      if (raceCheck.length > 0) {return { reservationId: raceCheck[0].id, deduplicated: true };}

      // Apartamentos: unidad completa, sin camas (ver apartment-unit.ts).
      const isApartment = await isApartmentRoomType(client, roomType.id);
      let candidateBedIds: string[] = [];
      if (isApartment) {
        if (await isUnitOccupied(client, roomType.id, bookingData.checkIn, bookingData.checkOut)) {
          throw new OtaAvailabilityError({ roomTypeId: roomType.id, requested: 1, found: 0 });
        }
      } else {
        candidateBedIds = await pickAvailableBedsInRoom(client, roomType.id, bookingData.checkIn, bookingData.checkOut, bedsCount, gender);
        if (candidateBedIds.length < bedsCount) {
          // Una reserva de OTA ya existe en la OTA: es un hecho, no una venta nueva. Un bloqueo manual
          // (room_blocks, pestaña Bloqueos) solo impide VENDER esas fechas, no debe impedir REGISTRARLAS.
          // Solo una reserva real superpuesta (reservation_beds) es un conflicto de verdad.
          candidateBedIds = await pickBedsIgnoringManualBlocks(client, roomType.id, bookingData.checkIn, bookingData.checkOut, bedsCount);
          if (candidateBedIds.length >= bedsCount) {
            logger.warn('Reserva OTA registrada sobre fechas con bloqueo manual', {
              roomTypeId: roomType.id, channelCode: channel.code,
              checkIn: bookingData.checkIn, checkOut: bookingData.checkOut,
            });
          }
        }
        if (candidateBedIds.length < bedsCount) {
          throw new OtaAvailabilityError({ roomTypeId: roomType.id, requested: bedsCount, found: candidateBedIds.length });
        }
      }

      await acquireLock(client, isApartment ? [roomType.id] : candidateBedIds);

      if (isApartment) {
        if (await isUnitOccupied(client, roomType.id, bookingData.checkIn, bookingData.checkOut)) {
          throw new OtaAvailabilityError({ roomTypeId: roomType.id, requested: 1, found: 0 });
        }
      } else {
        const { rows: stillOccupied } = await client.query(
          `SELECT bed_id FROM reservation_beds
           WHERE bed_id = ANY($1::uuid[])
             AND daterange(check_in, check_out, '[)') && daterange($2::date, $3::date, '[)')`,
          [candidateBedIds, bookingData.checkIn, bookingData.checkOut]
        );
        if (stillOccupied.length > 0) {
          throw new OtaAvailabilityError({ conflictingBeds: stillOccupied.map((r: { bed_id: string }) => r.bed_id) });
        }
      }

      const guestEmail = bookingData.guestEmail || `ota_${bookingData.externalReservationId}@${channel.code}.import`;
      const guest = await guestRepo.upsert({ full_name: bookingData.guestName || 'OTA Guest', email: guestEmail });

      const bookingDate = new Date().toISOString().slice(0, 10);
      const { rows: roomRows } = await client.query(`SELECT base_price FROM room_types WHERE id = $1`, [roomType.id]);
      const basePrice = parseFloat(roomRows[0].base_price);

      // Secuencial a proposito: son 4 queries sobre el MISMO PoolClient de
      // la transaccion activa -- pg no soporta consultas concurrentes en
      // una unica conexion (Promise.all aca dispararia
      // "Calling client.query() when the client is already executing a
      // query is deprecated").
      const { rows: finalPriceRows } = await client.query(`SELECT calculate_final_price($1::numeric, $2, $3, $4::date, $5::date) AS v`, [basePrice, nights, bedsCount, bookingData.checkIn, bookingDate]);
      const { rows: seasonRows } = await client.query(`SELECT calculate_season_multiplier($1::date) AS v`, [bookingData.checkIn]);
      const { rows: groupRows } = await client.query(`SELECT calculate_group_discount($1) AS v`, [bedsCount]);
      const { rows: earlyBirdRows } = await client.query(`SELECT calculate_early_bird_discount($1::date, $2::date) AS v`, [bookingDate, bookingData.checkIn]);
      const preDiscountPrice = parseFloat(finalPriceRows[0].v);
      const seasonMultiplier = parseFloat(seasonRows[0].v);
      const groupDiscount = parseFloat(groupRows[0].v);
      const earlyBirdDiscount = parseFloat(earlyBirdRows[0].v);
      // calculate_final_price ya no aplica el descuento por grupo internamente
      // (depende del total de TODA la reserva, no de un cuarto -- ver
      // 0010_global_group_discount_tiers.sql). Para las reservas OTA
      // (1 cuarto por reserva) bedsCount ES el total, asi que se aplica aca.
      // Un cierre del propietario hecho en la OTA bloquea las fechas pero no es una venta: sin precio.
      const finalPrice = bookingData.ownerBlock ? 0 : Math.round(preDiscountPrice * (1 - groupDiscount) * 100) / 100;

      const reservationNumber = generateReservationNumber(isApartment ? 'LCA' : 'LCH');

      const { rows: reservationRows } = await client.query(
        `INSERT INTO reservations (
           reservation_number, guest_id, channel_id, external_reservation_id, guest_gender,
           check_in_date, check_out_date, nights_count, beds_count,
           base_price, season_multiplier, group_discount, early_bird_discount, final_price,
           deposit_percent, deposit_amount, remaining_amount,
           status, source
         ) VALUES (
           $1, $2, $3, $4, $5::bed_gender,
           $6::date, $7::date, $8, $9,
           $10, $11, $12, $13, $14,
           0, 0, 0,
           'pending_ota_confirmation'::booking_status, $15
         ) RETURNING *`,
        [
          reservationNumber, guest.id, channelId, bookingData.externalReservationId, gender,
          bookingData.checkIn, bookingData.checkOut, nights, bedsCount,
          basePrice, seasonMultiplier, groupDiscount, earlyBirdDiscount, finalPrice,
          bookingData.ownerBlock ? `${channel.code}_ical_block` : channel.code,
        ]
      );
      const reservation = reservationRows[0];

      try {
        // batch con unnest() en vez de un INSERT por cama en un loop -- mismo
        // patrón aplicado en booking-service.ts y group-payment-service.ts.
        // El constraint EXCLUDE/trigger anti-overbooking se evalúa por fila,
        // así que isOverbookingError() de abajo no cambia.
        if (isApartment) {
          await insertUnitBlock(client, reservation.id, roomType.id, bookingData.checkIn, bookingData.checkOut);
        } else {
          await client.query(
            `INSERT INTO reservation_beds (reservation_id, bed_id, check_in, check_out)
             SELECT $1, bed_id, $3::date, $4::date
             FROM unnest($2::uuid[]) AS bed_id`,
            [reservation.id, candidateBedIds, bookingData.checkIn, bookingData.checkOut]
          );
        }
      } catch (error) {
        if (isOverbookingError(error)) {throw new OtaAvailabilityError({ reason: 'overbooking_detected_at_insert' });}
        throw error;
      }

      logger.info('Reserva OTA creada', {
        reservationId: reservation.id,
        channelCode: channel.code,
        externalReservationId: bookingData.externalReservationId,
        beds: isApartment ? 0 : candidateBedIds.length,
      });
      return { reservationId: reservation.id, deduplicated: false };
    });
  } catch (error) {
    if (error instanceof OtaAvailabilityError) {
      await recordAvailabilityConflict(roomType.id, bookingData, channel.code, channelId);
    }
    throw error;
  }
}

/** Cancelacion entrante de OTA (webhook, o inferida por ausencia del evento en un iCal reimportado). Idempotente. */
async function handleChannelCancellation(externalReservationId: string, channelId: string): Promise<ChannelCancellationResult> {
  const { rows } = await query<{ id: string; status: string }>(
    `SELECT id, status FROM reservations WHERE channel_id = $1 AND external_reservation_id = $2`,
    [channelId, externalReservationId]
  );
  if (rows.length === 0) {return { found: false };}
  if (rows[0].status === 'cancelled') {return { found: true, alreadyCancelled: true, reservationId: rows[0].id };}

  await query(
    `UPDATE reservations SET status = 'cancelled', cancelled_at = now(), cancellation_reason = 'ota_cancellation' WHERE id = $1`,
    [rows[0].id]
  );
  logger.info('Reserva OTA cancelada', { reservationId: rows[0].id, channelId, externalReservationId });
  return { found: true, reservationId: rows[0].id };
}

async function getChannelStats(channelId: string): Promise<ChannelStats> {
  const { rows } = await query<{
    total: number; confirmed: number; pending_confirmation: number; cancelled: number;
    gross_revenue: string; net_revenue: string;
  }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status IN ('confirmed', 'completed'))::int AS confirmed,
       COUNT(*) FILTER (WHERE status = 'pending_ota_confirmation')::int AS pending_confirmation,
       COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
       COALESCE(SUM(final_price) FILTER (WHERE status IN ('confirmed', 'completed')), 0) AS gross_revenue,
       COALESCE(SUM(calculate_channel_net_revenue(final_price, channel_id)) FILTER (WHERE status IN ('confirmed', 'completed')), 0) AS net_revenue
     FROM reservations WHERE channel_id = $1 AND COALESCE(source, '') !~ '_ical_block$'`,
    [channelId]
  );
  const row = rows[0];
  return {
    totalBookings: row.total,
    confirmedBookings: row.confirmed,
    pendingConfirmation: row.pending_confirmation,
    cancelledBookings: row.cancelled,
    grossRevenue: parseFloat(row.gross_revenue),
    netRevenue: parseFloat(row.net_revenue),
  };
}

interface RegisterChannelInput {
  code: ChannelCode;
  name?: string;
  hasWebhook?: boolean;
  icalEnabled?: boolean;
  isActive?: boolean;
}

/**
 * `channel_code` es un ENUM fijo con los 5 canales ya sembrados
 * (0001_seed.sql) -- esto actualiza configuracion mutable de un canal
 * existente, nunca crea un `channel_code` nuevo (eso requeriria
 * ALTER TYPE, prohibido por la politica de migraciones).
 */
async function registerChannel(data: RegisterChannelInput): Promise<ChannelRow> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (data.name !== undefined) { params.push(data.name); sets.push(`name = $${params.length}`); }
  if (data.hasWebhook !== undefined) { params.push(data.hasWebhook); sets.push(`has_webhook = $${params.length}`); }
  if (data.icalEnabled !== undefined) { params.push(data.icalEnabled); sets.push(`ical_enabled = $${params.length}`); }
  if (data.isActive !== undefined) { params.push(data.isActive); sets.push(`is_active = $${params.length}`); }

  if (sets.length === 0) {return getChannelByCode(data.code);}

  params.push(data.code);
  const { rows } = await query<ChannelRow>(
    `UPDATE channels SET ${sets.join(', ')}, updated_at = now() WHERE code = $${params.length}::channel_code RETURNING *`,
    params
  );
  if (rows.length === 0) {throw new Error(`Canal "${data.code}" no existe (channel_code es un ENUM fijo, ver 0001_extensions_and_enums.sql)`);}
  return rows[0];
}

async function getChannelByCode(code: ChannelCode): Promise<ChannelRow> {
  const { rows } = await query<ChannelRow>(`SELECT * FROM channels WHERE code = $1::channel_code`, [code]);
  if (rows.length === 0) {throw new Error(`Canal "${code}" no existe (channel_code es un ENUM fijo, ver 0001_extensions_and_enums.sql)`);}
  return rows[0];
}

/** Sincroniza los feeds iCal configurados para un canal especifico (no-op si el canal no tiene ical_enabled). */
async function syncChannel(channelId: string): Promise<{ synced: boolean; reason?: string } & Record<string, unknown>> {
  const channel = await getChannelById(channelId);
  if (!channel.ical_enabled) {return { synced: false, reason: `El canal "${channel.code}" no tiene ical_enabled` };}

  // import perezoso para evitar que ical-service (que importa este archivo para procesar reservas) tenga que resolverse en el mismo tick de carga del modulo
  const { syncICalFeeds } = await import('./ical-service');
  const result = await syncICalFeeds(channelId);
  return { synced: true, ...result };
}

export const channelService = {
  registerChannel,
  syncChannel,
  handleChannelBooking,
  handleChannelCancellation,
  getChannelStats,
  mapExternalRoomId,
};
