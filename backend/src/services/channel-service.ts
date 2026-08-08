// lapa-casa-hostel/backend/src/services/channel-service.ts
// ventana5
//
// Reservas entrantes de OTA (via webhook para Booking.com/Expedia, via
// iCal para Airbnb/Hostelworld) pasan por el MISMO motor anti-overbooking
// que booking-service.createBooking() (Ventana 2, Requisito Critico #1):
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

import { PoolClient } from 'pg';
import { query, withTransaction } from '../config/database';
import guestRepo from '../database/repositories/guest-repository';
import { acquireLock } from '../database/lock-middleware';
import { conflictService } from './conflict-service';
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

const generateReservationNumber = (): string =>
  `LCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

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
}

export interface ChannelBookingResult {
  reservationId: string;
  deduplicated: boolean;
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
  if (rows.length === 0) throw new Error(`Canal no encontrado: ${channelId}`);
  return rows[0];
}

async function getRoomTypeById(roomTypeId: string): Promise<RoomTypeRow | null> {
  const { rows } = await query<RoomTypeRow>(`SELECT id, code, name FROM room_types WHERE id = $1`, [roomTypeId]);
  return rows[0] ?? null;
}

/** Mapea un ID/nombre externo de habitacion de OTA al room_type real, por UUID, `code` exacto, o alias de nombre (config/channels.ts). */
async function mapExternalRoomId(externalRoomIdOrName: string, _channelId?: string): Promise<RoomTypeRow | null> {
  if (!externalRoomIdOrName) return null;

  const { rows: direct } = await query<RoomTypeRow>(
    `SELECT id, code, name FROM room_types WHERE id::text = $1 OR code = $1`,
    [externalRoomIdOrName]
  );
  if (direct.length > 0) return direct[0];

  const code = resolveRoomCodeFromName(externalRoomIdOrName);
  if (!code) return null;
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

async function findBlockingReservation(
  roomTypeId: string,
  checkIn: string,
  checkOut: string
): Promise<{ id: string; channelCode: ChannelCode } | null> {
  const { rows } = await query<{ id: string; channel_code: ChannelCode }>(
    `SELECT r.id, c.code AS channel_code
     FROM reservation_beds rb
     JOIN reservations r ON r.id = rb.reservation_id
     JOIN beds b ON b.id = rb.bed_id
     JOIN channels c ON c.id = r.channel_id
     WHERE b.room_type_id = $1
       AND r.status IN ('confirmed', 'pending_payment', 'pending_ota_confirmation')
       AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')
     ORDER BY r.created_at ASC
     LIMIT 1`,
    [roomTypeId, checkIn, checkOut]
  );
  if (rows.length === 0) return null;
  return { id: rows[0].id, channelCode: rows[0].channel_code };
}

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
    // es NOT NULL (siempre debe referenciar una reserva real), asi que no corresponde registrar aca.
    logger.error('Reserva OTA rechazada sin bloqueador identificable (¿capacidad insuficiente de la habitación?)', {
      roomTypeId, channelCode: incomingChannelCode, externalReservationId: bookingData.externalReservationId
    });
    return;
  }
  await conflictService.recordConflict({
    reservationIdA: blocker.id,
    channelA: blocker.channelCode,
    channelB: incomingChannelCode,
    rejectedPayload: { ...bookingData, channelId },
  });
}

/**
 * Procesa una reserva entrante de OTA (webhook Booking/Expedia, o evento
 * detectado por iCal para Airbnb/Hostelworld). Idempotente por
 * (channelId, externalReservationId).
 */
async function handleChannelBooking(bookingData: IncomingOtaBooking, channelId: string): Promise<ChannelBookingResult> {
  const channel = await getChannelById(channelId);

  const { rows: existingRows } = await query<{ id: string }>(
    `SELECT id FROM reservations WHERE channel_id = $1 AND external_reservation_id = $2`,
    [channelId, bookingData.externalReservationId]
  );
  if (existingRows.length > 0) {
    return { reservationId: existingRows[0].id, deduplicated: true };
  }

  const roomType = bookingData.roomTypeId
    ? await getRoomTypeById(bookingData.roomTypeId)
    : await mapExternalRoomId(bookingData.roomExternalId ?? '', channelId);
  if (!roomType) {
    throw new Error(`No se pudo mapear la habitación de "${channel.code}": ${bookingData.roomExternalId ?? bookingData.roomTypeId ?? '(vacío)'}`);
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
      if (raceCheck.length > 0) return { reservationId: raceCheck[0].id, deduplicated: true };

      const candidateBedIds = await pickAvailableBedsInRoom(client, roomType.id, bookingData.checkIn, bookingData.checkOut, bedsCount, gender);
      if (candidateBedIds.length < bedsCount) {
        throw new OtaAvailabilityError({ roomTypeId: roomType.id, requested: bedsCount, found: candidateBedIds.length });
      }

      await acquireLock(client, candidateBedIds);

      const { rows: stillOccupied } = await client.query(
        `SELECT bed_id FROM reservation_beds
         WHERE bed_id = ANY($1::uuid[])
           AND daterange(check_in, check_out, '[)') && daterange($2::date, $3::date, '[)')`,
        [candidateBedIds, bookingData.checkIn, bookingData.checkOut]
      );
      if (stillOccupied.length > 0) {
        throw new OtaAvailabilityError({ conflictingBeds: stillOccupied.map((r: { bed_id: string }) => r.bed_id) });
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
      const finalPrice = Math.round(preDiscountPrice * (1 - groupDiscount) * 100) / 100;

      const reservationNumber = generateReservationNumber();

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
          channel.code,
        ]
      );
      const reservation = reservationRows[0];

      try {
        for (const bedId of candidateBedIds) {
          await client.query(
            `INSERT INTO reservation_beds (reservation_id, bed_id, check_in, check_out) VALUES ($1, $2, $3::date, $4::date)`,
            [reservation.id, bedId, bookingData.checkIn, bookingData.checkOut]
          );
        }
      } catch (error) {
        if (isOverbookingError(error)) throw new OtaAvailabilityError({ reason: 'overbooking_detected_at_insert' });
        throw error;
      }

      logger.info('Reserva OTA creada', {
        reservationId: reservation.id,
        channelCode: channel.code,
        externalReservationId: bookingData.externalReservationId,
        beds: candidateBedIds.length,
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
  if (rows.length === 0) return { found: false };
  if (rows[0].status === 'cancelled') return { found: true, alreadyCancelled: true, reservationId: rows[0].id };

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
     FROM reservations WHERE channel_id = $1`,
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
 * ALTER TYPE, prohibido por la politica de migraciones del Maestro).
 */
async function registerChannel(data: RegisterChannelInput): Promise<ChannelRow> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (data.name !== undefined) { params.push(data.name); sets.push(`name = $${params.length}`); }
  if (data.hasWebhook !== undefined) { params.push(data.hasWebhook); sets.push(`has_webhook = $${params.length}`); }
  if (data.icalEnabled !== undefined) { params.push(data.icalEnabled); sets.push(`ical_enabled = $${params.length}`); }
  if (data.isActive !== undefined) { params.push(data.isActive); sets.push(`is_active = $${params.length}`); }

  if (sets.length === 0) return getChannelByCode(data.code);

  params.push(data.code);
  const { rows } = await query<ChannelRow>(
    `UPDATE channels SET ${sets.join(', ')}, updated_at = now() WHERE code = $${params.length}::channel_code RETURNING *`,
    params
  );
  if (rows.length === 0) throw new Error(`Canal "${data.code}" no existe (channel_code es un ENUM fijo, ver 0001_extensions_and_enums.sql)`);
  return rows[0];
}

async function getChannelByCode(code: ChannelCode): Promise<ChannelRow> {
  const { rows } = await query<ChannelRow>(`SELECT * FROM channels WHERE code = $1::channel_code`, [code]);
  if (rows.length === 0) throw new Error(`Canal "${code}" no existe (channel_code es un ENUM fijo, ver 0001_extensions_and_enums.sql)`);
  return rows[0];
}

/** Sincroniza los feeds iCal configurados para un canal especifico (no-op si el canal no tiene ical_enabled). */
async function syncChannel(channelId: string): Promise<{ synced: boolean; reason?: string } & Record<string, unknown>> {
  const channel = await getChannelById(channelId);
  if (!channel.ical_enabled) return { synced: false, reason: `El canal "${channel.code}" no tiene ical_enabled` };

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
