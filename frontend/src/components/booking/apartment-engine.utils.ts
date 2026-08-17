// frontend/src/components/booking/apartment-engine.utils.ts
// Funciones puras extraídas del motor de apartamentos — sin React, sin estado.

import type { ApartmentAvailability } from '@/types/global';

/** BCP-47 usado para nombres de mes/día localizados (Intl). */
export const BCP47: Record<string, string> = {
  pt: 'pt-BR', es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE',
};

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

/** Devuelve true si ds cae dentro de alguno de los rangos de Carnaval. */
export function isCarnivalDs(
  ds: string,
  ranges: Array<{ startDate: string; endDate: string }>,
): boolean {
  return ranges.some((r) => ds >= r.startDate && ds <= r.endDate);
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

/** Array de 7 etiquetas de días de la semana (Dom…Sáb / Sun…Sat…) localizadas. */
export function weekdayLabels(locale: string): string[] {
  const bcp = BCP47[locale] ?? 'pt-BR';
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    labels.push(
      new Date(2023, 0, 1 + i).toLocaleDateString(bcp, { weekday: 'short' }),
    );
  }
  return labels;
}

/** String YYYY-MM-DD de hoy (fecha local). */
export function todayDs(): string {
  return toDs(new Date());
}

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
    a.available && a.capacity >= guestCount;
  const tooSmall = (a: ApartmentAvailability) =>
    a.available && a.capacity < guestCount;
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
