import React from 'react';
import { BCP47 } from '@/lib/utils';

// ─── Feriados nacionais do Brasil ────────────────────────
// Duplica la lógica de backend/src/utils/brazil-holidays.ts (mismo algoritmo de
// Butcher, mismo conjunto de feriados). No se puede importar del backend al frontend.
function easterDate(year: number): Date {
  // Algoritmo de Butcher
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getHolidaysForYear(y: number): Date[] {
  const easter = easterDate(y);
  const addDays = (base: Date, n: number) => {
    const r = new Date(base); r.setDate(r.getDate() + n); return r;
  };
  return [
    new Date(y, 0, 1),          // Año Nuevo
    addDays(easter, -48),       // Carnaval lunes
    addDays(easter, -47),       // Carnaval martes
    addDays(easter, -2),        // Viernes Santo
    new Date(easter),           // Pascua
    new Date(y, 3, 21),         // Tiradentes
    new Date(y, 4, 1),          // Día del Trabajo
    addDays(easter, 60),        // Corpus Christi
    new Date(y, 8, 7),          // Independencia
    new Date(y, 9, 12),         // N.S. Aparecida
    new Date(y, 10, 2),         // Finados
    new Date(y, 10, 15),        // Proclamação da República
    new Date(y, 10, 20),        // Consciência Negra
    new Date(y, 11, 25),        // Navidad
  ];
}

const fmtDate_ = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Devuelve un Set de strings YYYY-MM-DD con los feriados del año dado (± 1 año).
 *  Útil para memoizar la comprobación en renders de calendario. */
export function getBrazilHolidaySet(year: number): Set<string> {
  const dates = [
    ...getHolidaysForYear(year - 1),
    ...getHolidaysForYear(year),
    ...getHolidaysForYear(year + 1),
  ];
  return new Set(dates.map(fmtDate_));
}

export function isBrazilHoliday(date: Date): boolean {
  const y = date.getFullYear();
  const set = getBrazilHolidaySet(y);
  return set.has(fmtDate_(date));
}

// ─── Temporada ────────────────────────────────────────────
export function getSeason(date: Date) {
  const m = date.getMonth();
  if (m===11||m===0||m===1||m===6||m===7) {return { kind: 'alta'  as const, mult:1.5, label:'Alta Temporada',  minNights:2 };}
  if (m===5||m===8)                        {return { kind: 'baixa' as const, mult:0.8, label:'Baixa Temporada', minNights:1 };}
  return                                          { kind: 'media' as const, mult:1.0, label:'Média Temporada', minNights:1 };
}

// ─── Validación y formateo CPF ─────────────────────────────
export { validateCPF, formatCPF } from '@/lib/utils';

export { formatBRPhone as formatPhone } from '@/lib/utils';

// ─── Formateo fecha/dinero ────────────────────────────────
export function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function fmtMoney(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Helpers de fecha ─────────────────────────────────────
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.toDateString() === b.toDateString();
}

export function dayBefore(a: Date, b: Date): boolean {
  return dateOnly(a) < dateOnly(b);
}

export function inRange(d: Date, a: Date | null, b: Date | null): boolean {
  if (!a || !b) {return false;}
  const [s, e] = dayBefore(a, b) ? [a, b] : [b, a];
  return dateOnly(d) > dateOnly(s) && dateOnly(d) < dateOnly(e);
}

// ─── Texto con negrita marcada con [[texto]] ──────────────
export function parseBold(str: string): React.ReactNode[] {
  const parts = str.split(/\[\[|\]\]/);
  return parts.map((p, i) => i % 2 === 1 ? React.createElement('strong', { key: i }, p) : p);
}

// ─── Idioma backend (solo acepta pt/en/es) ───────────────
export function toBackendLang(lang: string): 'pt' | 'en' | 'es' {
  if (lang === 'pt' || lang === 'es') return lang;
  return 'en';
}

// ─── Labels de calendario (Intl API) ─────────────────────
export { weekdayLabels } from '@/lib/utils';

export function monthLabel(m: number, locale: string): string {
  return new Date(2023, m, 1).toLocaleDateString(BCP47[locale] ?? 'pt-BR', { month: 'long' });
}
