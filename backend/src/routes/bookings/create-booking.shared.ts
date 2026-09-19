// backend/src/routes/bookings/create-booking.shared.ts
//
// Tipos y helpers compartidos entre create-hostel-booking.ts y
// create-apartment-booking.ts. No contiene lógica específica de cada motor.

import { query } from '../../config/database';
import { uploadDocumentPhoto } from '../../lib/cloudinary/cloudinary-client';
import { decodeBase64Image } from '../../utils/decode-base64-image';
import { logger } from '../../utils/logger';

// ── Feriados nacionais do Brasil ──────────────────────────────────────────────

function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m2 + 114) / 31) - 1;
  const day   = ((h + l - 7 * m2 + 114) % 31) + 1;
  return new Date(year, month, day);
}

function sameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

export function isBrazilHoliday(date: Date): boolean {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const fixed: [number, number][] = [
    [1,1],[4,21],[5,1],[9,7],[10,12],[11,2],[11,15],[12,25],
  ];
  if (fixed.some(([fm, fd]) => m === fm && d === fd)) {return true;}
  const easter    = easterDate(y);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  if (sameLocalDate(date, easter) || sameLocalDate(date, goodFriday)) {return true;}
  const carnivalMon = new Date(easter); carnivalMon.setDate(easter.getDate() - 48);
  const carnivalTue = new Date(easter); carnivalTue.setDate(easter.getDate() - 47);
  if (sameLocalDate(date, carnivalMon) || sameLocalDate(date, carnivalTue)) {return true;}
  return false;
}

// ── Request type ─────────────────────────────────────────────────────────────

export interface CreateBookingRequest {
  checkIn: string;
  checkOut: string;
  rooms: Array<{
    roomId: string;
    bedsCount: number;
    /** Camas elegidas manualmente — opcional, ver bookingService.createBooking(). */
    preferredBedIds?: string[];
  }>;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    document?: string;
    documentPhotoBase64?: string;
  };
  additionalGuests?: Array<{
    fullName: string;
    document: string;
    documentType?: string; // 'CPF' | 'RG' | 'passaporte' — default 'CPF'
    documentPhotoBase64?: string;
  }>;
  specialRequests?: string;
  arrivalTime?: string;
  language?: 'pt' | 'en' | 'es';
  source?: string;
  guestGender?: 'mixed' | 'female' | 'male';
  offerCode?: string;
}

// ── Blocklist helpers ────────────────────────────────────────────────────────

export function normalizeCPF(doc: string): string {
  return doc.replace(/\D/g, '');
}

/** true si alguno de los CPFs está en la lista negra (guests.blocked = true).
 *  Pasaportes y documentos con letras se saltan silenciosamente. */
export async function anyDocumentBlocked(documents: string[]): Promise<boolean> {
  const cpfs = documents.map(normalizeCPF).filter((d) => /^\d{11}$/.test(d));
  if (cpfs.length === 0) return false;
  const placeholders = cpfs.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query<{ id: string }>(
    `SELECT g.id FROM guests g
     WHERE g.blocked = true
       AND g.document_number = ANY(ARRAY[${placeholders}])
     LIMIT 1`,
    cpfs,
  );
  return (result.rowCount ?? 0) > 0;
}

// ── Booking guests ────────────────────────────────────────────────────────────

/** Inserta titular + acompañantes en booking_guests usando batch UNNEST. */
export async function insertBookingGuests(
  reservationId: string,
  titular: { fullName: string; document: string; documentType: string },
  additional: Array<{ fullName: string; document: string; documentType?: string; photoUrl?: string; photoPublicId?: string }>,
): Promise<void> {
  const guests = [
    { ...titular, isTitular: true, photoUrl: null as string | null, photoPublicId: null as string | null },
    ...additional.map((g) => ({
      ...g,
      documentType: g.documentType ?? 'CPF',
      isTitular: false,
      photoUrl: g.photoUrl ?? null,
      photoPublicId: g.photoPublicId ?? null,
    })),
  ];
  const names = guests.map((g) => g.fullName);
  const docs = guests.map((g) => g.document.replace(/\D/g, '') || g.document);
  const types = guests.map((g) => g.documentType);
  const titular_flags = guests.map((g) => g.isTitular);
  const photo_urls = guests.map((g) => g.photoUrl);
  const photo_pids = guests.map((g) => g.photoPublicId);
  const now = new Date().toISOString();
  await query(
    `INSERT INTO booking_guests
       (reservation_id, full_name, document_number, document_type, is_titular,
        document_photo_url, document_photo_public_id, document_photo_uploaded_at)
     SELECT $1, name, doc, dtype, is_tit, photo_url, photo_pid,
            CASE WHEN photo_url IS NOT NULL THEN $8::timestamptz ELSE NULL END
     FROM unnest($2::text[], $3::text[], $4::text[], $5::bool[],
                 $6::text[], $7::text[])
            AS t(name, doc, dtype, is_tit, photo_url, photo_pid)`,
    [reservationId, names, docs, types, titular_flags, photo_urls, photo_pids, now],
  );
}

// ── Document photo upload ─────────────────────────────────────────────────────

/** Sube las fotos de los acompañantes a Cloudinary.
 *  Errors no son fatales — se loguean y se continúa sin la foto. */
export async function uploadAdditionalGuestPhotos(
  bookingId: string,
  additionalGuests: NonNullable<CreateBookingRequest['additionalGuests']>,
): Promise<Array<{ fullName: string; document: string; documentType?: string; photoUrl?: string; photoPublicId?: string }>> {
  return Promise.all(
    additionalGuests.map(async (g) => {
      if (!g.documentPhotoBase64) return g;
      try {
        const photoBuffer = decodeBase64Image(g.documentPhotoBase64);
        const photo = await uploadDocumentPhoto(photoBuffer);
        return { ...g, photoUrl: photo.url, photoPublicId: photo.publicId };
      } catch (err) {
        logger.error('No se pudo subir foto de acompañante a Cloudinary', {
          bookingId,
          error: err instanceof Error ? err.message : String(err),
        });
        return g;
      }
    }),
  );
}

// ── Date validation (12h BRT cutoff) ─────────────────────────────────────────

/** Calcula el mínimo check-in permitido según la hora actual en São Paulo.
 *  Devuelve { minCheckIn: 'YYYY-MM-DD', hoursUntilCheckIn: number } */
export function calcCheckInBounds(checkInDs: string): {
  minCheckIn: string;
  hourBrt: number;
  todayInSaoPaulo: string;
} {
  const now = new Date();
  const todayInSaoPaulo = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(now);
  const hourParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const hourBrt = parseInt(hourParts.find((p) => p.type === 'hour')?.value ?? '12', 10);
  let minCheckIn = todayInSaoPaulo;
  if (hourBrt >= 12) {
    const [y, m, d] = todayInSaoPaulo.split('-').map(Number);
    const tomorrow = new Date(y, m - 1, d + 1);
    minCheckIn = tomorrow.getFullYear() +
      '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') +
      '-' + String(tomorrow.getDate()).padStart(2, '0');
  }
  return { minCheckIn, hourBrt, todayInSaoPaulo };
}
