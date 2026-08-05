// lapa-casa-hostel/backend/src/config/channels.ts
// ventana5
//
// Configuracion estatica del channel manager: mapping de room_types
// locales (por `code` real, ver 0001_seed.sql) a nombres/alias usados
// por cada OTA, prioridad de canal para resolucion automatica de
// conflictos, que canales tienen webhook de reservas vs. solo iCal, e
// intervalo de importacion iCal. No requiere tabla nueva: los feeds
// configurados por el admin (URLs concretas) se guardan en
// `system_config` (ver services/ical-service.ts), esto acá es solo
// metadata fija del dominio.

import type { ChannelCode } from '../types/database';

/**
 * Prioridad de canal para `autoResolveByPriority` en conflict-service.ts
 * (numero mas alto = gana). Orden pedido por el prompt de Ventana 5:
 * directo > Booking > Expedia > Hostelworld > Airbnb.
 */
export const CHANNEL_PRIORITY: Record<ChannelCode, number> = {
  direct: 100,
  booking: 80,
  expedia: 60,
  hostelworld: 40,
  airbnb: 20,
};

/** Canales con webhook de reservas en tiempo real (REQUISITO CRITICO #4). */
export const WEBHOOK_CHANNELS: ChannelCode[] = ['booking', 'expedia'];

/** Canales que dependen exclusivamente de importacion iCal periodica. */
export const ICAL_ONLY_CHANNELS: ChannelCode[] = ['airbnb', 'hostelworld'];

/** Intervalo de importacion iCal, en minutos (CONSIDERACIONES ESPECIALES del Maestro). */
export const ICAL_IMPORT_INTERVAL_MINUTES = 5;

/** Rutas de webhook registradas -- documentacion + usadas por config/env para armar URLs completas. */
export const WEBHOOK_PATHS: Partial<Record<ChannelCode, string>> = {
  booking: '/api/v1/webhooks/booking',
  expedia: '/api/v1/webhooks/expedia',
};

/**
 * Alias de nombres de habitacion usados por las OTAs para el mismo
 * room_type local (mapOTARoomToLocalRoom / mapExternalRoomId). Los
 * nombres reales que cada OTA use en produccion se configuran cuando se
 * crea el listing -- esta lista cubre las variantes mas comunes para
 * poder resolver por texto libre además de por ID exacto.
 */
export const ROOM_NAME_ALIASES: Record<string, string[]> = {
  mixto_12a: ['mixed dorm 12 a', 'mixto 12a', 'dorm 12 a', '12-bed mixed dormitory a'],
  mixto_12b: ['mixed dorm 12 b', 'mixto 12b', 'dorm 12 b', '12-bed mixed dormitory b'],
  mixto_7: ['mixed dorm 7', 'mixto 7', 'dorm 7', '7-bed mixed dormitory'],
  mixto_7c: ['mixed dorm 7 c', 'mixto 7c', 'dorm 7 c', '7-bed mixed dormitory c'],
  flexible_7: ['flexible dorm', 'flexible 7', 'female dorm 7', 'women dorm'],
};

/** Normaliza texto para comparacion de nombres de habitacion (minusculas, sin acentos/puntuacion). */
export function normalizeRoomName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Encuentra el `code` de room_type local que mejor matchea un nombre libre de OTA, o null. */
export function resolveRoomCodeFromName(otaRoomName: string): string | null {
  const normalized = normalizeRoomName(otaRoomName);
  for (const [code, aliases] of Object.entries(ROOM_NAME_ALIASES)) {
    if (normalized === normalizeRoomName(code)) return code;
    if (aliases.some((alias) => normalizeRoomName(alias) === normalized)) return code;
  }
  // fallback: substring match (ej. "Mixto 12A - Lapa Casa" contiene "12a")
  for (const [code, aliases] of Object.entries(ROOM_NAME_ALIASES)) {
    const candidates = [code, ...aliases].map(normalizeRoomName);
    if (candidates.some((c) => normalized.includes(c) || c.includes(normalized))) return code;
  }
  return null;
}
