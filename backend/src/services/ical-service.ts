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
// migraciones, punto 7): system_config ya existe para datos
// de configuracion dinamica.
//
// UID propio de exportacion: `lapacasa-{reservation_id}@lapacasario.com`
// (requisito del feed). Al reimportar el
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
import { channelService, OtaAvailabilityError } from './channel-service';
import { emailService } from './email-service';
import { resolveRoomCodeFromName } from '../config/channels';
import { logger } from '../utils/logger';
import type { ChannelCode } from '../types/database';

const OWN_UID_PREFIX = 'lapacasa-';
const OWN_UID_SUFFIX = '@lapacasario.com';
const FEED_KEY_PREFIX = 'ical_feed:';
const SYNC_STATUS_KEY_PREFIX = 'ical_sync_status:';
const SEEN_KEY_PREFIX = 'ical_seen:';
const HEALTH_KEY_PREFIX = 'ical_feed_health:';
const FEED_LAST_KEY_PREFIX = 'ical_feed_last:';
/** Fallos seguidos de un feed antes de avisar al admin (3 x 5 min = 15 min). */
const ALERT_AFTER_FAILURES = 3;
/** Mientras siga fallando, se repite el aviso cada tanto (no cada 5 min). */
const REALERT_AFTER_MS = 12 * 60 * 60 * 1000;
/**
 * Una reserva importada se cancela solo si falta en el feed durante este tiempo seguido (24 h por defecto).
 * Se puede acortar con ICAL_ABSENCE_GRACE_HOURS (minimo 1 h): menos espera libera antes las fechas de una
 * cancelacion hecha en la OTA, pero aumenta el riesgo de liberar una reserva real que el feed omitio en una lectura.
 */
function absenceGraceMs(): number {
  const hours = Number(process.env.ICAL_ABSENCE_GRACE_HOURS);
  return (Number.isFinite(hours) && hours >= 1 ? hours : 24) * 60 * 60 * 1000;
}
/** Errores que no se arreglan solos (URL vencida o sin permiso): se avisa al primer fallo, no a los 15 min. */
const PERMANENT_FEED_ERROR = /\bHTTP (401|403|404|410)\b/;

/** Fallos seguidos de un feed antes de avisar al admin: 1 si el error es permanente, ALERT_AFTER_FAILURES si puede ser pasajero. */
export function feedAlertThreshold(error?: string): number {
  return PERMANENT_FEED_ERROR.test(error ?? '') ? 1 : ALERT_AFTER_FAILURES;
}

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
  /** ids de todos los eventos ajenos de esta lectura (solo si el feed se leyo bien) */
  eventIds?: string[];
}

export interface SyncAllResult {
  totalFeeds: number;
  successfulFeeds: number;
  failedFeeds: number;
  totalImported: number;
  totalCancelled: number;
  results: FeedImportResult[];
  /** por canal (channelId): ids de eventos vigentes, solo de canales cuyos feeds activos se leyeron todos bien */
  currentFeedIds: Map<string, Set<string>>;
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

export class DuplicateFeedError extends Error {
  constructor() {
    super('Ya existe un feed con esa plataforma, habitación y URL');
    this.name = 'DuplicateFeedError';
  }
}

export async function addFeed(input: { channelCode: ChannelCode; roomTypeId: string; url: string }): Promise<IcalFeedConfig> {
  const { rows: channelRows } = await query<{ id: string }>(
    `SELECT id FROM channels WHERE code = $1::channel_code`,
    [input.channelCode]
  );
  if (channelRows.length === 0) {throw new Error(`Canal "${input.channelCode}" no existe`);}

  const { rows: roomRows } = await query<{ id: string }>(`SELECT id FROM room_types WHERE id = $1`, [input.roomTypeId]);
  if (roomRows.length === 0) {throw new Error(`room_type no encontrado: ${input.roomTypeId}`);}

  const duplicate = (await listFeeds()).some(
    (f) => f.channelCode === input.channelCode && f.roomTypeId === input.roomTypeId && f.url === input.url
  );
  if (duplicate) {throw new DuplicateFeedError();}

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
    `INSERT INTO system_config (key, value, description) VALUES ($1, $2::jsonb, 'Feed iCal a importar')`,
    [`${FEED_KEY_PREFIX}${feed.id}`, JSON.stringify(feed)]
  );
  return feed;
}

/**
 * Reservas importadas de este canal+habitacion que siguen activas y futuras. Si ya no queda ningun
 * feed activo para ese canal+habitacion, nadie las va a cancelar por ausencia: quedan bloqueando las
 * fechas hasta que el admin las cancele a mano (se avisa para que no pase desapercibido).
 */
async function countOrphanedReservations(feed: IcalFeedConfig): Promise<number> {
  const others = (await listFeeds()).filter(
    (f) => f.id !== feed.id && f.isActive && f.channelId === feed.channelId && f.roomTypeId === feed.roomTypeId
  );
  if (others.length > 0) {return 0;}
  const { rows } = await query<{ n: number }>(
    `SELECT COUNT(DISTINCT r.id)::int AS n
     FROM reservations r JOIN reservation_beds rb ON rb.reservation_id = r.id
     WHERE rb.room_type_id = $1 AND r.channel_id = $2
       AND r.status IN ('confirmed', 'pending_ota_confirmation')
       AND r.external_reservation_id IS NOT NULL AND rb.check_out >= CURRENT_DATE`,
    [feed.roomTypeId, feed.channelId]
  );
  return rows[0]?.n ?? 0;
}

export async function updateFeed(
  feedId: string,
  patch: { url?: string; isActive?: boolean }
): Promise<(IcalFeedConfig & { orphanedReservations?: number }) | null> {
  const existing = await getFeed(feedId);
  if (!existing) {return null;}
  const next: IcalFeedConfig = { ...existing, ...patch };
  await query(`UPDATE system_config SET value = $2::jsonb, updated_at = now() WHERE key = $1`, [
    `${FEED_KEY_PREFIX}${feedId}`,
    JSON.stringify(next),
  ]);
  if (existing.isActive && next.isActive === false) {
    return { ...next, orphanedReservations: await countOrphanedReservations(existing) };
  }
  return next;
}

/** Devuelve null si no existia; si existia, cuantas reservas importadas quedan sin feed que las vigile. */
export async function deleteFeed(feedId: string): Promise<{ orphanedReservations: number } | null> {
  const existing = await getFeed(feedId);
  if (!existing) {return null;}
  await query(`DELETE FROM system_config WHERE key = ANY($1::text[])`, [
    [`${FEED_KEY_PREFIX}${feedId}`, `${SEEN_KEY_PREFIX}${feedId}`, `${HEALTH_KEY_PREFIX}${feedId}`, `${FEED_LAST_KEY_PREFIX}${feedId}`, `ical_feed_warn:${feedId}`, `${ECHO_KEY_PREFIX}${feedId}`],
  ]);
  return { orphanedReservations: await countOrphanedReservations(existing) };
}

interface FeedHealth {
  consecutiveFailures: number;
  alertedAt: string | null;
}

/**
 * Avisa por email al admin cuando un feed falla varias veces seguidas (URL vencida, 403, timeout):
 * una OTA desconectada pasaba desapercibida porque el unico aviso era un log. Un solo email al
 * llegar al umbral, otro cada 12 h si sigue caido, y uno cuando se recupera.
 */
async function trackFeedHealth(feed: IcalFeedConfig, result: FeedImportResult): Promise<void> {
  const key = `${HEALTH_KEY_PREFIX}${feed.id}`;
  const { rows } = await query<{ value: FeedHealth }>(`SELECT value FROM system_config WHERE key = $1`, [key]);
  const health: FeedHealth = rows[0]?.value ?? { consecutiveFailures: 0, alertedAt: null };
  const now = new Date();

  if (result.success) {
    if (health.alertedAt) {
      await emailService
        .sendAdminAlert('Feed iCal recuperado', { canal: feed.channelCode, habitacion: feed.roomTypeId, feed: feed.url })
        .catch((error) => logger.warn('No se pudo avisar la recuperacion del feed', { feedId: feed.id, error: error.message }));
    }
    if (health.consecutiveFailures > 0 || health.alertedAt) {await query(`DELETE FROM system_config WHERE key = $1`, [key]);}
    return;
  }

  health.consecutiveFailures += 1;
  const lastAlert = health.alertedAt ? new Date(health.alertedAt).getTime() : 0;
  const threshold = feedAlertThreshold(result.errors[0]);
  const shouldAlert = health.consecutiveFailures >= threshold && now.getTime() - lastAlert >= REALERT_AFTER_MS;
  if (shouldAlert) {
    await emailService
      .sendAdminAlert('Feed iCal con errores', {
        canal: feed.channelCode,
        habitacion: feed.roomTypeId,
        feed: feed.url,
        fallosSeguidos: health.consecutiveFailures,
        error: result.errors[0] ?? 'desconocido',
      })
      .then(() => { health.alertedAt = now.toISOString(); })
      .catch((error) => logger.warn('No se pudo enviar el aviso de feed caido', { feedId: feed.id, error: error.message }));
  }
  await query(
    `INSERT INTO system_config (key, value, description) VALUES ($1, $2::jsonb, 'Salud de un feed iCal (fallos seguidos, ultimo aviso)')
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [key, JSON.stringify(health)]
  );
}

async function recordSyncStatus(channelCode: ChannelCode, status: {
  lastSyncAt: string;
  success: boolean;
  imported: number;
  cancelled: number;
  errors: string[];
}): Promise<void> {
  await query(
    `INSERT INTO system_config (key, value, description) VALUES ($1, $2::jsonb, 'Estado de ultima sincronizacion iCal por canal')
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [`${SYNC_STATUS_KEY_PREFIX}${channelCode}`, JSON.stringify(status)]
  );
}

/** Resultado de la ultima lectura de cada feed (para mostrarlo por feed en el panel). */
async function recordFeedResult(feedId: string, result: FeedImportResult): Promise<void> {
  const value = {
    lastSyncAt: new Date().toISOString(),
    success: result.success,
    imported: result.imported,
    updated: result.updated,
    cancelled: result.cancelled,
    errors: result.errors.slice(0, 5),
  };
  await query(
    `INSERT INTO system_config (key, value, description) VALUES ($1, $2::jsonb, 'Ultimo resultado de lectura de un feed iCal')
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [`${FEED_LAST_KEY_PREFIX}${feedId}`, JSON.stringify(value)]
  );
}

export async function getFeedStatuses(): Promise<Record<string, unknown>> {
  const { rows } = await query<{ key: string; value: unknown }>(
    `SELECT key, value FROM system_config WHERE key LIKE '${FEED_LAST_KEY_PREFIX}%'`
  );
  const result: Record<string, unknown> = {};
  for (const row of rows) {result[row.key.slice(FEED_LAST_KEY_PREFIX.length)] = row.value;}
  return result;
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
  checkIn: string | Date;
  checkOut: string | Date;
  status: string;
}

/**
 * Las columnas DATE llegan de pg como Date a medianoche LOCAL del servidor (o como 'YYYY-MM-DD').
 * Se reduce a medianoche local con el mismo dia calendario, para que ical-generator (allDay) emita
 * siempre `VALUE=DATE:YYYYMMDD` correcto sin importar la zona horaria del servidor. `new Date('YYYY-MM-DD')`
 * seria medianoche UTC y en zonas al oeste de UTC correria el dia.
 */
export function toCalendarDate(value: string | Date): Date {
  if (value instanceof Date) {return new Date(value.getFullYear(), value.getMonth(), value.getDate());}
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * `excludeChannel`: no se exportan las reservas que vinieron de ese mismo canal (la OTA ya las
 * conoce; devolversela hace que las cierre y las reexporte a Lapa como "reserva nueva": bucle).
 */
async function fetchBookingsForRoom(roomTypeId: string, excludeChannel?: ChannelCode): Promise<BookingRow[]> {
  // Mismo criterio que la disponibilidad interna (todo lo no cancelado ocupa), salvo un pendiente de pago
  // ya vencido que todavia no limpio el cron: no debe cerrar fechas en las OTAs. GROUP BY: un UID por reserva.
  const { rows } = await query<BookingRow>(
    `SELECT r.id, MIN(g.full_name) AS "guestName", MIN(rb.check_in) AS "checkIn", MAX(rb.check_out) AS "checkOut", MIN(r.status::text) AS status
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id
     JOIN reservation_beds rb ON rb.reservation_id = r.id
     JOIN channels c ON c.id = r.channel_id
     WHERE rb.room_type_id = $1
       AND r.status <> 'cancelled'
       AND (r.status <> 'pending_payment' OR r.pending_expires_at IS NULL OR r.pending_expires_at > now())
       AND rb.check_out >= CURRENT_DATE - INTERVAL '7 days'
       AND ($2::text IS NULL OR c.code::text <> $2)
     GROUP BY r.id
     ORDER BY MIN(rb.check_in)`,
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
    start: toCalendarDate(booking.checkIn),
    end: toCalendarDate(booking.checkOut),
    allDay: true,
    summary: `Reserved - ${roomName}`,
    status: ICalEventStatus.CONFIRMED,
    busystatus: ICalEventBusyStatus.BUSY,
    created: new Date(),
    lastModified: new Date(),
  });
}

interface BlockRow {
  id: string;
  checkIn: string | Date;
  checkOut: string | Date;
}

const ymd = (value: string | Date): string => {
  const d = toCalendarDate(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Resta de [start, end) los rangos `cut` (todos [inicio, fin) en 'YYYY-MM-DD'). Devuelve los tramos que sobran. */
export function subtractRanges(start: string, end: string, cut: Array<{ start: string; end: string }>): Array<{ start: string; end: string }> {
  let pieces = [{ start, end }];
  for (const c of cut) {
    pieces = pieces.flatMap((p) => {
      if (c.end <= p.start || c.start >= p.end) {return [p];}
      const out: Array<{ start: string; end: string }> = [];
      if (c.start > p.start) {out.push({ start: p.start, end: c.start });}
      if (c.end < p.end) {out.push({ start: c.end, end: p.end });}
      return out;
    });
  }
  return pieces;
}

/** Estadías activas de UN canal en la habitación (para no tapar con un bloqueo de Lapa las fechas que ese canal ya ocupa). */
async function fetchChannelStays(roomTypeId: string, channel: ChannelCode): Promise<Array<{ start: string; end: string }>> {
  const { rows } = await query<{ start: string; end: string }>(
    `SELECT DISTINCT rb.check_in::text AS start, rb.check_out::text AS "end"
     FROM reservations r
     JOIN reservation_beds rb ON rb.reservation_id = r.id
     JOIN channels c ON c.id = r.channel_id
     WHERE rb.room_type_id = $1 AND c.code::text = $2
       AND r.status IN ('confirmed', 'pending_payment', 'pending_ota_confirmation')
       AND rb.check_out >= CURRENT_DATE - INTERVAL '7 days'`,
    [roomTypeId, channel]
  );
  return rows;
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
  // Al canal que ya tiene una reserva en esas noches no se le manda el bloqueo encima: la OTA mezclaba ambos
  // y dejaba de listar su propia reserva en su feed (Lapa la daba por cancelada).
  const ownStays = excludeChannel ? await fetchChannelStays(room.id, excludeChannel) : [];
  for (const block of blocks) {
    const pieces = subtractRanges(ymd(block.checkIn), ymd(block.checkOut), ownStays);
    pieces.forEach((piece, index) => {
      calendar.createEvent({
        id: `${OWN_UID_PREFIX}block-${block.id}${index > 0 ? `-${index}` : ''}${OWN_UID_SUFFIX}`,
        start: toCalendarDate(piece.start),
        end: toCalendarDate(piece.end),
        allDay: true,
        summary: `Blocked - ${room.name}`,
        status: ICalEventStatus.CONFIRMED,
        busystatus: ICalEventBusyStatus.BUSY,
        created: new Date(),
        lastModified: new Date(),
      });
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
  /** Airbnb marca "Not available" a un cierre hecho por el propietario (sus reservas reales dicen "Reserved"). */
  isOwnerBlock: boolean;
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
    const summary = String((booking.rawEvent as unknown as { summary?: string })?.summary ?? '');
    return {
      uid,
      isOwn: uid.startsWith(OWN_UID_PREFIX),
      isCancelled: booking.status === 'cancelled' || rawStatus === 'CANCELLED',
      isBlocked: booking.status === 'blocked',
      isOwnerBlock: booking.platform === 'airbnb' && /not available|unavailable/i.test(summary),
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
 * ABSENCE_GRACE_MS. SOLO las que todavia no empezaron o empiezan hoy (check_in >= hoy): una estadia en curso nunca
 * se cancela por ausencia, porque si la OTA omite el evento por un fallo del feed se liberaria un
 * apartamento ocupado; si realmente se cancela, la OTA lo marca con STATUS:CANCELLED. Una reserva sin registro previo arranca su plazo ahora (nunca se cancela
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
       AND rb.check_in >= CURRENT_DATE
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
    if (now.getTime() - lastSeen > absenceGraceMs()) {
      await channelService.handleChannelCancellation(uid, feed.channelId);
      delete seen[uid];
      cancelled++;
    }
  }
  return cancelled;
}


/**
 * Una estadía real no dura 6+ meses. Los eventos más largos que esto en un feed de OTA son el
 * "cierre de horizonte" (la OTA cierra todo lo posterior a su ventana de venta, p. ej. de dentro de
 * 90 días hasta dentro de 1 año): NO son reservas. Importarlos creaba una "reserva" fantasma de
 * meses que además se re-exportaba a las demás OTAs bloqueando casi un año.
 */
const MAX_IMPORT_NIGHTS = 180;

/**
 * Booking cierra todo lo posterior a hoy+365 y ese cierre llega partido en varios eventos pegados. Un evento que
 * termina despues de ese limite (o empieza a mas de 360 dias) no es una estadia: se ignora. Se reevalua cada dia,
 * asi que una estadia real que termina justo en el limite entra uno o dos dias despues.
 */
export function isBeyondSalesHorizon(checkIn: string, checkOut: string, now: Date = new Date()): boolean {
  const day = 24 * 60 * 60 * 1000;
  return checkIn > toISODate(new Date(now.getTime() + 360 * day)) || checkOut > toISODate(new Date(now.getTime() + 365 * day));
}

const nightsBetween = (checkIn: string, checkOut: string): number =>
  Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);

/** Cancela las reservas ya importadas de este feed que en realidad son cierres de horizonte. */
async function cleanHorizonReservations(feed: IcalFeedConfig): Promise<number> {
  const { rows } = await query<{ external_reservation_id: string }>(
    `SELECT DISTINCT r.external_reservation_id
     FROM reservations r
     JOIN reservation_beds rb ON rb.reservation_id = r.id
     WHERE rb.room_type_id = $1
       AND r.channel_id = $2
       AND r.status IN ('confirmed', 'pending_ota_confirmation')
       AND rb.check_out >= CURRENT_DATE
       AND (rb.check_out - rb.check_in) > $3
       AND r.external_reservation_id IS NOT NULL`,
    [feed.roomTypeId, feed.channelId, MAX_IMPORT_NIGHTS]
  );
  for (const row of rows) {
    await channelService.handleChannelCancellation(row.external_reservation_id, feed.channelId);
  }
  return rows.length;
}

/**
 * Eco tardio: cuando se cancela una reserva de Lapa (directa u otra OTA), la OTA sigue mostrando esas fechas
 * cerradas hasta que relee nuestro feed (horas). Si en ese lapso se importara su cierre, naceria una reserva
 * fantasma que ademas se reexporta a las demas OTAs. Un evento NUEVO, sin reserva activa, cuyas fechas quedan
 * cubiertas por una reserva de otro canal cancelada hace menos de ECHO_WINDOW_MS, se retiene en cuarentena.
 * Si sigue en el feed pasado ECHO_QUARANTINE_MS, deja de ser eco (la OTA lo mantiene) y se importa normal.
 * No oculta superposiciones con reservas vigentes: esas siguen generando conflicto (ver 3ecd80e).
 */
const ECHO_WINDOW_MS = 24 * 60 * 60 * 1000;
function echoQuarantineMs(): number {
  const hours = Number(process.env.ICAL_ECHO_QUARANTINE_HOURS);
  return (Number.isFinite(hours) && hours >= 1 ? hours : 12) * 60 * 60 * 1000;
}
const ECHO_KEY_PREFIX = 'ical_echo:';

async function loadEchoQuarantine(feedId: string): Promise<Record<string, string>> {
  const { rows } = await query<{ value: Record<string, string> }>(`SELECT value FROM system_config WHERE key = $1`, [`${ECHO_KEY_PREFIX}${feedId}`]);
  return rows[0]?.value ?? {};
}

async function saveEchoQuarantine(feedId: string, map: Record<string, string>): Promise<void> {
  const key = `${ECHO_KEY_PREFIX}${feedId}`;
  if (Object.keys(map).length === 0) {
    await query(`DELETE FROM system_config WHERE key = $1`, [key]);
    return;
  }
  await query(
    `INSERT INTO system_config (key, value, description) VALUES ($1, $2::jsonb, 'Eventos de un feed iCal retenidos por probable eco de una cancelacion')
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [key, JSON.stringify(map)]
  );
}

/** true si el evento nuevo es probable eco de una reserva ajena cancelada hace poco (ver ECHO_WINDOW_MS). */
export async function isRecentCancellationEcho(feed: IcalFeedConfig, checkIn: string, checkOut: string, uid: string): Promise<boolean> {
  // Una reserva cancelada ya no tiene reservation_beds (los borra el trigger al cancelar): la habitacion y las
  // fechas se leen de la propia reserva (cancelled_room_type_id, migracion 0069).
  const { rows } = await query(
    `SELECT 1
     FROM reservations r
     WHERE r.cancelled_room_type_id = $1
       AND r.status = 'cancelled'
       AND r.channel_id IS DISTINCT FROM $2
       AND r.cancelled_at > now() - ($3::bigint * interval '1 millisecond')
       AND r.check_in_date <= $4::date AND r.check_out_date >= $5::date
       AND NOT EXISTS (
         SELECT 1 FROM reservations x WHERE x.channel_id = $2 AND x.external_reservation_id = $6
       )
     LIMIT 1`,
    [feed.roomTypeId, feed.channelId, ECHO_WINDOW_MS, checkIn, checkOut, uid]
  );
  return rows.length > 0;
}

export interface FeedDiagnosisRow {
  uid: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  verdict: string;
}

/**
 * Diagnóstico de un feed SIN modificar nada: lee el feed de la OTA y dice, evento por evento, qué hace
 * (o haría) el sistema con él. Sirve para ver por qué una reserva real no aparece en Lapa Casa.
 */
export async function diagnoseFeed(feed: IcalFeedConfig): Promise<FeedDiagnosisRow[]> {
  const parsed = await new ICalParser().parseFromUrl(feed.url, feed.channelCode);
  if (!parsed.success) {throw new Error(`Parseo fallido: ${parsed.errors.join(', ')}`);}
  const events = toParsedIcalEvents(parsed.bookings);
  const rows: FeedDiagnosisRow[] = [];

  for (const event of events) {
    const nights = nightsBetween(event.checkIn, event.checkOut);
    const row = { uid: event.uid, checkIn: event.checkIn, checkOut: event.checkOut, nights };
    if (event.isOwn) {
      rows.push({ ...row, verdict: 'Evento PROPIO de Lapa Casa (UID lapacasa-…) devuelto por la plataforma: se ignora. Si cubre fechas de una reserva real de la plataforma, esa reserva no llega a importarse' });
      continue;
    }
    if (nights > MAX_IMPORT_NIGHTS) {
      rows.push({ ...row, verdict: 'Ignorado: cierre de horizonte de la plataforma (más de 180 noches)' });
      continue;
    }
    if (isBeyondSalesHorizon(event.checkIn, event.checkOut)) {
      rows.push({ ...row, verdict: 'Ignorado: más allá de la ventana de venta de la plataforma (cierre de horizonte, más de 1 año)' });
      continue;
    }
    if (event.isCancelled) {
      rows.push({ ...row, verdict: 'La plataforma lo marca como cancelado' });
      continue;
    }
    const { rows: existing } = await query<{
      reservation_number: string; status: string; cancellation_reason: string | null; ci: string; co: string;
      room_ids: string[] | null; room_names: string[] | null;
    }>(
      `SELECT r.reservation_number, r.status, r.cancellation_reason, r.check_in_date::text AS ci, r.check_out_date::text AS co,
              array_agg(DISTINCT rt.id::text) FILTER (WHERE rt.id IS NOT NULL) AS room_ids,
              array_agg(DISTINCT rt.name) FILTER (WHERE rt.id IS NOT NULL) AS room_names
       FROM reservations r
       LEFT JOIN reservation_beds rb ON rb.reservation_id = r.id
       LEFT JOIN room_types rt ON rt.id = rb.room_type_id
       WHERE r.channel_id = $1 AND r.external_reservation_id = $2
       GROUP BY r.id`,
      [feed.channelId, event.uid]
    );
    if (existing[0]) {
      const e = existing[0];
      // La reserva se busca por canal + id del evento, sin mirar la habitación: si otro apartamento tiene configurada
      // la misma URL de feed, la reserva puede estar guardada en ESE apartamento y no en este.
      const otherRoom = e.room_ids && e.room_ids.length > 0 && !e.room_ids.includes(feed.roomTypeId)
        ? ` ⚠ ESTÁ GUARDADA EN OTRO APARTAMENTO: ${(e.room_names ?? []).join(', ')}` : '';
      rows.push({
        ...row,
        verdict: e.status === 'cancelled'
          ? `Existe pero está CANCELADA (${e.reservation_number}, motivo: ${e.cancellation_reason ?? '—'}). Se recrea sola en la próxima sincronización.`
          : `Ya importada: ${e.reservation_number} (${e.status}, ${e.ci} → ${e.co})${otherRoom}`,
      });
      continue;
    }
    if (event.isBlocked && !event.isOwnerBlock && (await isRecentCancellationEcho(feed, event.checkIn, event.checkOut, event.uid))) {
      rows.push({ ...row, verdict: 'Retenido: probable ECO de una reserva cancelada hace menos de 24 h. Se importa solo si sigue en el feed pasadas 12 h' });
      continue;
    }
    const { rows: sameStay } = await query<{ reservation_number: string; status: string }>(
      `SELECT r.reservation_number, r.status
       FROM reservations r JOIN reservation_beds rb ON rb.reservation_id = r.id
       JOIN room_types rt ON rt.id = rb.room_type_id
       WHERE rb.room_type_id = $1 AND rt.property_type = 'apartment' AND r.channel_id = $2
         AND r.status IN ('confirmed', 'pending_ota_confirmation')
         AND r.check_in_date = $3::date AND r.check_out_date = $4::date AND r.external_reservation_id <> $5
       LIMIT 1`,
      [feed.roomTypeId, feed.channelId, event.checkIn, event.checkOut, event.uid]
    );
    if (sameStay[0]) {
      rows.push({ ...row, verdict: `Misma estadía ya registrada con otro id: ${sameStay[0].reservation_number} (${sameStay[0].status}). No se duplica` });
      continue;
    }
    const { rows: clash } = await query<{ reservation_number: string; status: string; ci: string; co: string; channel: string | null }>(
      `SELECT res.reservation_number, res.status, rb.check_in::text AS ci, rb.check_out::text AS co, ch.code AS channel
       FROM reservation_beds rb
       JOIN reservations res ON res.id = rb.reservation_id
       LEFT JOIN channels ch ON ch.id = res.channel_id
       WHERE rb.room_type_id = $1 AND res.status != 'cancelled'
         AND daterange(rb.check_in, rb.check_out, '[)') && daterange($2::date, $3::date, '[)')
       LIMIT 1`,
      [feed.roomTypeId, event.checkIn, event.checkOut]
    );
    rows.push({
      ...row,
      verdict: clash[0]
        ? `NO se puede importar: choca con la reserva ${clash[0].reservation_number} (${clash[0].channel ?? 'directa'}, ${clash[0].status}, ${clash[0].ci} → ${clash[0].co})`
        : 'Se importará en la próxima sincronización (cada hora)',
    });
  }
  // Eventos que el parser no pudo leer (sin titulo, fechas invalidas, UID repetido): sin esto quedaban invisibles.
  for (const message of parsed.errors) {
    rows.push({ uid: '(no leído)', checkIn: '', checkOut: '', nights: 0, verdict: `DESCARTADO por el parser: ${message}` });
  }
  return rows.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

async function countImportedFutureReservations(feed: IcalFeedConfig): Promise<number> {
  const { rows } = await query<{ n: number }>(
    `SELECT COUNT(DISTINCT r.id)::int AS n
     FROM reservations r JOIN reservation_beds rb ON rb.reservation_id = r.id
     WHERE rb.room_type_id = $1 AND r.channel_id = $2
       AND r.status IN ('confirmed', 'pending_ota_confirmation')
       AND r.external_reservation_id IS NOT NULL AND rb.check_out >= CURRENT_DATE`,
    [feed.roomTypeId, feed.channelId]
  );
  return rows[0]?.n ?? 0;
}

/**
 * Avisa por email (una vez cada 12 h por feed) cuando la lectura de un feed parece incompleta: eventos
 * descartados por no poder leerse (esas fechas quedarian libres) o feed vacio aunque Lapa tiene reservas
 * futuras importadas de ese canal (suele ser un fallo de la OTA, no que no haya reservas).
 */
async function alertFeedAnomaly(
  feed: IcalFeedConfig,
  parsed: { errors: string[]; metadata: { totalEvents: number; skippedEvents: number } },
  importErrors: string[] = []
): Promise<void> {
  const problems: string[] = [];
  if (importErrors.length > 0) {
    problems.push(`${importErrors.length} evento(s) no se pudieron importar: ${importErrors.slice(0, 3).join(' | ')}`);
  }
  if (parsed.metadata.skippedEvents > 0) {
    problems.push(`${parsed.metadata.skippedEvents} evento(s) descartado(s) por no poder leerse: ${parsed.errors.slice(0, 3).join(' | ')}`);
  }
  if (parsed.metadata.totalEvents === 0 && (await countImportedFutureReservations(feed)) > 0) {
    problems.push('El feed no trae ningún evento pero Lapa tiene reservas futuras importadas de este canal');
  }
  if (problems.length === 0) {return;}

  const key = `ical_feed_warn:${feed.id}`;
  const { rows } = await query<{ value: { alertedAt: string } }>(`SELECT value FROM system_config WHERE key = $1`, [key]);
  const last = rows[0]?.value?.alertedAt ? new Date(rows[0].value.alertedAt).getTime() : 0;
  if (Date.now() - last < REALERT_AFTER_MS) {return;}

  await emailService
    .sendAdminAlert('Feed iCal con lectura incompleta', { canal: feed.channelCode, habitacion: feed.roomTypeId, feed: feed.url, problemas: problems.join(' ; ') })
    .then(() =>
      query(
        `INSERT INTO system_config (key, value, description) VALUES ($1, $2::jsonb, 'Ultimo aviso de lectura incompleta de un feed iCal')
         ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
        [key, JSON.stringify({ alertedAt: new Date().toISOString() })]
      )
    )
    .catch((error) => logger.warn('No se pudo avisar la lectura incompleta del feed', { feedId: feed.id, error: error instanceof Error ? error.message : String(error) }));
}

export async function importICalFeed(feed: IcalFeedConfig): Promise<FeedImportResult> {
  const errors: string[] = [];
  const seenNow = new Set<string>();
  let imported = 0;
  let alreadyKnown = 0;
  let updated = 0;
  let skippedOwn = 0;
  let cancelledDirect = 0;
  let quarantined = 0;
  const importErrors: string[] = [];
  let parsedForAlert: Parameters<typeof alertFeedAnomaly>[1] | null = null;

  try {
    // Parser propio por feed: guarda estado interno (errores) y ahora se leen varios feeds en paralelo.
    const parsed = await new ICalParser().parseFromUrl(feed.url, feed.channelCode);
    if (!parsed.success) {throw new Error(`Parseo fallido: ${parsed.errors.join(', ')}`);}
    const events = toParsedIcalEvents(parsed.bookings);
    errors.push(...parsed.errors);
    parsedForAlert = parsed;
    // Ids de todos los eventos de esta lectura: una reserva guardada cuyo id NO esta aca y que se superpone con
    // un evento nuevo del mismo canal es la misma estadia con otras fechas (ver channel-service).
    const feedExternalIds = events.filter((e) => !e.isOwn).map((e) => e.uid);
    const echoQuarantine = await loadEchoQuarantine(feed.id);
    const echoStillPending: Record<string, string> = {};

    for (const event of events) {
      if (event.isOwn) { skippedOwn++; continue; }
      // Booking cierra siempre su "horizonte" (desde hoy + 1 año hasta una fecha lejana) y ese cierre
      // se corre un dia por dia: no es una reserva, y bloquearia todas esas fechas en Lapa.
      // Se ignoran los eventos que empiezan a mas de 360 dias.
      if (isBeyondSalesHorizon(event.checkIn, event.checkOut)) { continue; }
      // Cierre de horizonte de la OTA, no una estadía: se ignora (ver MAX_IMPORT_NIGHTS).
      if (nightsBetween(event.checkIn, event.checkOut) > MAX_IMPORT_NIGHTS) { continue; }
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

      // Eco tardio de una cancelacion: se retiene hasta ECHO_QUARANTINE_MS antes de tratarlo como reserva de la OTA.
      if (event.isBlocked && !event.isOwnerBlock && (await isRecentCancellationEcho(feed, event.checkIn, event.checkOut, event.uid))) {
        const since = echoQuarantine[event.uid] ?? new Date().toISOString();
        echoStillPending[event.uid] = since; // se conserva tambien liberado, para no reiniciar el plazo
        if (Date.now() - new Date(since).getTime() < echoQuarantineMs()) {
          quarantined++;
          continue;
        }
      }

      try {
        const result = await channelService.handleChannelBooking(
          {
            externalReservationId: event.uid,
            roomTypeId: feed.roomTypeId,
            guestName: event.isBlocked ? `${feed.channelCode} (iCal)` : event.guestName,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            source: 'ical',
            feedExternalIds,
            // Sin huesped real ("<canal> (iCal)"): es un bloqueo de fechas, no una venta. Se guarda sin precio
            // y fuera de estadisticas (source *_ical_block), pero sigue ocupando la unidad.
            ownerBlock: event.isOwnerBlock || event.isBlocked,
          },
          feed.channelId
        );
        // La misma estadia ya estaba guardada con otro id (webhook): se cuenta como vista para que
        // la cancelacion por ausencia no la elimine mientras la OTA siga publicandola.
        if (result.matchedExternalId) {seenNow.add(result.matchedExternalId);}
        if (result.updated) {updated++;} else if (result.deduplicated) {alreadyKnown++;} else {imported++;}
      } catch (error) {
        const msg = `Evento ${event.uid} (${event.checkIn} → ${event.checkOut}): ${error instanceof Error ? error.message : 'error desconocido'}`;
        errors.push(msg);
        if (!(error instanceof OtaAvailabilityError)) {importErrors.push(msg);}
      }
    }

    await saveEchoQuarantine(feed.id, echoStillPending);
    if (parsedForAlert) {await alertFeedAnomaly(feed, parsedForAlert, importErrors);}
    if (quarantined > 0) {logger.info('iCal: eventos retenidos por probable eco de una cancelacion', { feedId: feed.id, quarantined });}

    // Cancelacion por ausencia: solo si el evento falta 24 h seguidas (ver cancelAbsentReservations).
    // Los eventos que el feed marca expresamente como cancelados (STATUS:CANCELLED) se cancelan al instante.
    const seen = await loadSeen(feed.id);
    const nowIso = new Date().toISOString();
    for (const uid of seenNow) {seen[uid] = nowIso;}
    // Si el parser descarto eventos, una reserva real puede faltar en seenNow solo por eso: no se cancela por ausencia.
    const incompleteRead = parsed.metadata.skippedEvents > 0;
    const cancelledByAbsence = incompleteRead ? 0 : await cancelAbsentReservations(feed, seen, seenNow);
    const cancelledEchoes = await cleanHorizonReservations(feed);
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
      cancelled: cancelledDirect + cancelledByAbsence + cancelledEchoes,
      skippedOwn,
      errors,
      eventIds: feedExternalIds,
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

  // De a 4 feeds a la vez: en serie, muchos apartamentos x canales (30 s de timeout cada uno)
  // podian pasar los 5 min entre corridas del scheduler.
  const FEED_CONCURRENCY = 4;
  for (let i = 0; i < feeds.length; i += FEED_CONCURRENCY) {
    const batch = feeds.slice(i, i + FEED_CONCURRENCY);
    const batchResults = await Promise.all(batch.map((feed) => importICalFeed(feed)));
    for (const [index, result] of batchResults.entries()) {
      const feed = batch[index];
      results.push(result);
      await recordFeedResult(feed.id, result).catch((error) =>
        logger.warn('No se pudo guardar el resultado del feed', { feedId: feed.id, error: error instanceof Error ? error.message : String(error) })
      );
      await trackFeedHealth(feed, result).catch((error) =>
        logger.warn('No se pudo registrar la salud del feed', { feedId: feed.id, error: error instanceof Error ? error.message : String(error) })
      );
      const acc = byChannel.get(feed.channelCode) ?? { imported: 0, cancelled: 0, errors: [] };
      acc.imported += result.imported;
      acc.cancelled += result.cancelled;
      acc.errors.push(...result.errors);
      byChannel.set(feed.channelCode, acc);
    }
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

  const currentFeedIds = new Map<string, Set<string>>();
  for (const channelId of new Set(feeds.map((f) => f.channelId))) {
    const channelResults = feeds.map((f, i) => ({ f, r: results[i] })).filter(({ f }) => f.channelId === channelId);
    if (!channelResults.every(({ r }) => r?.success && r.eventIds)) {continue;}
    currentFeedIds.set(channelId, new Set(channelResults.flatMap(({ r }) => r!.eventIds!)));
  }

  return {
    totalFeeds: feeds.length,
    successfulFeeds: results.filter((r) => r.success).length,
    failedFeeds: results.filter((r) => !r.success).length,
    totalImported: results.reduce((s, r) => s + r.imported, 0),
    totalCancelled: results.reduce((s, r) => s + r.cancelled, 0),
    results,
    currentFeedIds,
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
 * Antes ninguna parte del repo la poblaba (confirmado en
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
  getFeedStatuses,
  generateICalFeed,
  generateAllFeeds,
  generateApartmentICalFeed,
  generateAllApartmentFeeds,
  parseICalEvents,
  importICalFeed,
  diagnoseFeed,
  syncICalFeeds,
  refreshAvailabilityCache,
  mapOTARoomToLocalRoom,
};
