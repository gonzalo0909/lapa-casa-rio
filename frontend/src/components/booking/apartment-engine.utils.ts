// frontend/src/components/booking/apartment-engine.utils.ts
// Funciones puras extraídas del motor de apartamentos — sin React, sin estado.

import type { ApartmentAvailability } from '@/types/global';
import { BCP47 } from '@/lib/utils';

/** Convierte un Date a string YYYY-MM-DD comparable lexicográficamente. */
export function toDs(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/** Parsea un string YYYY-MM-DD a Date local (sin timezone). */
export function parseDs(s: string): Date {
  const [y, m, d] = s.split('-') as [string, string, string];
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/** Formatea un datestring YYYY-MM-DD como "DD MMM YYYY" localizado. */
export function fmtDate(ds: string | null, locale: string): string {
  if (!ds) { return ''; }
  const d = parseDs(ds);
  const month = d.toLocaleDateString(BCP47[locale] ?? 'pt-BR', { month: 'short' });
  return String(d.getDate()).padStart(2, '0') + ' ' + month + ' ' + d.getFullYear();
}

/** Etiqueta "Mes Año" capitalizada en el locale indicado. */
export function monthYearLabel(y: number, m: number, locale: string): string {
  const label = new Date(y, m, 1).toLocaleDateString(BCP47[locale] ?? 'pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export { weekdayLabels } from '@/lib/utils';

/** String YYYY-MM-DD de hoy (fecha local del navegador). Solo para pintar
 *  el punto "hoy" en el calendario; para bloquear días usa minCheckInDs(). */
export function todayDs(): string {
  return toDs(new Date());
}

/** Re-export desde lib/utils — fuente única de verdad compartida con el hostel. */
export { minCheckInDs } from '@/lib/utils';

/**
 * Ordena los apartamentos en tres grupos:
 *   1. Disponibles con capacidad suficiente para los huéspedes
 *   2. Disponibles pero capacidad insuficiente
 *   3. No disponibles
 */
export function rankApartments(
  apartments: ApartmentAvailability[],
  guestCount: number,
) {
  const fits = (a: ApartmentAvailability) =>
    a.available && (a.fitsGuests ?? a.capacity >= guestCount);
  const tooSmall = (a: ApartmentAvailability) =>
    a.available && !(a.fitsGuests ?? a.capacity >= guestCount);
  return [
    ...apartments
      .filter(fits)
      .map((apt) => ({
        apt,
        disabledReason: undefined as 'unavailable' | 'too-small' | undefined,
      })),
    ...apartments
      .filter(tooSmall)
      .map((apt) => ({ apt, disabledReason: 'too-small' as const })),
    ...apartments
      .filter((a) => !a.available)
      .map((apt) => ({ apt, disabledReason: 'unavailable' as const })),
  ];
}

// ─── Validadores y formateadores de datos del huésped ────────────────────────
// FIX (auditoría 2026-08-30): validateCPF/formatCPF vivían acá duplicadas
// (idénticas) con hostel-engine.utils.ts -- consolidadas en @/lib/utils,
// re-exportadas de vuelta para no tener que tocar cada import existente.
export { validateCPF, formatCPF } from '@/lib/utils';

/** Devuelve true si el string tiene formato de e-mail válido. */
export function isEmailFmt(v: string): boolean {
  return (
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(v) &&
    !v.includes('..') &&
    v.indexOf('@') > 0
  );
}

export { formatBRPhone } from '@/lib/utils';
