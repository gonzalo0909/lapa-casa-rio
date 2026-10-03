//
// Reemplaza a services/ical-sync-service.ts + integrations/ical/ota-sync.ts
// + integrations/ical/ical-generator.ts, que
// referenciaban una tabla `ical_feeds` y una tabla `rooms` que nunca
// existieron en el schema real (0002_tables.sql tiene `room_types`, no
// `rooms`; no existe `ical_feeds`). Auditados igual que
// availability-service.ts/pricing-service.ts: se reescriben
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
import { ICalParser, type ParsedBooking } from '../integrations/ical/ical-parser';
import { channelService } from './channel-service';
import { resolveRoomCodeFromName } from '../config/channels';
import { logger } from '../utils/logger';
import type { ChannelCode } from '../types/database';

const OWN_UID_PREFIX = 'lapacasa-';
const OWN_UID_SUFFIX = '@lapacasario.com';
const FEED_KEY_PREFIX = 'ical_feed:';
const SYNC_STATUS_KEY_PREFIX = 'ical_sync_status:';
const SEEN_KEY_PREFIX = 'ical_seen:';
/** Una reserva importada se cancela solo si falta en el feed durante este tiempo seguido. */
const ABSENCE_GRACE_MS = 24 * 60 * 60 * 1000;

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
  /** reservas conocidas cuyas fechas cambio la OTA y se actualizaron */
  updated: number;
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
  if (channelRows.length === 0) {throw new Error(`Canal "${input.channelCode}" no existe`);}

  const { rows: roomRows } = await query<{ id: string }>(`SELECT id FROM room_types WHERE id = $1`, [input.roomTypeId]);
  if (roomRows.length === 0) {throw new Error(`room_type no encontrado: ${input.roomTypeId}`);}

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
  if (!existing) {return null;}
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
  for (const row of rows) {result[row.key.slice(SYNC_STATUS_KEY_PREFIX.length)] = row.value;}
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

/**
 * `excludeChannel`: no se exportan las reservas que vinieron de ese mismo canal (la OTA ya las
 * conoce; devolversela hace que las cierre y las reexporte a Lapa como "reserva nueva": bucle).
 */
async function fetchBookingsForRoom(roomTypeId: string, excludeChannel?: ChannelCode): Promise<BookingRow[]> {
  const { rows } = await query<BookingRow>(
    `SELECT DISTINCT r.id, g.full_name AS "guestName", rb.check_in AS "checkIn", rb.check_out AS "checkOut", r.status
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     JOIN reservation_beds rb ON rb.reservation_id = r.id
     JOIN channels c ON c.id = r.channel_id
     WHERE rb.room_type_id = $1
       AND r.status IN ('confirmed', 'pending_payment', 'pending_ota_confirmation')
       AND rb.check_out >= CURRENT_DATE - INTERVAL '7 days'
       AND ($2::text IS NULL OR c.code::text <> $2)
     ORDER BY rb.check_in`,
    [roomTypeId, excludeChannel ?? null]
  );
  return rows;
}

/**
 * Toda reserva activa (incluidas pending_payment y pending_ota_confirmation) se exporta CONFIRMED:
 * varias OTAs ignoran los eventos TENTATIVE y no bloquearian esas fechas.
 */
function addBookingEvent(calendar: ReturnType<typeof ical>, booking: BookingRow, roomName: string): void {
  calendar.createEvent({
    id: `${OWN_UID_PREFIX}${booking.id}${OWN_UID_SUFFIX}`,
    start: new Date(booking.checkIn),
    end: new Date(booking.checkOut),
    summary: `Reserved - ${roomName}`,
    status: ICalEventStatus.CONFIRMED,
    busystatus: ICalEventBusyStatus.BUSY,
    created: new Date(),
    lastModified: new Date(),
  });
}

interface BlockRow {
  id: string;
  checkIn: string;
  checkOut: string;
}

/** Bloqueos manuales (room_blocks: mantenimiento, uso del propietario, feriados). end_date es exclusivo. */
async function fetchBlocksForRoom(roomTypeId: string): Promise<BlockRow[]> {
  const { rows } = await query<BlockRow>(
    `SELECT id, start_date AS "checkIn", end_date AS "checkOut"
     FROM room_blocks
     WHERE room_type_id = $1 AND end_date >= CURRENT_DATE - INTERVAL '7 days'
     ORDER BY start_date`,
    [roomTypeId]
  );
  return rows;
}

/**
 * Reservas + bloqueos manuales de una habitacion como eventos del feed. Los bloqueos no dependen del
 * canal: las fechas bloqueadas en Lapa se cierran en todas las OTAs. El UID empieza con `lapacasa-`,
 * asi que si una OTA lo devuelve en su propio feed, la importacion lo descarta.
 */
async function addRoomEvents(
  calendar: ReturnType<typeof ical>,
  room: { id: string; name: string },
  excludeChannel?: ChannelCode
): Promise<void> {
  const bookings = await fetchBookingsForRoom(room.id, excludeChannel);
  for (const booking of bookings) {addBookingEvent(calendar, booking, room.name);}

  const blocks = await fetchBlocksForRoom(room.id);
  for (const block of blocks) {
    calendar.createEvent({
      id: `${OWN_UID_PREFIX}block-${block.id}${OWN_UID_SUFFIX}`,
      start: new Date(block.checkIn),
      end: new Date(block.checkOut),
      summary: `Blocked - ${room.name}`,
      status: ICalEventStatus.CONFIRMED,
      busystatus: ICalEventBusyStatus.BUSY,
      created: new Date(),
      lastModified: new Date(),
    });
  }
}

/** Feed iCal publico de disponibilidad para UNA habitacion (room_types.id). */
export async function generateICalFeed(roomTypeId: string, excludeChannel?: ChannelCode): Promise<string> {
  const { rows } = await query<RoomTypeRow>(`SELECT id, code, name FROM room_types WHERE id = $1`, [roomTypeId]);
  if (rows.length === 0) {throw new Error(`room_type no encontrado: ${roomTypeId}`);}
  const room = rows[0];

  const calendar = ical({
    name: `Lapa Casa - ${room.name}`,
    description: `Disponibilidad de ${room.name}`,
    timezone: 'America/Sao_Paulo',
    url: `https://lapacasario.com/api/v1/ical/export/${roomTypeId}`,
    ttl: 3600,
  });

  await addRoomEvents(calendar, room, excludeChannel);

  return calendar.toString();
}

/** Feed iCal combinado con las 5 habitaciones reales del hostel. */
export async function generateAllFeeds(excludeChannel?: ChannelCode): Promise<string> {
  const { rows: rooms } = await query<RoomTypeRow>(
    `SELECT id, code, name FROM room_types WHERE property_type = 'hostel' ORDER BY code`
  );

  const calendar = ical({
    name: 'Lapa Casa - Todas las habitaciones',
    description: 'Disponibilidad combinada de las 5 habitaciones',
    timezone: 'America/Sao_Paulo',
    url: 'https://lapacasario.com/api/v1/ical/export',
    ttl: 3600,
  });

  for (const room of rooms) {
    await addRoomEvents(calendar, room, excludeChannel);
  }

  return calendar.toString();
}

/** Feed iCal de UN apartamento — valida que sea property_type='apartment'. */
export async function generateApartmentICalFeed(roomTypeId: string, excludeChannel?: ChannelCode): Promise<string> {
  const { rows } = await query<RoomTypeRow>(
    `SELECT id, code, name FROM room_types WHERE id = $1 AND property_type = 'apartment'`,
    [roomTypeId]
  );
  if (rows.length === 0) {throw new Error(`Apartamento no encontrado: ${roomTypeId}`);}
  const apt = rows[0];

  const calendar = ical({
    name: `Lapa Casa - ${apt.name}`,
    description: `Disponibilidad de ${apt.name}`,
    timezone: 'America/Sao_Paulo',
    url: `https://lapacasario.com/api/v1/ical/apartment/export/${roomTypeId}`,
    ttl: 3600,
  });

  await addRoomEvents(calendar, apt, excludeChannel);

  return calendar.toString();
}

/** Feed iCal combinado de todos los apartamentos. */
export async function generateAllApartmentFeeds(excludeChannel?: ChannelCode): Promise<string> {
  const { rows: rooms } = await query<RoomTypeRow>(
    `SELECT id, code, name FROM room_types WHERE property_type = 'apartment' ORDER BY code`
  );

  const calendar = ical({
    name: 'Lapa Casa - Apartamentos',
    description: 'Disponibilidad combinada de todos los apartamentos',
    timezone: 'America/Sao_Paulo',
    url: 'https://lapacasario.com/api/v1/ical/apartment/export',
    ttl: 3600,
  });

  for (const room of rooms) {
    await addRoomEvents(calendar, room, excludeChannel);
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
function toParsedIcalEvents(bookings: ParsedBooking[]): ParsedIcalEvent[] {
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
 * Ultima vez que cada evento (UID) se vio en el feed de un calendario, guardado en
 * system_config (sin migracion). Permite cancelar por ausencia SOLO si el evento falta
 * durante 24 h seguidas: el iCal de Booking omite reservas reales en algunas lecturas
 * (cancelarlas de inmediato liberaba fechas ocupadas), pero si una reserva se cancela
 * en Booking deja de aparecer para siempre y Lapa la libera al cabo de un dia.
 */
async function loadSeen(feedId: string): Promise<Record<string, string>> {
  const { rows } = await query<{ value: Record<string, string> }>(
    `SELECT value FROM system_config WHERE key = $1`,
    [`${SEEN_KEY_PREFIX}${feedId}`]
  );
  return rows[0]?.value ?? {};
}

async function saveSeen(feedId: string, seen: Record<string, string>): Promise<void> {
  await query(
    `INSERT INTO system_config (key, value, description) VALUES ($1, $2::jsonb, 'Ultima vez que se vio cada evento en un feed iCal')
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [`${SEEN_KEY_PREFIX}${feedId}`, JSON.stringify(seen)]
  );
}

/**
 * Cancela las reservas importadas de este feed que faltan en el feed actual desde hace mas de
 * ABSENCE_GRACE_MS. Una reserva sin registro previo arranca su plazo ahora (nunca se cancela
 * en la primera lectura). Devuelve cuantas cancelo. Exportada solo para pruebas.
 */
export async function cancelAbsentReservations(
  feed: IcalFeedConfig,
  seen: Record<string, string>,
  seenNow: Set<string>,
  now: Date = new Date()
): Promise<number> {
  const { rows } = await query<{ external_reservation_id: string }>(
    `SELECT DISTINCT r.external_reservation_id
     FROM reservations r
     JOIN reservation_beds rb ON rb.reservation_id = r.id
     WHERE rb.room_type_id = $1
       AND r.channel_id = $2
       AND r.status IN ('confirmed', 'pending_ota_confirmation')
       AND rb.check_out >= CURRENT_DATE
       AND r.external_reservation_id IS NOT NULL`,
    [feed.roomTypeId, feed.channelId]
  );

  let cancelled = 0;
  for (const { external_reservation_id: uid } of rows) {
    if (seenNow.has(uid)) {continue;}
    const lastSeen = seen[uid] ? new Date(seen[uid]).getTime() : NaN;
    if (Number.isNaN(lastSeen)) {
      seen[uid] = now.toISOString(); // sin registro: empieza el plazo de gracia
      continue;
    }
    if (now.getTime() - lastSeen > ABSENCE_GRACE_MS) {
      await channelService.handleChannelCancellation(uid, feed.channelId);
      delete seen[uid];
      cancelled++;
    }
  }
  return cancelled;
}

export async function importICalFeed(feed: IcalFeedConfig): Promise<FeedImportResult> {
  const errors: string[] = [];
  const seenNow = new Set<string>();
  const farFutureLimit = toISODate(new Date(Date.now() + 360 * 24 * 60 * 60 * 1000));
  let imported = 0;
  let alreadyKnown = 0;
  let updated = 0;
  let skippedOwn = 0;
  let cancelledDirect = 0;

  try {
    const parsed = await parser.parseFromUrl(feed.url, feed.channelCode);
    if (!parsed.success) {throw new Error(`Parseo fallido: ${parsed.errors.join(', ')}`);}
    const events = toParsedIcalEvents(parsed.bookings);
    errors.push(...parsed.errors);

    for (const event of events) {
      if (event.isOwn) { skippedOwn++; continue; }
      // Booking cierra siempre su "horizonte" (desde hoy + 1 año hasta una fecha lejana) y ese cierre
      // se corre un dia por dia: no es una reserva, y bloquearia todas esas fechas en Lapa.
      // Se ignoran los eventos que empiezan a mas de 360 dias.
      if (event.checkIn > farFutureLimit) { continue; }
      seenNow.add(event.uid);
      // Booking.com exporta sus reservas como "CLOSED - Not available" y Airbnb como
      // "Reserved": el parser las marca isBlocked, pero SON las fechas ocupadas y hay
      // que importarlas para bloquear disponibilidad (antes se descartaban y no
      // entraba ninguna reserva de OTA). Sin nombre real: se etiqueta con el canal.

      if (event.isCancelled) {
        await channelService.handleChannelCancellation(event.uid, feed.channelId);
        cancelledDirect++;
        continue;
      }

      try {
        const result = await channelService.handleChannelBooking(
          {
            externalReservationId: event.uid,
            roomTypeId: feed.roomTypeId,
            guestName: event.isBlocked ? `${feed.channelCode} (iCal)` : event.guestName,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
          },
          feed.channelId
        );
        if (result.updated) {updated++;} else if (result.deduplicated) {alreadyKnown++;} else {imported++;}
      } catch (error) {
        errors.push(`Evento ${event.uid}: ${error instanceof Error ? error.message : 'error desconocido'}`);
      }
    }

    // Cancelacion por ausencia: solo si el evento falta 24 h seguidas (ver cancelAbsentReservations).
    // Los eventos que el feed marca expresamente como cancelados (STATUS:CANCELLED) se cancelan al instante.
    const seen = await loadSeen(feed.id);
    const nowIso = new Date().toISOString();
    for (const uid of seenNow) {seen[uid] = nowIso;}
    const cancelledByAbsence = await cancelAbsentReservations(feed, seen, seenNow);
    // Se descartan registros de eventos que dejaron de verse hace mas de 7 dias.
    const keepAfter = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [uid, at] of Object.entries(seen)) {
      if (new Date(at).getTime() < keepAfter) {delete seen[uid];}
    }
    await saveSeen(feed.id, seen);

    return {
      feedId: feed.id,
      channelCode: feed.channelCode,
      roomTypeId: feed.roomTypeId,
      success: true,
      imported,
      alreadyKnown,
      updated,
      cancelled: cancelledDirect + cancelledByAbsence,
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
      updated: 0,
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
 * vez de leer de aca) -- La tabla quedó poblada por primera vez, para
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
  if (!code) {return null;}
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
  generateApartmentICalFeed,
  generateAllApartmentFeeds,
  parseICalEvents,
  importICalFeed,
  syncICalFeeds,
  refreshAvailabilityCache,
  mapOTARoomToLocalRoom,
};
