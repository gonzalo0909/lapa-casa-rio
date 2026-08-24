// lapa-casa-hostel/backend/src/services/ical-service.ts
// ventana5
//
// Reemplaza a services/ical-sync-service.ts + integrations/ical/ota-sync.ts
// + integrations/ical/ical-generator.ts (Ventana 4/anteriores), que
// referenciaban una tabla `ical_feeds` y una tabla `rooms` que nunca
// existieron en el schema real (0002_tables.sql tiene `room_types`, no
// `rooms`; no existe `ical_feeds`). Auditados igual que
// availability-service.ts/pricing-service.ts en Ventana 2: se reescriben
// contra el schema real en vez de "conectarlos" tal cual.
//
// Los feeds iCal configurados (URL a importar por canal+habitacion) se
// guardan en `system_config` (tabla real, JSONB) bajo la clave
// `ical_feed:<uuid>` -- no hace falta una migracion nueva (Politica de
// migraciones del Maestro, punto 7): system_config ya existe para datos
// de configuracion dinamica.
//
// UID propio de exportacion: `lapacasa-{reservation_id}@lapacasario.com`
// (pedido literalmente por el prompt de esta ventana). Al reimportar el
// propio feed exportado, cualquier evento cuyo UID empiece con
// "lapacasa-" se descarta -- evita el bucle "mi propia disponibilidad
// reimportada como reserva nueva".
//
// Correlacion webhook vs iCal reimportado (Booking.com, que tiene
// ambos): se resuelve por `external_reservation_id` + `channel_id`
// (indice unico real `idx_reservations_external_unique`, 0002_tables.sql),
// no por el UID propio -- son dos mecanismos anti-duplicado distintos
// (ver services/channel-service.ts, que hace el INSERT real con ese
// indice como autoridad de deduplicacion).

import { randomUUID } from 'crypto';
import ical, { ICalEventStatus, ICalEventBusyStatus } from 'ical-generator';
import { query } from '../config/database';
import { ICalParser } from '../integrations/ical/ical-parser';
import { channelService } from './channel-service';
import { resolveRoomCodeFromName } from '../config/channels';
import { logger } from '../utils/logger';
import type { ChannelCode } from '../types/database';

const OWN_UID_PREFIX = 'lapacasa-';
const OWN_UID_SUFFIX = '@lapacasario.com';
const FEED_KEY_PREFIX = 'ical_feed:';
const SYNC_STATUS_KEY_PREFIX = 'ical_sync_status:';

export interface IcalFeedConfig {
  id: string;
  channelCode: ChannelCode;
  channelId: string;
  roomTypeId: string;
  url: string;
  isActive: boolean;
  createdAt: string;
}

export interface FeedImportResult {
  feedId: string;
  channelCode: ChannelCode;
  roomTypeId: string;
  success: boolean;
  imported: number;
  alreadyKnown: number;
  cancelled: number;
  skippedOwn: number;
  errors: string[];
}

export interface SyncAllResult {
  totalFeeds: number;
  successfulFeeds: number;
  failedFeeds: number;
  totalImported: number;
  totalCancelled: number;
  results: FeedImportResult[];
}

interface RoomTypeRow {
  id: string;
  code: string;
  name: string;
}

const parser = new ICalParser();

// ---------------------------------------------------------------------
// Configuracion de feeds (system_config), CRUD usado por routes/ical
// ---------------------------------------------------------------------

export async function listFeeds(): Promise<IcalFeedConfig[]> {
  const { rows } = await query<{ value: IcalFeedConfig }>(
    `SELECT value FROM system_config WHERE key LIKE '${FEED_KEY_PREFIX}%' ORDER BY key`
  );
  return rows.map((r) => r.value);
}

export async function getFeed(feedId: string): Promise<IcalFeedConfig | null> {
  const { rows } = await query<{ value: IcalFeedConfig }>(
    `SELECT value FROM system_config WHERE key = $1`,
    [`${FEED_KEY_PREFIX}${feedId}`]
  );
  return rows[0]?.value ?? null;
}

export async function addFeed(input: { channelCode: ChannelCode; roomTypeId: string; url: string }): Promise<IcalFeedConfig> {
  const { rows: channelRows } = await query<{ id: string }>(
    `SELECT id FROM channels WHERE code = $1::channel_code`,
    [input.channelCode]
  );
  if (channelRows.length === 0) throw new Error(`Canal "${input.channelCode}" no existe`);

  const { rows: roomRows } = await query<{ id: string }>(`SELECT id FROM room_types WHERE id = $1`, [input.roomTypeId]);
  if (roomRows.length === 0) throw new Error(`room_type no encontrado: ${input.roomTypeId}`);

  const feed: IcalFeedConfig = {
    id: randomUUID(),
    channelCode: input.channelCode,
    channelId: channelRows[0].id,
    roomTypeId: input.roomTypeId,
    url: input.url,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await query(
    `INSERT INTO system_config (key, value, description) VALUES ($1, $2::jsonb, 'Feed iCal a importar (Ventana 5)')`,
    [`${FEED_KEY_PREFIX}${feed.id}`, JSON.stringify(feed)]
  );
  return feed;
}

export async function updateFeed(feedId: string, patch: { url?: string; isActive?: boolean }): Promise<IcalFeedConfig | null> {
  const existing = await getFeed(feedId);
  if (!existing) return null;
  const next: IcalFeedConfig = { ...existing, ...patch };
  await query(`UPDATE system_config SET value = $2::jsonb, updated_at = now() WHERE key = $1`, [
    `${FEED_KEY_PREFIX}${feedId}`,
    JSON.stringify(next),
  ]);
  return next;
}

export async function deleteFeed(feedId: string): Promise<boolean> {
  const { rowCount } = await query(`DELETE FROM system_config WHERE key = $1`, [`${FEED_KEY_PREFIX}${feedId}`]);
  return (rowCount ?? 0) > 0;
}

async function recordSyncStatus(channelCode: ChannelCode, status: {
  lastSyncAt: string;
  success: boolean;
  imported: number;
  cancelled: number;
  errors: string[];
}): Promise<void> {
  await query(
    `INSERT INTO system_config (key, value, description) VALUES ($1, $2::jsonb, 'Estado de ultima sincronizacion iCal por canal (Ventana 5)')
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [`${SYNC_STATUS_KEY_PREFIX}${channelCode}`, JSON.stringify(status)]
  );
}

export async function getSyncStatus(): Promise<Record<string, unknown>> {
  const { rows } = await query<{ key: string; value: unknown }>(
    `SELECT key, value FROM system_config WHERE key LIKE '${SYNC_STATUS_KEY_PREFIX}%'`
  );
  const result: Record<string, unknown> = {};
  for (const row of rows) result[row.key.slice(SYNC_STATUS_KEY_PREFIX.length)] = row.value;
  return result;
}

// ---------------------------------------------------------------------
// Exportacion (generateICalFeed / generateAllFeeds)
// ---------------------------------------------------------------------

interface BookingRow {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

async function fetchBookingsForRoom(roomTypeId: string): Promise<BookingRow[]> {
  const { rows } = await query<BookingRow>(
    `SELECT DISTINCT r.id, g.full_name AS "guestName", rb.check_in AS "checkIn", rb.check_out AS "checkOut", r.status
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     JOIN reservation_beds rb ON rb.reservation_id = r.id
     JOIN beds b ON b.id = rb.bed_id
     WHERE b.room_type_id = $1
       AND r.status IN ('confirmed', 'pending_payment', 'pending_ota_confirmation')
       AND rb.check_out >= CURRENT_DATE - INTERVAL '7 days'
     ORDER BY rb.check_in`,
    [roomTypeId]
  );
  return rows;
}

function addBookingEvent(calendar: ReturnType<typeof ical>, booking: BookingRow, roomName: string): void {
  const isPending = booking.status !== 'confirmed';
  calendar.createEvent({
    id: `${OWN_UID_PREFIX}${booking.id}${OWN_UID_SUFFIX}`,
    start: new Date(booking.checkIn),
    end: new Date(booking.checkOut),
    summary: isPending ? `Pending - ${roomName}` : `Reserved - ${roomName}`,
    description: `Guest: ${booking.guestName}`,
    status: isPending ? ICalEventStatus.TENTATIVE : ICalEventStatus.CONFIRMED,
    busystatus: ICalEventBusyStatus.BUSY,
    created: new Date(),
    lastModified: new Date(),
  });
}

/** Feed iCal publico de disponibilidad para UNA habitacion (room_types.id). */
export async function generateICalFeed(roomTypeId: string): Promise<string> {
  const { rows } = await query<RoomTypeRow>(`SELECT id, code, name FROM room_types WHERE id = $1`, [roomTypeId]);
  if (rows.length === 0) throw new Error(`room_type no encontrado: ${roomTypeId}`);
  const room = rows[0];

  const calendar = ical({
    name: `Lapa Casa - ${room.name}`,
    description: `Disponibilidad de ${room.name}`,
    timezone: 'America/Sao_Paulo',
    url: `https://lapacasario.com/api/v1/ical/export/${roomTypeId}`,
    ttl: 3600,
  });

  const bookings = await fetchBookingsForRoom(roomTypeId);
  for (const booking of bookings) addBookingEvent(calendar, booking, room.name);

  return calendar.toString();
}

/** Feed iCal combinado con las 5 habitaciones reales. */
export async function generateAllFeeds(): Promise<string> {
  const { rows: rooms } = await query<RoomTypeRow>(`SELECT id, code, name FROM room_types ORDER BY code`);

  const calendar = ical({
    name: 'Lapa Casa - Todas las habitaciones',
    description: 'Disponibilidad combinada de las 5 habitaciones',
    timezone: 'America/Sao_Paulo',
    url: 'https://lapacasario.com/api/v1/ical/export',
    ttl: 3600,
  });

  for (const room of rooms) {
    const bookings = await fetchBookingsForRoom(room.id);
    for (const booking of bookings) addBookingEvent(calendar, booking, room.name);
  }

  return calendar.toString();
}

// ---------------------------------------------------------------------
// Importacion (importICalFeed / parseICalEvents / syncICalFeeds)
// ---------------------------------------------------------------------

export interface ParsedIcalEvent {
  uid: string;
  isOwn: boolean;
  isCancelled: boolean;
  isBlocked: boolean;
  guestName: string;
  checkIn: string;
  checkOut: string;
}

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Parsea texto iCal crudo a eventos normalizados, marcando cuales son
 * propios (UID `lapacasa-*`). Reutiliza ICalParser.parseICalString
 * (integrations/ical/ical-parser.ts): ya sabe extraer fechas/nombre/
 * plataforma de forma generica y no conoce nada del schema real.
 */
function toParsedIcalEvents(bookings: import('../integrations/ical/ical-parser').ParsedBooking[]): ParsedIcalEvent[] {
  return bookings.map((booking) => {
    const uid = booking.rawEvent?.uid ? String(booking.rawEvent.uid) : booking.externalId;
    const rawStatus = (booking.rawEvent as unknown as { status?: string })?.status;
    return {
      uid,
      isOwn: uid.startsWith(OWN_UID_PREFIX),
      isCancelled: booking.status === 'cancelled' || rawStatus === 'CANCELLED',
      isBlocked: booking.status === 'blocked',
      guestName: booking.guestName,
      checkIn: toISODate(booking.checkIn),
      checkOut: toISODate(booking.checkOut),
    };
  });
}

export async function parseICalEvents(icalText: string, platform?: string): Promise<{ events: ParsedIcalEvent[]; errors: string[] }> {
  const result = await parser.parseICalString(icalText, platform);
  return { events: toParsedIcalEvents(result.bookings), errors: result.errors };
}

/**
 * Reservas activas de este canal+habitacion que YA NO aparecen en el
 * feed reimportado se consideran canceladas -- unico mecanismo real para
 * Airbnb/Hostelworld, que no tienen webhook de cancelacion (REQUISITO
 * CRITICO #4: "solo por eliminacion del evento en el feed importado").
 */
async function cancelMissingReservations(channelId: string, roomTypeId: string, activeUids: Set<string>): Promise<number> {
  const { rows } = await query<{ id: string; external_reservation_id: string }>(
    `SELECT DISTINCT r.id, r.external_reservation_id
     FROM reservations r
     JOIN reservation_beds rb ON rb.reservation_id = r.id
     JOIN beds b ON b.id = rb.bed_id
     WHERE b.room_type_id = $1
       AND r.channel_id = $2
       AND r.status IN ('confirmed', 'pending_ota_confirmation')
       AND rb.check_out >= CURRENT_DATE
       AND r.external_reservation_id IS NOT NULL`,
    [roomTypeId, channelId]
  );

  let cancelledCount = 0;
  for (const row of rows) {
    if (!activeUids.has(row.external_reservation_id)) {
      await channelService.handleChannelCancellation(row.external_reservation_id, channelId);
      cancelledCount++;
    }
  }
  return cancelledCount;
}

export async function importICalFeed(feed: IcalFeedConfig): Promise<FeedImportResult> {
  const errors: string[] = [];
  let imported = 0;
  let alreadyKnown = 0;
  let skippedOwn = 0;
  let cancelledDirect = 0;
  const activeUids = new Set<string>();

  try {
    const parsed = await parser.parseFromUrl(feed.url, feed.channelCode);
    if (!parsed.success) throw new Error(`Parseo fallido: ${parsed.errors.join(', ')}`);
    const events = toParsedIcalEvents(parsed.bookings);
    errors.push(...parsed.errors);

    for (const event of events) {
      if (event.isOwn) { skippedOwn++; continue; }
      if (event.isBlocked) continue;

      if (event.isCancelled) {
        await channelService.handleChannelCancellation(event.uid, feed.channelId);
        cancelledDirect++;
        continue;
      }

      activeUids.add(event.uid);
      try {
        const result = await channelService.handleChannelBooking(
          {
            externalReservationId: event.uid,
            roomTypeId: feed.roomTypeId,
            guestName: event.guestName,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            bedsCount: 1,
          },
          feed.channelId
        );
        if (result.deduplicated) alreadyKnown++; else imported++;
      } catch (error) {
        errors.push(`Evento ${event.uid}: ${error instanceof Error ? error.message : 'error desconocido'}`);
      }
    }

    const cancelledByDiff = await cancelMissingReservations(feed.channelId, feed.roomTypeId, activeUids);

    return {
      feedId: feed.id,
      channelCode: feed.channelCode,
      roomTypeId: feed.roomTypeId,
      success: true,
      imported,
      alreadyKnown,
      cancelled: cancelledDirect + cancelledByDiff,
      skippedOwn,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error desconocido';
    logger.error('Fallo al importar feed iCal', { feedId: feed.id, channelCode: feed.channelCode, error: message });
    return {
      feedId: feed.id,
      channelCode: feed.channelCode,
      roomTypeId: feed.roomTypeId,
      success: false,
      imported: 0,
      alreadyKnown: 0,
      cancelled: 0,
      skippedOwn: 0,
      errors: [message],
    };
  }
}

export async function syncICalFeeds(filterChannelId?: string): Promise<SyncAllResult> {
  const allFeeds = await listFeeds();
  const feeds = (filterChannelId ? allFeeds.filter((f) => f.channelId === filterChannelId) : allFeeds).filter((f) => f.isActive);

  const results: FeedImportResult[] = [];
  const byChannel = new Map<ChannelCode, { imported: number; cancelled: number; errors: string[] }>();

  for (const feed of feeds) {
    const result = await importICalFeed(feed);
    results.push(result);
    const acc = byChannel.get(feed.channelCode) ?? { imported: 0, cancelled: 0, errors: [] };
    acc.imported += result.imported;
    acc.cancelled += result.cancelled;
    acc.errors.push(...result.errors);
    byChannel.set(feed.channelCode, acc);
  }

  for (const [channelCode, acc] of byChannel) {
    await recordSyncStatus(channelCode, {
      lastSyncAt: new Date().toISOString(),
      success: acc.errors.length === 0,
      imported: acc.imported,
      cancelled: acc.cancelled,
      errors: acc.errors,
    });
  }

  await refreshAvailabilityCache();

  return {
    totalFeeds: feeds.length,
    successfulFeeds: results.filter((r) => r.success).length,
    failedFeeds: results.filter((r) => !r.success).length,
    totalImported: results.reduce((s, r) => s + r.imported, 0),
    totalCancelled: results.reduce((s, r) => s + r.cancelled, 0),
    results,
  };
}

/**
 * Recalcula `availability_cache` (tabla real, 0002_tables.sql) para
 * exportacion rapida -- es dato DERIVADO, nunca fuente de verdad (la
 * fuente real sigue siendo reservation_beds + el constraint EXCLUDE, ver
 * comentario en la migracion). Se apoya en `check_availability()`
 * (unica fuente de la regla de disponibilidad, Requisito Critico #6) en
 * vez de reimplementar el calculo de camas libres en JS.
 *
 * Antes de esta ventana ninguna parte del repo la poblaba (confirmado en
 * services/stats-service.ts, que por eso calcula ocupacion en vivo en
 * vez de leer de aca) -- Ventana 5 la deja poblada por primera vez, para
 * que una futura exportacion/reporte rapido pueda leerla en vez de
 * recalcular sobre reservation_beds cada vez.
 */
export async function refreshAvailabilityCache(daysAhead = 180): Promise<void> {
  await query(`DELETE FROM availability_cache WHERE date < CURRENT_DATE`);

  await query(
    `INSERT INTO availability_cache (room_type_id, date, available_beds, effective_gender, computed_at)
     SELECT a.room_type_id, d.day::date, COUNT(*) FILTER (WHERE a.is_available)::smallint, a.effective_gender, now()
     FROM generate_series(CURRENT_DATE, CURRENT_DATE + ($1::int - 1), interval '1 day') AS d(day)
     CROSS JOIN LATERAL check_availability(d.day::date, d.day::date + 1, 'mixed') AS a
     GROUP BY a.room_type_id, d.day, a.effective_gender
     ON CONFLICT (room_type_id, date) DO UPDATE SET
       available_beds = EXCLUDED.available_beds,
       effective_gender = EXCLUDED.effective_gender,
       computed_at = now()`,
    [daysAhead]
  );
}

/** Mapea un nombre libre de habitacion (tal como aparece en una OTA) al room_type real, por `code`. */
export async function mapOTARoomToLocalRoom(otaRoomName: string): Promise<RoomTypeRow | null> {
  const code = resolveRoomCodeFromName(otaRoomName);
  if (!code) return null;
  const { rows } = await query<RoomTypeRow>(`SELECT id, code, name FROM room_types WHERE code = $1`, [code]);
  return rows[0] ?? null;
}

export const icalService = {
  listFeeds,
  getFeed,
  addFeed,
  updateFeed,
  deleteFeed,
  getSyncStatus,
  generateICalFeed,
  generateAllFeeds,
  parseICalEvents,
  importICalFeed,
  syncICalFeeds,
  refreshAvailabilityCache,
  mapOTARoomToLocalRoom,
};
