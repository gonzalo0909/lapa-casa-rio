// frontend/src/components/booking/hostel-engine.utils.ts

import React from 'react';
import { BCP47 } from '@/lib/utils';

// ─── Feriados nacionais do Brasil ────────────────────────
function easterDate(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function getHolidaysForYear(y: number): Date[] {
  const fixed: [number, number][] = [
    [1,1],[4,21],[5,1],[9,7],[10,12],[11,2],[11,15],[12,25],
  ];
  const holidays = fixed.map(([m, d]) => new Date(y, m - 1, d));
  const easter = easterDate(y);
  const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
  const carnivalSat = new Date(easter); carnivalSat.setDate(easter.getDate() - 50);
  const carnivalSun = new Date(easter); carnivalSun.setDate(easter.getDate() - 49);
  const carnivalMon = new Date(easter); carnivalMon.setDate(easter.getDate() - 48);
  const carnivalTue = new Date(easter); carnivalTue.setDate(easter.getDate() - 47);
  const corpusChristi = new Date(easter); corpusChristi.setDate(easter.getDate() + 60);
  holidays.push(easter, goodFriday, carnivalSat, carnivalSun, carnivalMon, carnivalTue, corpusChristi);
  holidays.push(new Date(y, 11, 31)); // Réveillon
  return holidays;
}

export function isBrazilHoliday(date: Date): boolean {
  const y = date.getFullYear();
  const t = dateOnly(date).getTime();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  // Incluye año anterior y siguiente para fechas cerca de límites de año
  const holidays = [
    ...getHolidaysForYear(y - 1),
    ...getHolidaysForYear(y),
    ...getHolidaysForYear(y + 1),
  ];
  return holidays.some(h => Math.abs(dateOnly(h).getTime() - t) <= WEEK);
}

// ─── Temporada ────────────────────────────────────────────
export function getSeason(date: Date) {
  const m = date.getMonth();
  if (m===11||m===0||m===1||m===6||m===7) {return { kind: 'alta'  as const, mult:1.5, label:'Alta Temporada',  minNights:1 };}
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
  return 'R$ ' + v.toFixed(2).replace('.', ',');
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
